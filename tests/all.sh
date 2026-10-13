#!/usr/bin/env bash
# The seam runner: the one listing of the gate's suites. A suite is one
# command (`uv run <file>`, `node <file>`, one lint step), and it is its own
# label. With no flag this runs every suite `just check-full` runs, one at a
# time, in the same order. Files are found by glob from the tree
# on disk, so a new test needs no edit here; the lists below are the
# exceptions, and examples/_shared/gate.test.py checks them against the tree.
#
#   bash tests/all.sh [--list] [--changed <base>] [--group <group>]
#
# `--list` prints the suites the run would cover, one per line, and runs none.
#
# `--changed <base>` narrows the run to what the diff `<base>...HEAD` could
# affect, by directory and not by import scan:
#   - lint and the shared tests under examples/_shared/, always;
#   - every suite of each examples/<name>/ the diff touches: its tests, its
#     heavy tests and its soundness harness;
#   - every suite of a unit that tests/suite-edges.txt says reads a touched
#     directory.
# It widens to the whole seam when the diff touches what every suite depends
# on (`place` below names those paths) or a path no rule places. A Markdown
# file outside an example selects no unit. The narrowing runs too little when
# a suite reads another unit's directory that tests/suite-edges.txt does not
# list, or a Markdown file outside its unit that `place` does not name; the
# controller re-runs the whole seam on the merged result before every merge.
#
# A suite Pants has a test target for runs through Pants, in its sandbox: a
# folder holding only the files the suite's unit declared, so a read nobody
# declared fails the suite. The runner keeps no list of those suites. It asks
# Pants for its test targets on every run that holds a test file, and the
# target of a suite is `<directory>:<file>` (tests/pants_prelude.py). Every
# other suite runs here, from the tree. `--list` asks nothing. A tree with a
# pants.toml and no working `pants` runs no suite and exits 2: a wired suite
# never runs outside its sandbox.
#
# `--group <group>` runs one group of the seam, which is how the justfile's
# recipes reach their suites: `lint`, `test` (every test but the heavy ones),
# `heavy-fillomino`, `heavy-recovery`, `soundness`.
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

listed() { case " $1 " in *" $2 "*) return 0 ;; esac; return 1; } # <list> <file>

# The unit that owns a test file: `examples/<name>`, the directory a
# `--changed` run selects it by. Lint and the shared tests belong to `always`.
unit_of() { # <file>
  local top name
  IFS=/ read -r top name _ <<<"$1"
  if [ "$top/$name" != examples/_shared ]; then echo "$top/$name"
  else echo always; fi
}

run_file() { # <group> <file>: prints the suite that runs a test file
  local run="uv run"
  case $2 in *.mjs) run=node ;; esac
  printf '%s\t%s\t%s\n' "$1" "$(unit_of "$2")" "$run $2"
}

