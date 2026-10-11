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
# One line per suite as it finishes (`PASS <suite>`); the first failing suite
# prints `FAIL <suite>` and its whole output, and the run exits 1 there. The
# last line states what ran: `N of M suites passed`, M being the whole seam.
set -uf
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

run_file() { # <file>: prints the command that runs a test file
  case $1 in *.mjs) echo "node $1" ;; *) echo "uv run $1" ;; esac
}

# Prints "<command>" per suite of the whole seam, in run order: lint, the
# shared checks, every finder's tests, every example's tests, the heavy tests,
# the soundness harnesses.
suites() {
  local f dir
  # Lint: StandardJS on the Node code, ruff (check + format check) on the
  # Python, and uv.lock still matching pyproject.toml. The verbatim original/
  # snippets are excluded by package.json's standard.ignore.
  printf '%s\n' \
    "npx standard" \
    "uvx ruff check examples" "uvx ruff check finders" \
    "uvx ruff format --check examples" "uvx ruff format --check finders" \
    "uv lock --check"
  for f in examples/_shared/*.test.mjs examples/_shared/*.test.py; do
    run_file "$f"
  done
  echo "uv run examples/_shared/check_layout.py"
  for f in finders/**/test_*.py; do
    if listed "$finder_slow" "$f"; then continue
    elif listed "$finder_pytest" "$f"; then echo "uv run pytest $f -q"
    elif listed "$finder_cover" "$f"; then echo "uv run $f --cover"
    else run_file "$f"; fi
  done
  for dir in examples/*/; do
    [ "$dir" = examples/_shared/ ] && continue
    for f in "$dir"*.test.mjs "$dir"*.test.py; do
      listed "$heavy_fillomino $heavy_recovery" "$f" || run_file "$f"
    done
  done
  # A shipped Skyscrapers board, proved: one solve per global board.
  echo "uv run examples/skyscraper/verify.py"
  for f in $heavy_fillomino $heavy_recovery; do run_file "$f"; done
  for f in examples/*/soundness-harness.mjs; do run_file "$f"; done
}

usage() { echo "usage: tests/all.sh [--list] [--changed <base>]" >&2; exit 2; }

list_only=0
while [ $# -gt 0 ]; do
  case $1 in
    --list) list_only=1; shift ;;
    *) usage ;;
  esac
done

# The tree is globbed here and nowhere else; `set -f` holds everywhere else so
# a suite command is word-split without its path being expanded.
set +f; shopt -s nullglob globstar
all=$(suites)
set -f

if [ "$list_only" = 1 ]; then printf '%s\n' "$all"; exit 0; fi

total=$(printf '%s\n' "$all" | wc -l)
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
done <<<"$all"
echo "$passed of $total suites passed"
