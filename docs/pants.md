# Pants behind the seam runner

Pants decides which suites a diff affects and runs each wired suite in a
sandbox: a folder holding only the files the suite's unit declared, so a read
nobody declared fails the suite. Nobody calls Pants by hand to run the gate.
`just check`, `just check-full` and `bash tests/all.sh` are the front door,
and the header of `tests/all.sh` is the one statement of how a run is
selected, when it widens to the whole seam, and what its last line says.

## Wiring an example

An example is a unit, wired by its own `BUILD` file, which is one `unit(...)`
call (`unit` is in `tests/pants_prelude.py`). A new example needs one, or
`examples/_shared/gate.test.py` fails naming each of its test files.
`examples/up-to-n/BUILD` is the shortest worked one:

- `suites=[...]`: one suite per test file and for the soundness harness. A
  suite measured through Pants takes a `timeouts={file: seconds}` ceiling in
  place of the default 600 s; a name that is no suite fails the `BUILD` file.
- `py_edges` and `js_edges`: an edge no import shows is an entry on the file
  that has it, with a comment saying what reads it: a `// #include`, a file
  read by path, a script started as a subprocess.
- The unit's code and data are the same globs in every unit (`unit` in
  `tests/pants_prelude.py` states them), so no unit's globs drift from
  another's. Every suite of the unit gets the whole unit: coarse on purpose.
- `needs=[...]` for a file of another unit a suite reads, named one by one:
  `examples/count-digits-gac/BUILD` names
  `examples/outside-sudoku/PUZZLE_LINK.txt:data`.

A file in another unit is named one by one, never by its whole directory. This
holds for the shared directory's own suites too: `examples/_shared/BUILD`
names each board and component `link_swap.test.py`, `probe_link.test.py`,
`bundle-solve.test.mjs` and the two whole-grid tests read, and keeps
`//:tree` for the suites that scan every example (`check_layout.py`,
`size_builders.test.py`, `global-backends.test.mjs` and the like). A file in
a subdirectory of a unit is addressed `<dir>/<file>:../data`.

`//:tree` is every file but `.git`. A suite that asks git for the tracked
files is on the exception list, below.

## Adding a test file

The runner finds a test file by its name, so it is in the gate at once. Until
it is named in its unit's `BUILD` file it has no sandbox, and
the gate test fails naming it. Pants's `BUILD` files cannot list a directory,
so that one name is the edit a new test file costs.

## A test that cannot run in the sandbox

`tests/sandbox-exceptions.txt` names it, with what the sandbox printed. An
entry runs from the tree, on every narrowed run. The gate test holds the list
equal to the test files with no Pants target, and fails an entry with no
reason. "It was hard" is not a reason; a quoted error is.

## A suite that starts Pants, the runner or `just`

`gate.test.py`, `seam_runner.test.py`, `ci_workflow.test.py`,
`known_edges.test.py` and `recipe_discovery.test.py` start the real Pants
from the sandbox's root. They are wired like any suite, with the tools they
start named: the sandbox's PATH holds the tools a suite names and nothing
else, so a missing one fails the suite or, worse, changes what the runner
prints. `pants.toml` ignores `/_binary_shims_*`, the tool links the outer Pants
keeps in that root. Do not name `env`: the shim for it would run
`~/.local/bin/env`, a file uv leaves there that is no program.

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
- `docs/research/2026-10-13-pants-narrow-tree.md`: #829's follow-up: the five
  suites taken off `//:tree`, `.git` out of it, the cause of the
  `seam_runner.test.py` exception, one shape for a unit.
