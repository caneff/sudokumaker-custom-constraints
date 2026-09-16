# One obvious entrypoint for the gate, in two tiers (#411). `check` is the
# loop: lint and every test except the heavy ones, about half a minute.
# `check-full` is everything, and CI runs it on every pull request.

# Fast gate, for the build loop: lint and the unit tests.
check: lint test

# Full gate (run before opening a PR): the fast gate, the heavy tests, and the
# soundness fuzz. Covers every step `check` runs.
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

# Lint the Node code (StandardJS) and the Python generators (ruff check +
# format check), and fail when uv.lock no longer matches pyproject.toml. The
# verbatim original/ snippets are excluded.
lint:
    npx standard
    uvx ruff check examples
    uvx ruff check finders
    uvx ruff format --check examples
    uvx ruff format --check finders
    uv lock --check

# Auto-fix + format in place.
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
test:
    #!/usr/bin/env bash
    set -euo pipefail
    shopt -s nullglob
    # Every shared test, by glob: a new one needs no edit here. JUST is for
    # the tests that run recipes themselves (gate_lib.commands).
    export JUST="{{just_executable()}}"
    for f in examples/_shared/*.test.mjs; do node "$f"; done
    for f in examples/_shared/*.test.py; do uv run "$f"; done
    # finders/renbanana's own tests (#469): four well under two seconds,
    # test_probe_circle_cost.py about a second (two model builds, no solve),
    # test_max_house_circles.py about 7s (a CP-SAT solve, pinned to one
    # worker -- this box is shared). The known-grid tests solve a CP-SAT
    # model per known grid and stay out of this gate, except the circle
    # pattern's --cover subset: six grids, about 7s, one per circled group
    # shape, so an over-constrained size encoding fails CI. The full runs
    # are `just test-finders-slow`.
    uv run finders/renbanana/tools/test_catalogue_is_used.py
    uv run finders/renbanana/tools/test_canon.py
    uv run finders/renbanana/tools/test_max_house_circles.py
    uv run finders/renbanana/tools/test_probe_known_solution.py
    uv run finders/renbanana/tools/test_prove_two_stage.py
    uv run finders/renbanana/tools/test_probe_circle_cost.py
    uv run finders/renbanana/tools/test_probe_circle_pattern_accepts_known_grids.py --cover
    # finders/hunt's own tests (#484, #485, #486, #487, #488, #489, #490):
    # the dedupe key's public function, neighbours and connected components
    # on hand-drawn boards, the text printer's output, the grid-drawing
    # base's image size and sampled pixels, the `hunt` CLI run in a
    # subprocess with the toy finders (fresh hunts and resume, resume's
    # sleeping briefly per seed so a kill lands mid-hunt without a timing
    # race; --no-verify then hunt verify DIR; the render hook writing one
    # PNG per example), the `--workers`/load gate, and the CP-SAT helpers
    # (uniqueness, minimizer, watchdog) on tiny models -- all well under a
    # few seconds, workers pinned to 1.
    uv run finders/hunt/test_dedupe.py
    uv run finders/hunt/test_grid.py
    uv run finders/hunt/test_printer.py
    uv run finders/hunt/test_render.py
    uv run finders/hunt/test_toy_hunt.py
    uv run finders/hunt/test_render_hook.py
    uv run finders/hunt/test_hunt_resume.py
    uv run finders/hunt/test_workers_load.py
    uv run finders/hunt/test_hunt_verify.py
    uv run finders/hunt/test_uniqueness.py
    uv run finders/hunt/test_minimizer.py
    uv run finders/hunt/test_watchdog.py
    # finders/ghosts' soundness suite, the one pytest suite in the repo: 21
    # tests, about 3s. It compiles ghosts_fast.c with the system cc and
    # checks the C filter and counter against the Python ones, so a silent
    # divergence between the two fails here.
    uv run pytest finders/ghosts -q
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

# finders/renbanana's slow tests: a CP-SAT solve per known grid, about a
# second to several seconds each and minutes overall. Not part of
# check/check-full; run by hand after touching probe_inverted.py,
# probe_circle_pattern.py or prove_two_stage.py.
test-finders-slow:
    uv run finders/renbanana/tools/test_probe_finds_known_grids.py
    uv run finders/renbanana/tools/test_probe_circle_pattern_accepts_known_grids.py
    uv run finders/renbanana/tools/test_prove_two_stage_slow.py

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
test-heavy-fillomino: (_run-tests heavy-fillomino)

test-heavy-recovery: (_run-tests heavy-recovery)

# Both heavy groups, in order -- what `check-full` runs locally.
test-heavy: test-heavy-fillomino test-heavy-recovery

# A shipped Skyscrapers board, proved: the committed link still decodes to the
# board its gen JSON records, that recorded solution really solves it, and it
# still has exactly one solution. One solve each, well under a second, so
# `test` above sweeps every global board this example ships — this recipe is
# the named entry point, and a size argument narrows it to one board. See
# examples/skyscraper/README.md, "Share checklist, walked".
verify-skyscraper size="9":
    uv run examples/skyscraper/verify.py {{size}}

# Manual, occasional uniqueness proof for isofill puzzles (slow CP-SAT solve).
# Not part of check/test/CI; run by hand after a puzzle change. Every
# gen*.json is proved, found by glob, so a new board needs no edit here. See
# examples/isofill/README.md.
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
# candidate built from the working-tree component, on the live site. Prints
# one paste-ready row. Not part of `check` -- it drives the live app.
# See docs/real-app-timing.md.
# Links are stripped to their givens first. An edge-clue example (skyscraper,
# numbered-rooms) keeps its ring: just time skyscraper --ring-clues
time example *flags:
    uv run examples/_shared/time_example.py {{example}} {{flags}}
