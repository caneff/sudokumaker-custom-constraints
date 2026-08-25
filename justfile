# One obvious entrypoint for the gate — agents and CI run `just check`.

# Full gate (run before calling any task done): lint, tests, soundness fuzz.
check: lint test soundness

# Lint the Node code (StandardJS) and the Python generators (ruff). The .js
# constraint snippets are excluded — they run in SudokuMaker, not Node.
lint:
    npx standard
    uvx ruff check examples

# Auto-fix what the linters can.
fmt:
    npx standard --fix
    uvx ruff check --fix examples

# Regression goldens for the recovery/speed probes.
test:
    node examples/_shared/recovery-lib.test.mjs
    node examples/hit-counts/recovery-probe.test.mjs
    node examples/numbered-rooms/recovery-probe.test.mjs
    node examples/skyscraper/recovery-probe.test.mjs

# Soundness fuzz: every component keeps each cell's true value. The invariant.
soundness:
    node examples/hit-counts/soundness-harness.mjs
    node examples/numbered-rooms/soundness-harness.mjs
    node examples/running-start/soundness-harness.mjs
    node examples/skyscraper/soundness-harness.mjs
