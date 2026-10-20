# One obvious entrypoint for the gate, in two tiers (#411). `check` is the
# loop: lint and every test except the heavy ones, about 1¾ min.
# `check-full` is everything, and CI runs it nightly (a push or pull request runs the narrowed seam).

# Fast gate, for the build loop: lint and the unit tests.
[doc("Fast gate for the build loop: lint plus every test except the heavy ones, about 1¾ min.")]
check: lint test

# Full gate (run before opening a PR): the fast gate, the heavy tests, and the
# soundness fuzz. Covers every step `check` runs.
[doc("Full gate before a PR: check, the heavy tests, and the soundness fuzz.")]
check-full: check test-heavy soundness

# The suites live in one place, tests/all.sh: every recipe below that runs
# tests calls it with the group it wants, so the gate and a worker's narrowed
# run (`bash tests/all.sh --changed <base>`) read the same listing. The heavy
# list is there too.

# Lint the Node code (StandardJS) and the Python generators (ruff check +
# format check), and fail when uv.lock no longer matches pyproject.toml. The
# verbatim original/ snippets are excluded.
[doc("Lint the Node and Python code and check uv.lock matches pyproject.toml.")]
lint:
    bash tests/all.sh --group lint

# Auto-fix + format in place.
[doc("Auto-fix and format the Node and Python code in place.")]
fmt:
    npx standard --fix
    uvx ruff check --fix examples
    uvx ruff format examples

# Every shared and example test except the heavy ones tests/all.sh
# names, discovered by file name so a new example needs no edit here. See
# docs/example-layout.md. Builders (build_*.py) do not run here — only files
# named *.test.mjs / *.test.py. A verify.py runs here only when it is cheap:
# skyscraper's and isofill-skyscraper's are a few solves and tests/all.sh names
# them, isofill's searches for minutes and stays behind `just verify-isofill`
# (see there).
#
# Python runs in the one project environment (pyproject.toml, uv.lock), with
# ortools in it so a test can prove uniqueness the way the
# generators do. Keep such a test to a handful of single solves — a 4x4, a 9x9,
# skyscraper's sweep of its global boards (about two seconds): a full
# carve is minutes, and this gate has to stay fast enough to run before every
# commit.
#
# JUST is for the tests that run recipes themselves (gate_lib.commands).
[doc("Every unit test except the heavy ones, found by glob.")]
test:
    JUST="{{just_executable()}}" bash tests/all.sh --group test

# The heavy tests `test` skips, run by `check-full`, as two CI-sized groups:
# the fillomino pipeline (37s) and the two recovery probes (21s).
[doc("Heavy group 1: the fillomino pipeline and generator tests, about 37 s.")]
test-heavy-fillomino:
    bash tests/all.sh --group heavy-fillomino

[doc("Heavy group 2: the skyscraper and hit-counts recovery probes, about 21 s.")]
test-heavy-recovery:
    bash tests/all.sh --group heavy-recovery

# Both heavy groups, in order -- what `check-full` runs locally.
[doc("Both heavy groups in order, what check-full runs locally.")]
test-heavy: test-heavy-fillomino test-heavy-recovery

# A shipped Skyscrapers board, proved: the committed link still decodes to the
# board its gen JSON records, that recorded solution really solves it, and it
# still has exactly one solution. One solve each, well under a second, so
# `test` above sweeps every global board this example ships — this recipe is
# the named entry point, and a size argument narrows it to one board. See
# examples/skyscraper/README.md, "Share checklist, walked".
[doc("Prove a shipped Skyscrapers board still decodes, solves and is unique.")]
verify-skyscraper size="9":
    uv run examples/skyscraper/verify.py {{size}}

# Manual, occasional uniqueness proof for isofill puzzles (slow CP-SAT solve).
# Not part of check/test/CI; run by hand after a puzzle change. Every
# gen*.json is proved, found by glob, so a new board needs no edit here. See
# examples/isofill/README.md.
[doc("Prove every isofill puzzle unique (slow CP-SAT solve), by hand.")]
verify-isofill:
    #!/usr/bin/env bash
    set -euo pipefail
    uv run examples/isofill/verify.py
    for f in examples/isofill/gen*.json; do
        echo "$f"
        uv run examples/isofill/verify.py "$f"
    done

# Soundness fuzz: every component keeps each cell's true value. The
# invariant. Discovered by file name, same convention as `test` above.
[doc("Soundness fuzz: every component keeps each cell's true value.")]
soundness:
    bash tests/all.sh --group soundness

# Real-app timing for one example: baseline (committed PUZZLE_LINK.txt) vs a
# candidate built from the working-tree component, on the recorded app (HAR
# replay; SM_LIVE=1 re-records). Prints one paste-ready row. Not part of
# `check` -- it drives a browser. See docs/real-app-timing.md.
# Links are stripped to their givens first. An edge-clue example (skyscraper,
# numbered-rooms) keeps its ring: just time skyscraper --ring-clues
[doc("Real-app timing of one example on the recorded app (HAR replay of sudokumaker.app; SM_LIVE=1 re-records it); prints a paste-ready row.")]
time example *flags:
    uv run examples/_shared/time_example.py {{example}} {{flags}}

# Real-app timing of any link file (inside or outside the repo): cold and
# after-logical rows, 3 reps each. Two links are interleaved and compared (b/a).
# The link is timed as given, never stripped. See docs/real-app-timing.md.
[doc("Real-app timing of any link file (two files: interleaved b/a comparison); prints cold and after-logical rows. Add --ring-clues for edge-clue boards.")]
[no-cd]
[positional-arguments]
time-link *args:
    uv run {{justfile_directory()}}/examples/_shared/time_link.py "$@"
