#!/usr/bin/env bash
# The seam runner: the one listing of the gate's suites. A suite is one
# command (`uv run <file>`, `node <file>`, one lint step), and it is its own
# label. With no flag this runs every suite `just check-full` runs, one at a
# time, in the same order. Files are found by glob from the tree
# on disk, so a new test needs no edit here; the lists below are the
# exceptions, and examples/_shared/gate.test.py checks them against the tree.
# A new shared test takes one line in tests/shared-tests.txt, its class for a
# narrowed run, and examples/_shared/seam_runner.test.py fails until it has it.
#
#   bash tests/all.sh [--list] [--changed <base>] [--group <group>]
#
# `--list` prints the suites the run would cover, one per line, and runs none.
#
# `--changed <base>` narrows the run to what the diff `<base>...HEAD` could
# affect, by directory and not by import scan:
#   - lint and the tree checks, always: the tests under examples/_shared/
#     that tests/shared-tests.txt classes `tree`, or gives no class;
#   - the shared example-code tests, which it classes `code`, unless the diff
#     lies wholly inside finders/<name>/ directories;
#   - every suite of each examples/<name>/ and finders/<name>/ the diff
#     touches: its tests, its heavy tests and its soundness harness;
#   - every suite of a unit that tests/suite-edges.txt says reads a touched
#     directory.
# It widens to the whole seam when the diff touches what every suite depends
# on (`place` below names those paths) or a path no rule places. A Markdown
# file outside an example or a finder selects no unit, and keeps the shared
# example-code tests. So a finder-only run covers lint, the tree checks, that
# finder's suites and the suites of each unit tests/suite-edges.txt says
# reads it. The narrowing runs too little when a suite reads another unit's
# directory that tests/suite-edges.txt does not list, a Markdown file outside
# its unit that `place` does not name, or, for a shared test classed `code`,
# a file under finders/; the controller re-runs the whole seam on the
# merged result before every merge.
#
# `--group <group>` runs one group of the seam, which is how the justfile's
# recipes reach their suites: `lint`, `test` (every test but the heavy ones),
# `heavy-fillomino`, `heavy-recovery`, `soundness`. `finders-slow` is a group
# outside the seam, run by hand through `just test-finders-slow`.
#
# One line per suite as it finishes (`PASS <suite>`); the first failing suite
# prints `FAIL <suite>` and its whole output, and the run exits 1 there. The
# last line states what ran: `N of M suites passed`, M being the whole seam
# (or the whole group), followed by `(narrowed: <units>)` or `(widened: <why>)`
# on a `--changed` run and by `(group: <group>)` on a `--group` run.
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
#   finder_slow:   the `finders-slow` group only (a CP-SAT solve per known
#                  grid, minutes overall).
#   finder_cover:  run with `--cover` (a subset, one grid per shape) in the
#                  seam, and in full in the `finders-slow` group.
#   finder_pytest: the pytest suites, run as `uv run pytest <file> -q`.
finder_slow="finders/renbanana/tools/test_prove_two_stage_slow.py"
finder_cover="finders/renbanana/tools/test_probe_circle_pattern_accepts_known_grids.py finders/renbanana/tools/test_probe_finds_known_grids.py"
finder_pytest="finders/counting_shaded/test_counting_shaded.py"

listed() { case " $1 " in *" $2 "*) return 0 ;; esac; return 1; } # <list> <file>

# The shared example-code tests: the files tests/shared-tests.txt classes
# `code`.
[ -r tests/shared-tests.txt ] || {
  echo "tests/all.sh: cannot read tests/shared-tests.txt" >&2; exit 2; }
code_tests=""
while read -r file class _ || [ -n "$file" ]; do
  case $file in "" | "#"*) continue ;; esac
  case $class in
    tree) ;;
    code) code_tests="$code_tests $file" ;;
    *) echo "tests/all.sh: tests/shared-tests.txt: not '<file> tree|code': $file $class" >&2; exit 2 ;;
  esac
done <tests/shared-tests.txt

# The unit that owns a test file: `examples/<name>` or `finders/<name>`, the
# directory a `--changed` run selects it by. A shared example-code test
# belongs to `code`; lint and every other shared test belong to `always`.
unit_of() { # <file>
  local top name
  IFS=/ read -r top name _ <<<"$1"
  if [ "$top/$name" != examples/_shared ]; then echo "$top/$name"
  elif listed "$code_tests" "$1"; then echo code
  else echo always; fi
}

