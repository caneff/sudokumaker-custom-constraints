#!/usr/bin/env bash
# The seam runner: the one listing of the gate's suites. A suite is one
# command (`uv run <file>`, `node <file>`, one lint step), and it is its own
# label. With no flag this runs every suite `just check-full` runs, one at a
# time on one core, in the same order. Files are found by glob from the tree
# on disk, so a new test needs no edit here; the lists below are the
# exceptions, and examples/_shared/gate.test.py checks them against the tree.
#
#   bash tests/all.sh [--list] [--changed <base>]
#
# `--list` prints the suites the run would cover, one per line, and runs none.
#
# `--changed <base>` narrows the run to what the diff `<base>...HEAD` could
# affect, by directory and not by import scan:
#   - lint and the shared checks under examples/_shared/, always;
#   - every suite of each examples/<name>/ and finders/<name>/ the diff
#     touches: its tests, its heavy tests and its soundness harness.
# It widens to the whole seam when the diff touches what every suite depends
# on (`place` below names those paths) or a path no rule places. A Markdown
# file outside an example or a finder selects nothing more. The narrowing can
# run too little only across an edge this file cannot see; the controller
# re-runs the whole seam on the merged result before every merge.
#
# One line per suite as it finishes (`PASS <suite>`); the first failing suite
# prints `FAIL <suite>` and its whole output, and the run exits 1 there. The
# last line states what ran: `N of M suites passed`, M being the whole seam,
# followed by `(narrowed: <units>)` or `(widened: <why>)` on a `--changed` run.
set -uf
# A caller's GIT_DIR or GIT_INDEX_FILE (a git hook sets both) would point the
# diff below, and every suite that calls git, at that caller's repository.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd) || exit 1
cd "$root" || exit 1

# The heavy tests: an end-to-end generation run or a recovery probe over many
# boards, ten to twenty seconds each. Named as two groups so CI can run them
# as separate jobs (examples/_shared/ci_workflow.test.py checks this).
heavy_fillomino="examples/fillomino/pipeline.test.py examples/fillomino/generate.test.py"
heavy_recovery="examples/skyscraper/recovery-probe.test.mjs examples/hit-counts/recovery-probe.test.mjs"

# Finder tests (#662) that do not run as a plain `uv run <file>`:
#   finder_slow:   never part of the seam (a CP-SAT solve per known grid,
#                  minutes overall).
#   finder_cover:  run with `--cover` (a subset, one grid per shape).
#   finder_pytest: the pytest suites, run as `uv run pytest <file> -q`.
finder_slow="finders/renbanana/tools/test_prove_two_stage_slow.py"
finder_cover="finders/renbanana/tools/test_probe_circle_pattern_accepts_known_grids.py finders/renbanana/tools/test_probe_finds_known_grids.py"
finder_pytest="finders/counting_shaded/test_counting_shaded.py"

listed() { case " $1 " in *" $2 "*) return 0 ;; esac; return 1; } # <list> <file>

# The unit that owns a test file: `examples/<name>` or `finders/<name>`, the
# directory a `--changed` run selects it by. The shared checks and lint belong
# to `always`.
unit_of() { # <file>
  local top name
  IFS=/ read -r top name _ <<<"$1"
  if [ "$top/$name" = examples/_shared ]; then echo always; else echo "$top/$name"; fi
}

suite() { printf '%s\t%s\n' "$(unit_of "$1")" "$2"; } # <file> <command>

run_file() { # <file>: prints the suite that runs a test file
  case $1 in *.mjs) suite "$1" "node $1" ;; *) suite "$1" "uv run $1" ;; esac
}

