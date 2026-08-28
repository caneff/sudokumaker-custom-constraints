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

# Regression goldens for the recovery/speed probes.
test:
    node examples/_shared/recovery-lib.test.mjs
    node examples/_shared/app-solve-lib.test.mjs
    node examples/_shared/app-strip-lib.test.mjs
    node examples/hit-counts/recovery-probe.test.mjs
    node examples/skyscraper/recovery-probe.test.mjs
    node examples/numbered-rooms/update-strength.test.mjs
    uv run --with lzstring examples/_shared/link_codec.test.py
    uv run --with lzstring examples/_shared/probe_link.test.py
    uv run --with lzstring examples/_shared/link_swap.test.py
    uv run --with lzstring examples/numbered-rooms/build_link.test.py
    uv run --with lzstring examples/numbered-rooms/build_clued.test.py
    uv run --with lzstring examples/hit-counts/build_link.test.py
    uv run --with lzstring examples/running-start/build_link.test.py
    uv run --with lzstring examples/skyscraper/build_link.test.py
    uv run --with lzstring examples/_shared/time_example.test.py
    uv run --with lzstring examples/isofill/build_link.py
    uv run --with lzstring examples/isofill/build_link.test.py
    uv run --with lzstring examples/isofill/build_hard_links.py
    uv run --with lzstring examples/_shared/check_links.py
    uv run examples/_shared/check_layout.test.py

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

# Soundness fuzz: every component keeps each cell's true value. The invariant.
soundness:
    node examples/hit-counts/soundness-harness.mjs
    node examples/isofill/soundness-harness.mjs
    node examples/numbered-rooms/soundness-harness.mjs
    node examples/numbered-rooms-lines/soundness-harness.mjs
    node examples/running-start/soundness-harness.mjs
    node examples/skyscraper/soundness-harness.mjs

# Real-app timing for one example: baseline (committed PUZZLE_LINK.txt) vs a
# candidate built from the working-tree component, on the live site. Prints
# one paste-ready row. Not part of `check` -- it drives the live app.
# See docs/real-app-timing.md.
# Links are stripped to their givens first. An edge-clue example (skyscraper,
# numbered-rooms) keeps its ring: just time skyscraper --ring-clues
time example *flags:
    uv run --with lzstring examples/_shared/time_example.py {{example}} {{flags}}