emit() { printf '%s\t%s\t%s\n' "$1" "$(unit_of "$2")" "$3"; } # <group> <file> <command>

run_file() { # <group> <file>: prints the suite that runs a test file
  case $2 in *.mjs) emit "$1" "$2" "node $2" ;; *) emit "$1" "$2" "uv run $2" ;; esac
}

# Prints "<group>\t<unit>\t<command>" per suite, in run order: lint, the shared
# tests, every finder's tests, every example's tests, the heavy tests, the
# soundness harnesses, and last the slow finder tests no seam run includes.
suites() {
  local f dir
  # Lint: StandardJS on the Node code, ruff (check + format check) on the
  # Python, and uv.lock still matching pyproject.toml. The verbatim original/
  # snippets are excluded by package.json's standard.ignore.
  printf 'lint\talways\t%s\n' \
    "npx standard" \
    "uvx ruff check examples" "uvx ruff check finders" \
    "uvx ruff format --check examples" "uvx ruff format --check finders" \
    "uv lock --check"
  for f in examples/_shared/*.test.mjs examples/_shared/*.test.py; do
    run_file test "$f"
  done
  run_file test examples/_shared/check_layout.py
  # Cost, for the box's sake: the renbanana tests are under 10 s each
  # (test_max_house_circles.py is one CP-SAT solve pinned to one worker; the
  # two --cover subsets are about 7 s and 25 s, so an over-constrained
  # encoding fails CI -- #498, #501); hunt's are a few seconds each with
  # workers pinned to 1, test_spec_483_e2e.py about six; qqrr's total about
  # ten; the galaxy-copycat human solver about 1.5 s; ubahn's brute-force
  # agreement about 28 s (one-worker solves that list a 4x4 and a 3x4 space
  # under both connectivity encodings, and the hybrid's whole-4x4 counts,
  # #782, about 6 s of it), its hunt test about 5 s, its Penpa+
  # encoder test (#774) about 6 s, its PySAT agreement (#776) about 6 s and
  # its baseline-measurement test (#777) about 4 s; the hybrid's CP-SAT
  # engine against those counts about 15 s and its finder's CLI about 25 s
  # (#783, one-worker solves; some 40 short subprocess starts), the two PySAT
  # engines against the same counts about 17 s and on the CLI about 18 s
  # (#784, #785; one CaDiCaL thread), its three-engine timing test (#786)
  # about 1 s, its picture test (#791) about 4 s (no solver) and its
  # end-to-end chain (#781) about 11 s; counting_shaded is the one
  # pytest suite in the repo, about 3 s, and compiles its C filter with the
  # system cc to check it against the Python one.
  for f in finders/**/test_*.py; do
    if listed "$finder_slow" "$f"; then continue
    elif listed "$finder_pytest" "$f"; then emit test "$f" "uv run pytest $f -q"
    elif listed "$finder_cover" "$f"; then emit test "$f" "uv run $f --cover"
    else run_file test "$f"; fi
  done
  for dir in examples/*/; do
    [ "$dir" = examples/_shared/ ] && continue
    for f in "$dir"*.test.mjs "$dir"*.test.py; do
      listed "$heavy_fillomino $heavy_recovery" "$f" || run_file test "$f"
    done
  done
  # A shipped Skyscrapers board, proved: one solve per global board.
  run_file test examples/skyscraper/verify.py
  for f in $heavy_fillomino; do run_file heavy-fillomino "$f"; done
  for f in $heavy_recovery; do run_file heavy-recovery "$f"; done
  for f in examples/*/soundness-harness.mjs; do run_file soundness "$f"; done
  for f in $finder_cover $finder_slow; do run_file finders-slow "$f"; done
}

