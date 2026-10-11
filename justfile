# One obvious entrypoint for the gate, in two tiers (#411). `check` is the
# loop: lint and every test except the heavy ones, about half a minute.
# `check-full` is everything, and CI runs it on every pull request.

# Fast gate, for the build loop: lint and the unit tests.
[doc("Fast gate for the build loop: lint plus every test except the heavy ones, about 30 s.")]
check: lint test

# Full gate (run before opening a PR): the fast gate, the heavy tests, and the
# soundness fuzz. Covers every step `check` runs.
[doc("Full gate before a PR: check, the heavy tests, and the soundness fuzz.")]
check-full: check test-heavy soundness

# The heavy tests: an end-to-end generation run or a recovery probe over many
# boards, ten to twenty seconds each. `test` skips them by path and
# `test-heavy` runs them; examples/_shared/gate.test.py fails if a test file
# drops out of both, or if this list and the ruling in #411 part ways.
# Named as two groups so CI can run them as separate jobs
# (examples/_shared/ci_workflow.test.py checks this); `test-heavy` runs both,
# in order, for `just check-full` locally.
heavy-fillomino := "examples/fillomino/pipeline.test.py examples/fillomino/generate.test.py"
heavy-recovery := "examples/skyscraper/recovery-probe.test.mjs examples/hit-counts/recovery-probe.test.mjs"
heavy := heavy-fillomino + " " + heavy-recovery

# Finder tests (#662): `test` runs every finders/**/test_*.py it finds, so a
# new one needs no edit here. These lists are the exceptions;
# examples/_shared/gate.test.py checks them against the tree.
#   finder-slow:   left to `just test-finders-slow`, never run by `test`.
#   finder-cover:  run with `--cover` (a subset) by `test`, in full by
#                  `test-finders-slow`.
#   finder-pytest: the pytest suites, run as `uv run pytest <file> -q`.
# The two research .test.mjs files (docs/research/) run by hand; gate.test.py
# names them in BY_HAND.
finder-slow := "finders/renbanana/tools/test_prove_two_stage_slow.py"
finder-cover := "finders/renbanana/tools/test_probe_circle_pattern_accepts_known_grids.py finders/renbanana/tools/test_probe_finds_known_grids.py"
finder-pytest := "finders/counting_shaded/test_counting_shaded.py"

# Lint the Node code (StandardJS) and the Python generators (ruff check +
# format check), and fail when uv.lock no longer matches pyproject.toml. The
# verbatim original/ snippets are excluded.
[doc("Lint the Node and Python code and check uv.lock matches pyproject.toml.")]
lint:
    npx standard
    uvx ruff check examples
    uvx ruff check finders
    uvx ruff format --check examples
    uvx ruff format --check finders
    uv lock --check

# Auto-fix + format in place.
[doc("Auto-fix and format the Node and Python code in place.")]
fmt:
    npx standard --fix
    uvx ruff check --fix examples
    uvx ruff check --fix finders
    uvx ruff format examples
    uvx ruff format finders

