# One obvious entrypoint for the gate — agents and CI run `just check`.

# Full gate (run before calling any task done): lint, tests, soundness fuzz.
check: lint test soundness

# Lint the Node code (StandardJS) and the Python generators (ruff check +
# format check). The verbatim original/ snippets are excluded.
lint:
    npx standard
    uvx ruff check examples
    uvx ruff format --check examples

# Auto-fix + format in place.
fmt:
    npx standard --fix
    uvx ruff check --fix examples
    uvx ruff format examples

# Regression goldens for the recovery/speed probes, plus every example's own
# tests, discovered by file name so a new example needs no edit here. See
# docs/example-layout.md. Builders (build_*.py) do not run here — only files
# named *.test.mjs / *.test.py. A verify.py runs here only when it is cheap:
# skyscraper's is one solve and is wired in below, isofill's searches for
# minutes and stays behind `just verify-isofill` (see there).
#
# ortools rides along with lzstring so a test can prove uniqueness the way the
# generators do. Keep such a test to a handful of single solves — a 4x4, a 9x9,
# skyscraper's sweep of its four global boards (about two seconds): a full
# carve is minutes, and this gate has to stay fast enough to run before every
# commit.
test:
    #!/usr/bin/env bash
    set -euo pipefail
    shopt -s nullglob
    node examples/_shared/recovery-lib.test.mjs
    node examples/_shared/app-solve-lib.test.mjs
    node examples/_shared/app-strip-lib.test.mjs
    node examples/_shared/harness-lib.test.mjs
    node examples/_shared/global-backends.test.mjs
    uv run --with lzstring examples/_shared/link_codec.test.py
    uv run --with lzstring examples/_shared/probe_link.test.py
    uv run --with lzstring examples/_shared/link_swap.test.py
    uv run --with lzstring examples/_shared/time_example.test.py
    uv run --with lzstring examples/_shared/component_scan.test.py
    uv run --with lzstring examples/_shared/count_calls.test.py
    uv run --with lzstring --with ortools examples/_shared/framebuild.test.py
    for dir in examples/*/; do
        name=$(basename "$dir")
        [ "$name" = "_shared" ] && continue
        for f in "$dir"*.test.mjs; do
            node "$f"
        done
        for f in "$dir"*.test.py; do
            uv run --with lzstring --with ortools "$f"
        done
    done
    uv run --with lzstring examples/_shared/check_layout.test.py
    uv run --with lzstring examples/_shared/check_layout.py
    uv run --with lzstring --with ortools examples/skyscraper/verify.py

# A shipped Skyscrapers board, proved: the committed link still decodes to the
# board its gen JSON records, that recorded solution really solves it, and it
# still has exactly one solution. One solve each, well under a second, so
# `test` above sweeps every global board this example ships — this recipe is
# the named entry point, and a size argument narrows it to one board. See
# examples/skyscraper/README.md, "Share checklist, walked".
verify-skyscraper size="9":
    uv run --with lzstring --with ortools examples/skyscraper/verify.py {{size}}

# Manual, occasional uniqueness proof for isofill puzzles (slow CP-SAT solve).
# Not part of check/test/CI; run by hand after a puzzle change. See
# examples/isofill/README.md.
verify-isofill:
    uv run --with ortools examples/isofill/verify.py
    uv run --with ortools examples/isofill/verify.py examples/isofill/gen.json
    uv run --with ortools examples/isofill/verify.py examples/isofill/gen_44g.json
    uv run --with ortools examples/isofill/verify.py examples/isofill/gen_30g.json
    uv run --with ortools examples/isofill/verify.py examples/isofill/gen_35g_silent.json
    uv run --with ortools examples/isofill/verify.py examples/isofill/gen_9x9.json
    uv run --with ortools examples/isofill/verify.py examples/isofill/gen_28g.json
    uv run --with ortools examples/isofill/verify.py examples/isofill/gen_24g.json
    uv run --with ortools examples/isofill/verify.py examples/isofill/gen_25g.json
    uv run --with ortools examples/isofill/verify.py examples/isofill/gen_26g.json

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
    uv run --with lzstring examples/_shared/time_example.py {{example}} {{flags}}