# Where one changed file lands. Prints `unit <examples|finders>/<name>` when a
# unit owns it, `whole <why>` when the whole seam must run, and nothing when
# lint and the shared tests already cover it.
place() { # <file>
  local top name rest
  IFS=/ read -r top name rest <<<"$1"
  case $1 in
    *[[:space:]]*) echo "whole no rule places $1" ;;
    # docs/builtin-components.md is the one Markdown file code reads: the
    # shared component scan takes the built-in component list from it.
    tests/all.sh | tests/suite-edges.txt | tests/shared-tests.txt | justfile | pyproject.toml | uv.lock | package.json | package-lock.json | .github/workflows/* | docs/builtin-components.md)
      echo "whole every suite depends on $1" ;;
    examples/_shared/*)
      # A changed shared test selects no unit and keeps the shared
      # example-code tests in the run; any other shared file is code the
      # examples load.
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

# Reads the diff `<base>...HEAD` and sets `units` (the touched units and the
# units that read them, sorted) or `widened` (why the whole seam runs), and
# `code` (`code`, or empty when every changed file is a finder's, which
# leaves the shared example-code tests out of the run).
scope() { # <base>
  local files file kind what source reader touched
  [ -r tests/suite-edges.txt ] || {
    echo "tests/all.sh: cannot read tests/suite-edges.txt" >&2; exit 2; }
  files=$(git diff --name-only --no-renames "$1...HEAD") || {
    echo "tests/all.sh: cannot diff $1...HEAD" >&2; exit 2; }
  units="" widened="" code=""
  [ -n "$files" ] || code=code
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    read -r kind what <<<"$(place "$file")"
    case "$kind $what" in "unit finders/"*) ;; *) code=code ;; esac
    case $kind in
      whole) widened=$what; return ;;
      unit) listed "$units" "$what" || units="$units $what" ;;
    esac
  done <<<"$files"
  # One step only: a reader's own files did not change, so what reads the
  # reader is not affected.
  touched=$units
  while read -r source reader _ || [ -n "$source" ]; do
    case $source in "" | "#"*) continue ;; esac
    [ -n "$reader" ] || {
      echo "tests/all.sh: tests/suite-edges.txt: not '<directory read> <unit>': $source" >&2; exit 2; }
    listed "$touched" "$source" && ! listed "$units" "$reader" && units="$units $reader"
  done <tests/suite-edges.txt
  units=$(printf '%s\n' $units | sort | xargs)
}

usage() { # <what is wrong>
  echo "tests/all.sh: $1" >&2
  echo "usage: tests/all.sh [--list] [--changed <base>] [--group <group>]" >&2
  exit 2
}

list_only=0 base="" group=""
while [ $# -gt 0 ]; do
  case $1 in
    --list) list_only=1; shift ;;
    --changed | --group)
      [ $# -ge 2 ] || usage "$1 needs a value"
      if [ "$1" = --changed ]; then base=$2; else group=$2; fi
      shift 2 ;;
    *) usage "no flag named $1" ;;
  esac
done

# The tree is globbed here and nowhere else; `set -f` holds everywhere else so
# a suite command is word-split without its path being expanded.
set +f; shopt -s nullglob globstar
all=$(suites)
set -f

if [ -n "$group" ]; then
  case $group in
    lint | test | heavy-fillomino | heavy-recovery | soundness | finders-slow) ;;
    *) usage "no group named $group" ;;
  esac
  all=$(awk -F'\t' -v group="$group" '$1 == group' <<<"$all")
  note=" (group: $group)"
else
  all=$(awk -F'\t' '$1 != "finders-slow"' <<<"$all")
  note=""
fi
all=$(cut -f2- <<<"$all")

selected=$all
if [ -n "$base" ]; then
  scope "$base"
  if [ -n "$widened" ]; then
    note="$note (widened: $widened)"
  else
    selected=$(awk -F'\t' -v keep=" always $code $units " 'index(keep, " " $1 " ")' <<<"$all")
    note="$note (narrowed: ${units:-no example or finder touched})"
  fi
fi
selected=$(cut -f2 <<<"$selected")

if [ "$list_only" = 1 ]; then [ -z "$selected" ] || printf '%s\n' "$selected"; exit 0; fi

total=$(grep -c . <<<"$all")
passed=0
while IFS= read -r suite; do
  [ -n "$suite" ] || continue
  if out=$($suite 2>&1 </dev/null); then
    echo "PASS $suite"
    passed=$((passed + 1))
  else
    echo "FAIL $suite"
    printf '%s\n' "$out"
    echo "$passed of $total suites passed before $suite failed$note"
    exit 1
  fi
done <<<"$selected"
echo "$passed of $total suites passed$note"