# Every example's own tests except the heavy ones above, discovered by file
# name so a new example needs no edit here. See docs/example-layout.md.
# Builders (build_*.py) do not run here — only files named *.test.mjs /
# *.test.py. A verify.py runs here only when it is cheap:
# skyscraper's is one solve and is wired in below, isofill's searches for
# minutes and stays behind `just verify-isofill` (see there).
#
# Python runs in the one project environment (pyproject.toml, uv.lock), with
# ortools in it so a test can prove uniqueness the way the
# generators do. Keep such a test to a handful of single solves — a 4x4, a 9x9,
# skyscraper's sweep of its global boards (about two seconds): a full
# carve is minutes, and this gate has to stay fast enough to run before every
# commit.
[doc("Every unit test except the heavy and slow ones, found by glob.")]
test:
    #!/usr/bin/env bash
    set -euo pipefail
    shopt -s nullglob
    # Every shared test, by glob: a new one needs no edit here. JUST is for
    # the tests that run recipes themselves (gate_lib.commands).
    export JUST="{{just_executable()}}"
    for f in examples/_shared/*.test.mjs; do node "$f"; done
    for f in examples/_shared/*.test.py; do uv run "$f"; done
    # Every finder test, by glob (#662). Cost, for the box's sake: the
    # renbanana tests are under 10 s each (test_max_house_circles.py is one
    # CP-SAT solve pinned to one worker; the two --cover subsets are about 7 s
    # and 25 s, one grid per shape, so an over-constrained encoding fails CI
    # -- #498, #501); hunt's are a few seconds each with workers pinned to 1,
    # test_spec_483_e2e.py about six; qqrr's total about ten; the
    # galaxy-copycat human solver about 1.5 s; ubahn's brute-force agreement
    # about 22 s (one-worker solves that list a 4x4 and a 3x4 space under
    # both connectivity encodings), its hunt test about 5 s, its Penpa+ encoder
    # test (#774) about 6 s, its PySAT agreement (#776) about 6 s and its
    # baseline-measurement test (#777) about 4 s;
    # counting_shaded is the one
    # pytest suite in the repo, about 3 s, and compiles its C filter with the
    # system cc to check it against the Python one.
    shopt -s globstar
    for f in finders/**/test_*.py; do
        case " {{finder-slow}} " in *" $f "*) continue ;; esac
        case " {{finder-pytest}} " in *" $f "*) uv run pytest "$f" -q; continue ;; esac
        case " {{finder-cover}} " in *" $f "*) uv run "$f" --cover; continue ;; esac
        uv run "$f"
    done
    for dir in examples/*/; do
        name=$(basename "$dir")
        [ "$name" = "_shared" ] && continue
        for f in "$dir"*.test.mjs "$dir"*.test.py; do
            case " {{heavy}} " in *" $f "*) continue ;; esac
            case "$f" in
                *.mjs) node "$f" ;;
                *) uv run "$f" ;;
            esac
        done
    done
    uv run examples/_shared/check_layout.py
    uv run examples/skyscraper/verify.py

# finders/renbanana's slow tests: the two --cover tests in full plus the slow
# two-stage proof, a CP-SAT solve per known grid, minutes overall. Not part of
# check/check-full; run by hand after touching probe_inverted.py,
# probe_circle_pattern.py or prove_two_stage.py.
[doc("Slow finder tests (a CP-SAT solve per known grid), by hand, minutes overall.")]
test-finders-slow: (_run-tests finder-cover + " " + finder-slow)

# Run one space-separated list of test files, dispatching by extension.
_run-tests files:
    #!/usr/bin/env bash
    set -euo pipefail
    for f in {{files}}; do
        case "$f" in
            *.mjs) node "$f" ;;
            *) uv run "$f" ;;
        esac
    done

# The heavy tests `test` skips, run by `check-full`, as two CI-sized groups:
# the fillomino pipeline (37s) and the two recovery probes (21s).
[doc("Heavy group 1: the fillomino pipeline and generator tests, about 37 s.")]
test-heavy-fillomino: (_run-tests heavy-fillomino)

[doc("Heavy group 2: the skyscraper and hit-counts recovery probes, about 21 s.")]
test-heavy-recovery: (_run-tests heavy-recovery)

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
    #!/usr/bin/env bash
    set -euo pipefail
    for dir in examples/*/; do
        name=$(basename "$dir")
        [ "$name" = "_shared" ] && continue
        f="$dir"soundness-harness.mjs
        if [ -f "$f" ]; then
            node "$f"
        else
            echo "skip: $name has no soundness-harness.mjs"
        fi
    done

# Real-app timing for one example: baseline (committed PUZZLE_LINK.txt) vs a
# candidate built from the working-tree component, on the recorded app (HAR
# replay; SM_LIVE=1 re-records). Prints one paste-ready row. Not part of
# `check` -- it drives a browser. See docs/real-app-timing.md.
# Links are stripped to their givens first. An edge-clue example (skyscraper,
# numbered-rooms) keeps its ring: just time skyscraper --ring-clues
[doc("Real-app timing of one example on the recorded app (HAR replay of sudokumaker.app; SM_LIVE=1 re-records it); prints a paste-ready row.")]
time example *flags:
    uv run examples/_shared/time_example.py {{example}} {{flags}}