# Prints "<unit>\t<command>" per suite of the whole seam, in run order: lint,
# the shared checks, every finder's tests, every example's tests, the heavy
# tests, the soundness harnesses.
suites() {
  local f dir
  # Lint: StandardJS on the Node code, ruff (check + format check) on the
  # Python, and uv.lock still matching pyproject.toml. The verbatim original/
  # snippets are excluded by package.json's standard.ignore.
  printf 'always\t%s\n' \
    "npx standard" \
    "uvx ruff check examples" "uvx ruff check finders" \
    "uvx ruff format --check examples" "uvx ruff format --check finders" \
    "uv lock --check"
  for f in examples/_shared/*.test.mjs examples/_shared/*.test.py; do
    run_file "$f"
  done
  suite examples/_shared/check_layout.py "uv run examples/_shared/check_layout.py"
  for f in finders/**/test_*.py; do
    if listed "$finder_slow" "$f"; then continue
    elif listed "$finder_pytest" "$f"; then suite "$f" "uv run pytest $f -q"
    elif listed "$finder_cover" "$f"; then suite "$f" "uv run $f --cover"
    else run_file "$f"; fi
  done
  for dir in examples/*/; do
    [ "$dir" = examples/_shared/ ] && continue
    for f in "$dir"*.test.mjs "$dir"*.test.py; do
      listed "$heavy_fillomino $heavy_recovery" "$f" || run_file "$f"
    done
  done
  # A shipped Skyscrapers board, proved: one solve per global board.
  run_file examples/skyscraper/verify.py
  for f in $heavy_fillomino $heavy_recovery; do run_file "$f"; done
  for f in examples/*/soundness-harness.mjs; do run_file "$f"; done
}

# Where one changed file lands. Prints `unit <examples|finders>/<name>` when a
# unit owns it, `whole <why>` when the whole seam must run, and nothing when
# lint and the shared checks already cover it.
place() { # <file>
  local top name rest
  IFS=/ read -r top name rest <<<"$1"
  case $1 in
    *[[:space:]]*) echo "whole no rule places $1" ;;
    tests/all.sh | justfile | pyproject.toml | uv.lock | package.json | package-lock.json | .github/workflows/*)
      echo "whole every suite depends on $1" ;;
    examples/_shared/*)
      # A shared test is one of the shared checks, which always run; any other
      # shared file is code the examples load.
      case $rest in
        */* | "") echo "whole shared example code changed: $1" ;;
        *.test.mjs | *.test.py) ;;
        *) echo "whole shared example code changed: $1" ;;
      esac ;;
    finders/hunt/*) echo "whole finders/hunt/ changed: $1" ;;
    examples/*/* | finders/*/*) echo "unit $top/$name" ;;
    *.md) ;;
    *) echo "whole no rule places $1" ;;
  esac
}

# Reads the diff `<base>...HEAD` and sets `units` (the touched units, sorted)
# or `widened` (why the whole seam runs).
scope() { # <base>
  local files file kind what
  files=$(git diff --name-only --no-renames "$1...HEAD") || {
    echo "tests/all.sh: cannot diff $1...HEAD" >&2; exit 2; }
  units="" widened=""
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    read -r kind what <<<"$(place "$file")"
    case $kind in
      whole) widened=$what; return ;;
      unit) listed "$units" "$what" || units="$units $what" ;;
    esac
  done <<<"$files"
  units=$(printf '%s\n' $units | sort | xargs)
}

usage() { echo "usage: tests/all.sh [--list] [--changed <base>]" >&2; exit 2; }

list_only=0 base=""
while [ $# -gt 0 ]; do
  case $1 in
    --list) list_only=1; shift ;;
    --changed) [ $# -ge 2 ] || usage; base=$2; shift 2 ;;
    *) usage ;;
  esac
done

# The tree is globbed here and nowhere else; `set -f` holds everywhere else so
# a suite command is word-split without its path being expanded.
set +f; shopt -s nullglob globstar
all=$(suites)
set -f

selected=$all note=""
if [ -n "$base" ]; then
  scope "$base"
  if [ -n "$widened" ]; then
    note=" (widened: $widened)"
  else
    selected=$(awk -F'\t' -v keep=" always $units " 'index(keep, " " $1 " ")' <<<"$all")
    note=" (narrowed: ${units:-no example or finder touched})"
  fi
fi
selected=$(cut -f2 <<<"$selected")

if [ "$list_only" = 1 ]; then printf '%s\n' "$selected"; exit 0; fi

total=$(wc -l <<<"$all")
passed=0
while IFS= read -r suite; do
  if out=$($suite 2>&1 </dev/null); then
    echo "PASS $suite"
    passed=$((passed + 1))
  else
    echo "FAIL $suite"
    printf '%s\n' "$out"
    echo "$passed of $total suites passed before $suite failed"
    exit 1
  fi
done <<<"$selected"
echo "$passed of $total suites passed$note"