# Prints "<group>\t<unit>\t<command>" per suite, in run order: lint, the shared
# tests, every example's tests, the heavy tests and the soundness harnesses.
suites() {
  local f dir
  # Lint: StandardJS on the Node code, ruff (check + format check) on the
  # Python, and uv.lock still matching pyproject.toml. The verbatim original/
  # snippets are excluded by package.json's standard.ignore.
  printf 'lint\talways\t%s\n' \
    "npx standard" \
    "uvx ruff check examples" "uvx ruff format --check examples" \
    "uv lock --check"
  for f in examples/_shared/*.test.mjs examples/_shared/*.test.py; do
    run_file test "$f"
  done
  run_file test examples/_shared/check_layout.py
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
}

# Where one changed file lands. Prints `unit examples/<name>` when a
# unit owns it, `whole <why>` when the whole seam must run, and nothing when
# lint and the shared tests already cover it.
place() { # <file>
  local top name rest
  IFS=/ read -r top name rest <<<"$1"
  case $1 in
    *[[:space:]]*) echo "whole no rule places $1" ;;
    # docs/builtin-components.md is the one Markdown file code reads: the
    # shared component scan takes the built-in component list from it.
    tests/all.sh | tests/suite-edges.txt | justfile | pyproject.toml | uv.lock | package.json | package-lock.json | .github/workflows/* | docs/builtin-components.md)
      echo "whole every suite depends on $1" ;;
    examples/_shared/*)
      # A changed shared test selects no unit; any other shared file is code
      # the examples load.
      case $rest in
        */* | "") echo "whole shared example code changed: $1" ;;
        *.test.mjs | *.test.py) ;;
        *) echo "whole shared example code changed: $1" ;;
      esac ;;
    examples/*/*) echo "unit $top/$name" ;;
    *.md) ;;
    *) echo "whole no rule places $1" ;;
  esac
}

# Reads the diff `<base>...HEAD` and sets `units` (the touched units and the
# units that read them, sorted) or `widened` (why the whole seam runs).
scope() { # <base>
  local files file kind what source reader touched
  [ -r tests/suite-edges.txt ] || {
    echo "tests/all.sh: cannot read tests/suite-edges.txt" >&2; exit 2; }
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

# Sets `wired`: Pants's test targets, one address per line. Anything else
# Pants prints lands there too and matches no suite's target.
ask_pants() {
  command -v pants >/dev/null || {
    echo "tests/all.sh: this tree has a pants.toml and no \`pants\` is on the PATH." \
      "Install the Pants launcher (https://www.pantsbuild.org/stable/docs/getting-started/installing-pants);" \
      "a suite wired into Pants never runs outside its sandbox, so no suite was run." >&2
    exit 2; }
  wired=$(pants --filter-target-type=test_shell_command list :: 2>&1 </dev/null) || {
    echo "tests/all.sh: \`pants list\` failed, so the suites wired into Pants are not known and no suite was run:" >&2
    printf '%s\n' "$wired" >&2; exit 2; }
}

# The Pants target a suite's test file would have: `<directory>:<file>`.
target_of() { # <suite>
  local file=${1##* }
  echo "${file%/*}:${file##*/}"
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
set +f; shopt -s nullglob
all=$(suites)
set -f

if [ -n "$group" ]; then
  case $group in
    lint | test | heavy-fillomino | heavy-recovery | soundness) ;;
    *) usage "no group named $group" ;;
  esac
  all=$(awk -F'\t' -v group="$group" '$1 == group' <<<"$all")
  note=" (group: $group)"
else
  note=""
fi
all=$(cut -f2- <<<"$all")

selected=$all
if [ -n "$base" ]; then
  scope "$base"
  if [ -n "$widened" ]; then
    note="$note (widened: $widened)"
  else
    selected=$(awk -F'\t' -v keep=" always $units " 'index(keep, " " $1 " ")' <<<"$all")
    note="$note (narrowed: ${units:-no example touched})"
  fi
fi
selected=$(cut -f2 <<<"$selected")

if [ "$list_only" = 1 ]; then [ -z "$selected" ] || printf '%s\n' "$selected"; exit 0; fi

# uv builds a wired suite's environment inside the sandbox. It is told to
# build it from the interpreter the tree's own environment was built from, so
# a suite gets one Python inside the sandbox and outside it. Left to search,
# uv takes what the sandbox's PATH offers or downloads the newest CPython.
python=""
[ ! -x .venv/bin/python ] || python=$(readlink -f .venv/bin/python)

wired=""
if [ -e pants.toml ] && grep -qE '^(uv run|node) ' <<<"$selected"; then ask_pants; fi

total=$(grep -c . <<<"$all")
passed=0
while IFS= read -r suite; do
  [ -n "$suite" ] || continue
  run=$suite
  if grep -qxF -- "$(target_of "$suite")" <<<"$wired"; then
    run="env ${python:+UV_PYTHON=$python} pants test $(target_of "$suite")"
  fi
  if out=$($run 2>&1 </dev/null); then
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
