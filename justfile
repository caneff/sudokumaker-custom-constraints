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
# named *.test.mjs / *.test.py. verify.py is excluded on purpose: it is a
# slow CP-SAT proof, run by hand via `just verify-isofill` (see there).
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
    uv run --with lzstring examples/_shared/framebuild.test.py
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
