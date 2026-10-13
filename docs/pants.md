# Pants behind the seam runner

Pants decides which suites a diff affects and runs each wired suite in a
sandbox: a folder holding only the files the suite's unit declared, so a read
nobody declared fails the suite. Nobody calls Pants by hand to run the gate.
`just check`, `just check-full` and `bash tests/all.sh` are the front door,
and the header of `tests/all.sh` is the one statement of how a run is
selected, when it widens to the whole seam, and what its last line says.

## Wiring an example

An example is a unit, wired by its own `BUILD` file. A new example needs one,
or `examples/_shared/gate.test.py` fails naming each of its test files.
`examples/up-to-n/BUILD` is the shortest worked one:

- `python_sources` and `javascript_sources` for the unit's code. Pants infers
  what a file imports. An edge no import shows is an `overrides` entry on the
  file that has it, with a comment saying what reads it: a `// #include`, a
  file read by path, a script started as a subprocess.
- `files(name="data", ...)` for the unit's non-code files. This is coarse on
  purpose: every suite of the unit gets the whole unit.
- One `suite("<file>", needs=[...])` per test file and for the soundness
  harness. `suite` is in `tests/pants_prelude.py`; it takes `tools=` for a
  program the suite starts and `timeout=` in seconds.

A file in another unit is named one by one, never by its whole directory:
`examples/count-digits-gac/BUILD` names `examples/outside-sudoku/PUZZLE_LINK.txt`.

## Adding a test file

The runner finds a test file by its name, so it is in the gate at once. Until
it has a `suite(...)` line in its unit's `BUILD` file it has no sandbox, and
the gate test fails naming it. Pants's `BUILD` files cannot list a directory,
so that one line is the edit a new test file costs.

## A test that cannot run in the sandbox

`tests/sandbox-exceptions.txt` names it, with what the sandbox printed. An
entry runs from the tree, on every narrowed run. The gate test holds the list
equal to the test files with no Pants target, and fails an entry with no
reason. "It was hard" is not a reason; a quoted error is.

## A strength test's floor

The sandbox holds no git history, so an `update-strength.test.mjs` loads its
floor from a frozen copy, `.golden/<stem>.<commit>.js`, written with its
includes spliced in as of that commit. Raising the floor replaces the copy in
the same commit as the stronger component.

## What was measured

Each note is dated and says what its slice measured; where a later slice
changed the runner, the note's first paragraph says so.

- `docs/research/2026-10-13-pants-first-unit.md`: the cost of Pants per call,
  `sudoku-kit` in the sandbox, uv choosing its own Python on CI.
- `docs/research/2026-10-13-pants-five-units.md`: the edges five units needed.
- `docs/research/2026-10-13-pants-shared-tests.md`: the shared tests, the
  exception list's errors, suites that pass in a sandbox missing their inputs.
- `docs/research/2026-10-13-pants-selection.md`: what Pants answers for a
  diff, one Pants call per run, the work directory, `UV_PYTHON`.
