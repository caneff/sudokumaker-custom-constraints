#!/usr/bin/env bash
# The seam runner: the one listing of the gate's suites. A suite is one
# command (`uv run <file>`, `node <file>`, one lint step), and it is its own
# label. With no flag this runs every suite `just check-full` runs. Files are
# found by glob from the tree on disk, so a new test needs no edit here; the
# lists below are the exceptions, and examples/_shared/gate.test.py checks
# them against the tree.
#
#   bash tests/all.sh [--list] [--changed <base>] [--group <group>]
#
# `--list` prints the suites the run would cover, one per line, and runs none.
#
# A suite Pants has a test target for is wired: it runs through Pants, in its
# sandbox, a folder holding only the files the suite's unit declared, so a
# read nobody declared fails the suite. The runner keeps no list of those
# suites. It asks Pants for its test targets, and the target of a suite is
# `<directory>:<file>` (tests/pants_prelude.py). Every other suite runs here,
# from the tree. A tree with a pants.toml and no working `pants` runs no
# suite and exits 2: a wired suite never runs outside its sandbox.
#
# `--changed <base>` narrows the run to what the diff `<base>...HEAD` could
# affect, and Pants is the one that says what that is:
#   - lint, always;
#   - a wired suite when Pants lists it among the dependents, at any distance,
#     of a file the diff changed or deleted. Pants knows a suite's imports and
#     the inputs its unit declared, and the sandbox holds nothing else, so a
#     file Pants does not connect to a suite is a file that suite cannot read.
#     A shared test is selected this way like any other, and so is a touched
#     example's soundness harness, which declares its whole unit. A suite that
#     declares the whole repository (`//:tree`) is selected by any change.
#     Every wired suite declares `//:runner` (this file, pants.toml, the
#     prelude and .gitignore, which Pants reads to leave files out of every
#     sandbox) and `//:uvproject`, so a change to one of those selects them
#     all. Pants also counts a change not yet committed;
#   - a suite Pants has no target for, always: nothing says what it reads.
#     Those are the tests on tests/sandbox-exceptions.txt and no other, which
#     examples/_shared/gate.test.py checks.
# No directory decides anything. The run widens to the whole seam when Pants
# gives no answer about the diff or one that cannot be read, when the tree has
# no pants.toml, when the diff deletes a file, and when Pants cannot place a
# path the diff changed; the last line then says why. A narrowed run never rests on no answer. Pants places a
# path when some target owns it: its answer then holds a target of that file.
# `//:tree` owns every file Pants reads, so in this repository the paths it
# cannot place are the ones pants.toml's `pants_ignore` names. A deleted file
# widens because Pants answers from the tree as it is now: there, a suite's
# import of a module that is gone resolves to nothing, so the suite that
# still imports it is not among the dependents Pants lists. Only the
# committed diff is checked for deletions and for placing. `--list` with `--changed` asks Pants the same question;
# `--list` alone asks nothing. The controller re-runs the whole seam on the
# merged result before every merge.
#
# `--group <group>` runs one group of the seam, which is how the justfile's
# recipes reach their suites: `lint`, `test` (every test but the heavy ones),
# `heavy-fillomino`, `heavy-recovery`, `soundness`.
#
# The suites that are not wired run first, one at a time, in listing order:
# one line per suite as it finishes (`PASS <suite>`); the first failing one
# prints `FAIL <suite>` and its whole output, and the run exits 1 there. The
# wired suites then run in one Pants call, since Pants takes about 2 s to
# start. Pants does not stop at the first failure, so that call runs all of
# them: `PASS <suite>` for each one Pants reports as passed, then `FAIL
# <suite>` and its output for every other, and exit 1. A wired suite Pants
# did not report is a failure. The last line states what ran: `N of M suites
# passed`, M being the whole seam (or the whole group), with `before <suite>
# failed` naming the first failure, followed by `(narrowed: <units>)` or
# `(widened: <why>)` on a `--changed` run and by `(group: <group>)` on a
# `--group` run. The units are those of the wired suites Pants selected.
#
# Every run that ran suites appends one JSON line to a log outside the
# checkout, a workspace being deleted after its merge: `$SEAM_RUNS_LOG`, else
# `${XDG_CACHE_HOME:-$HOME/.cache}/sudokumaker-custom-constraints/seam-runs.jsonl`.
# The line holds `time`, `sha` (HEAD, null when git cannot say), `base` (the `--changed` base or null),
# `mode` (`full`, `narrowed`, `widened`, or `group` when no base narrows it),
# `group`, `reason` (the `widened:` text or null), `passed` and `total` (the
# last line's N and M), `ok`, and `seconds` of wall clock. A log that cannot be
# written (no SEAM_RUNS_LOG and no XDG_CACHE_HOME or HOME to build it from, or
# an unwritable path) changes neither the exit status nor the last line: one
# stderr line names the failure. `--list` and a refused run ran nothing and log nothing.
set -uf
# A caller's GIT_DIR or GIT_INDEX_FILE (a git hook sets both) would point the
# diff below, and every suite that calls git, at that caller's repository.
unset GIT_DIR GIT_WORK_TREE GIT_INDEX_FILE GIT_COMMON_DIR GIT_OBJECT_DIRECTORY GIT_ALTERNATE_OBJECT_DIRECTORIES
# A relative SEAM_RUNS_LOG names a path from where the caller stands, not from
# the checkout this script moves into.
case ${SEAM_RUNS_LOG:-} in "" | /*) ;; *) SEAM_RUNS_LOG=$PWD/$SEAM_RUNS_LOG ;; esac
root=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd) || exit 1
cd "$root" || exit 1

# The heavy tests: an end-to-end generation run or a recovery probe over many
# boards, ten to twenty seconds each. Named as two groups so CI can run them
# as separate jobs (examples/_shared/ci_workflow.test.py checks this).
heavy_fillomino="examples/fillomino/pipeline.test.py examples/fillomino/generate.test.py"
heavy_recovery="examples/skyscraper/recovery-probe.test.mjs examples/hit-counts/recovery-probe.test.mjs"

listed() { case " $1 " in *" $2 "*) return 0 ;; esac; return 1; } # <list> <file>

# The unit that owns a test file: `examples/<name>`, the name a narrowed run's
# last line gives it. Lint belongs to `always`.
unit_of() { # <file>
  local top name
  IFS=/ read -r top name _ <<<"$1"
  echo "$top/$name"
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

# Pants writes a work directory (`.pants.d/`) into the tree it runs in, which
# is ignored content a workspace cannot be removed with. Every Pants call of a
# run gets one outside the tree instead, this run's own and removed when the
# run ends, so two runs share no state through it.
scratch=""
leave_no_workdir() {
  [ -z "$scratch" ] || return 0
  scratch=$(mktemp -d) || { echo "tests/all.sh: mktemp failed" >&2; exit 2; }
  trap 'rm -rf "$scratch"' EXIT
  export PANTS_WORKDIR=$scratch/workdir
}

json_str() { # <text>: prints it as a JSON string, or null when empty
  local t=$1
  [ -n "$t" ] || { printf null; return; }
  t=${t//\\/\\\\}; t=${t//\"/\\\"}; t=${t//$'\n'/\\n}; t=${t//$'\t'/\\t}
  printf '"%s"' "$t"
}

# Appends this run's row to the run log; `finish <status>` ends the run with it.
log_run() { # <exit status>
  local cache=${XDG_CACHE_HOME:-${HOME:+$HOME/.cache}}
  local log=${SEAM_RUNS_LOG:-${cache:+$cache/sudokumaker-custom-constraints/seam-runs.jsonl}}
  [ -n "$log" ] || {
    echo "tests/all.sh: could not write the run log: SEAM_RUNS_LOG, XDG_CACHE_HOME and HOME are all unset" >&2
    return; }
  local mode=full ok=false sha why
  if [ -n "$base" ]; then
    mode=narrowed; [ -z "$widened" ] || mode=widened
  elif [ -n "$group" ]; then
    mode=group
  fi
  [ "$1" != 0 ] || ok=true
  sha=$(git rev-parse HEAD 2>/dev/null) || sha=""
  why=$({
    mkdir -p "${log%/*}" &&
      printf '{"time":%s,"sha":%s,"base":%s,"mode":"%s","group":%s,"reason":%s,"passed":%s,"total":%s,"ok":%s,"seconds":%s}\n' \
        "$(json_str "$(printf '%(%Y-%m-%dT%H:%M:%S%z)T' -1)")" "$(json_str "$sha")" "$(json_str "$base")" \
        "$mode" "$(json_str "$group")" "$(json_str "$widened")" "$passed" "$total" "$ok" "$SECONDS" >>"$log"
  } 2>&1) || echo "tests/all.sh: could not write the run log $log: ${why:-failed}" >&2
}

finish() { # <exit status>
  log_run "$1"
  exit "$1"
}

in_lines() { case $'\n'"$1"$'\n' in *$'\n'"$2"$'\n'*) return 0 ;; esac; return 1; } # <lines> <line>

# The one question "which suites are wired": sets `wired` to Pants's test
# targets, one address per line, and returns non-zero, with what Pants said in
# `$scratch/err`, when Pants fails or its answer is not a list of addresses
# that holds at least one of this tree's suites. An answer that named none of
# them would read as "nothing is wired" and send every suite out of its
# sandbox.
which_are_wired() {
  local line suite
  leave_no_workdir
  wired=$(pants --filter-target-type=test_shell_command list :: 2>"$scratch/err" </dev/null) ||
    { wired=""; return 1; }
  while IFS= read -r line; do
    case $line in "" | *:*) ;; *)
      echo "not a target address: $line" >"$scratch/err"; wired=""; return 1 ;;
    esac
  done <<<"$wired"
  while IFS=$'\t' read -r _ _ suite; do
    [ -z "$suite" ] || ! in_lines "$wired" "$(target_of "$suite")" || return 0
  done <<<"$seam"
  echo "Pants named no suite of this tree as a test target; it said: ${wired:-nothing}" >"$scratch/err"
  wired=""; return 1
}

# Sets `wired` for a run, or runs nothing: no suite is run on no answer.
ask_pants() {
  command -v pants >/dev/null || {
    echo "tests/all.sh: this tree has a pants.toml and no \`pants\` is on the PATH." \
      "Install the Pants launcher (https://www.pantsbuild.org/stable/docs/getting-started/installing-pants);" \
      "a suite wired into Pants never runs outside its sandbox, so no suite was run." >&2
    exit 2; }
  which_are_wired || {
    echo "tests/all.sh: \`pants list\` failed, so the suites wired into Pants are not known and no suite was run:" >&2
    cat "$scratch/err" >&2; exit 2; }
}

# Asks Pants what the diff `<base>...HEAD` reaches: the targets that own a
# file the diff changed, and every target that depends on one, at any
# distance. Sets `wired` and `affected`, one address per line each; the
# wired suites among `affected` are the ones the diff selects. Sets `widened`
# instead when the diff deletes a file, when there is no Pants to ask, when
# Pants gives no answer or one that is not a list of addresses, and when the
# answer holds no target of a changed file (`//<file>:<target>` or
# `<file>:<target>`): no target owns that file, so Pants cannot place it.
ask_what_changed() { # <base>
  local changed line file
  changed=$(git diff --name-only --no-renames "$1...HEAD") || {
    echo "tests/all.sh: cannot diff $1...HEAD" >&2; exit 2; }
  [ -e pants.toml ] || {
    widened="no pants.toml, so nothing says what the diff affects"; return; }
  while IFS= read -r file; do
    [ -z "$file" ] || [ -e "$file" ] || [ -L "$file" ] || {
      widened="$file was deleted, and Pants cannot say what read it"; return; }
  done <<<"$changed"
  command -v pants >/dev/null || {
    widened="no Pants to say what the diff affects"
    echo "tests/all.sh: this tree has a pants.toml and no \`pants\` is on the PATH, so the run is not narrowed." >&2
    return; }
  which_are_wired || {
    widened="Pants could not say which suites are wired"
    cat "$scratch/err" >&2; return; }
  affected=$(pants --changed-since="$1" --changed-dependents=transitive \
    list 2>"$scratch/err" </dev/null) || {
    widened="Pants could not say what the diff affects"
    cat "$scratch/err" >&2; return; }
  while IFS= read -r line; do
    case $line in "" | *:*) ;; *) widened="Pants's answer cannot be read: $line"; return ;; esac
  done <<<"$affected"
  while IFS= read -r file; do
    [ -n "$file" ] || continue
    case $'\n'"$affected" in
      *$'\n'"$file:"* | *$'\n'"//$file:"*) ;;
      *) widened="Pants cannot place $file"; return ;;
    esac
  done <<<"$changed"
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
seam=$all # every suite of the tree, whatever group or diff narrows the run

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

# A narrowed run keeps lint, every suite Pants has no target for, and the
# wired suites Pants says the diff reaches.
selected=$all wired="" affected="" widened=""
if [ -n "$base" ]; then
  ask_what_changed "$base"
  if [ -n "$widened" ]; then
    note="$note (widened: $widened)"
  else
    selected="" units=""
    while IFS=$'\t' read -r unit suite; do
      [ -n "$suite" ] || continue
      if in_lines "$wired" "$(target_of "$suite")"; then
        in_lines "$affected" "$(target_of "$suite")" || continue
        listed "$units" "$unit" || units="$units $unit"
      fi
      selected="$selected$unit"$'\t'"$suite"$'\n'
    done <<<"$all"
    units=$(printf '%s\n' $units | sort)
    units=${units//$'\n'/ }
    note="$note (narrowed: ${units:-no wired suite})"
  fi
fi
selected=$(cut -f2 <<<"$selected")

if [ "$list_only" = 1 ]; then [ -z "$selected" ] || printf '%s\n' "$selected"; exit 0; fi

if [ -z "$wired" ] && [ -e pants.toml ] && grep -qE '^(uv run|node) ' <<<"$selected"; then
  ask_pants
fi

total=$(grep -c . <<<"$all")
passed=0
batch="" targets=""
while IFS= read -r suite; do
  [ -n "$suite" ] || continue
  if in_lines "$wired" "$(target_of "$suite")"; then
    batch="$batch$suite"$'\n' targets="$targets $(target_of "$suite")"
    continue
  fi
  if out=$($suite 2>&1 </dev/null); then
    echo "PASS $suite"
    passed=$((passed + 1))
  else
    echo "FAIL $suite"
    printf '%s\n' "$out"
    echo "$passed of $total suites passed before $suite failed$note"
    finish 1
  fi
done <<<"$selected"

# uv builds a wired suite's environment inside the sandbox. It is told to
# build it from the interpreter the tree's own environment was built from, so
# a suite gets one Python inside the sandbox and outside it. Left to search,
# uv takes what the sandbox's PATH offers or downloads the newest CPython.
# Read here, after the suites above: in a tree with no environment yet, the
# first `uv run` among them is what builds it.
python=""
[ ! -x .venv/bin/python ] || python=$(readlink -f .venv/bin/python)

# The wired suites, in one Pants call. A suite passed when Pants printed its
# result line, `✓ <target> succeeded in <time>.`, and in no other case: one
# Pants was asked to run and did not report is a failure.
if [ -n "$batch" ]; then
  out=$([ -z "$python" ] || export UV_PYTHON=$python
    pants test $targets 2>&1 </dev/null)
  status=$?
  succeeded=$(awk '$1 == "✓" && $3 == "succeeded" && NF == 5 { print $2 }' <<<"$out")
  failed=""
  while IFS= read -r suite; do
    [ -n "$suite" ] || continue
    if in_lines "$succeeded" "$(target_of "$suite")"; then
      echo "PASS $suite"
      passed=$((passed + 1))
    else
      failed="$failed$suite"$'\n'
    fi
  done <<<"$batch"
  shown=0
  while IFS= read -r suite; do
    [ -n "$suite" ] || continue
    echo "FAIL $suite"
    # The suite's own output: Pants logs it under the line that says the
    # target failed, up to its next log line.
    if ! awk -v said="Completed: Test with shell command - $(target_of "$suite") (" '
      /^[0-9][0-9]:[0-9][0-9]:[0-9][0-9]\.[0-9][0-9] \[[A-Z]+\] / { show = index($0, said) > 0 }
      /^(✓|✕) / { show = 0 }
      show { print; found = 1 }
      END { exit !found }' <<<"$out"; then
      echo "tests/all.sh: Pants did not report $(target_of "$suite") as passed or as failed."
      [ "$shown" = 1 ] || { echo "All Pants printed:"; printf '%s\n' "$out"; }
      shown=1
    fi
  done <<<"$failed"
  if [ -n "$failed" ]; then
    echo "$passed of $total suites passed before ${failed%%$'\n'*} failed$note"
    finish 1
  fi
  [ "$status" = 0 ] || {
    echo "tests/all.sh: \`pants test\` exited $status with every suite reported as passed:"
    printf '%s\n' "$out"
    echo "$passed of $total suites passed before \`pants test\` failed$note"
    finish 1; }
fi
echo "$passed of $total suites passed$note"
finish 0
