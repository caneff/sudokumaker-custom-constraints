# One obvious entrypoint for the gate — agents and CI run `just check`.

# Full gate (run before calling any task done): lint, tests, soundness fuzz.
check: lint test soundness

# Lint the Node code (StandardJS) and the Python generators (ruff check +
# format check). The verbatim ORIGINAL_*/original/ snippets are excluded.
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
    node examples/hit-counts/recovery-probe.test.mjs
    node examples/skyscraper/recovery-probe.test.mjs
    node examples/numbered-rooms/update-strength.test.mjs
    uv run --with lzstring examples/_shared/link_codec.test.py
    uv run --with lzstring examples/_shared/probe_link.test.py
    uv run --with lzstring examples/_shared/link_swap.test.py
    uv run --with lzstring examples/numbered-rooms/build_link.test.py
    uv run --with lzstring examples/numbered-rooms/build_clued.test.py
    uv run --with lzstring examples/skyscraper/build_link.test.py
    uv run --with lzstring examples/_shared/time_example.test.py
    uv run --with ortools examples/isofill/verify.py
    uv run --with ortools examples/isofill/verify.py examples/isofill/puzzle.json
    uv run --with lzstring examples/isofill/build_link.py

# Soundness fuzz: every component keeps each cell's true value. The invariant.
soundness:
    node examples/hit-counts/soundness-harness.mjs
    node examples/isofill/soundness-harness.mjs
    node examples/numbered-rooms/soundness-harness.mjs
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
