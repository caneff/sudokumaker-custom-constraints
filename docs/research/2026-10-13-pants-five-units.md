# Pants on five more units: what #816 found

2026-10-13, ticket #816 (slice of spec #809). Units: `count-digits-gac`,
`outside-sudoku`, `numbered-rooms`, `running-start`, `house-gac`. Each is wired
by its own `BUILD` file like `examples/up-to-n` (see
`2026-10-13-pants-first-unit.md`).

## Wired: 22 of 25 suites

`bash tests/all.sh --changed origin/spec-809` passed 73 of 115 suites with 0
failures. Every unit gives each suite the whole unit (Python, JavaScript, data)
plus `examples/_shared:py` and `:js`. No test or source file was edited.

## Not wired: three `update-strength.test.mjs` suites read git history

`house-gac`, `numbered-rooms` and `running-start` read a component as it stood
at a commit (`loadAt` in `examples/_shared/harness-lib.mjs`, or `gitShow` in
numbered-rooms). In the sandbox they fail with `spawnSync git ENOENT`: the
sandbox has no `git` on its `PATH` and holds no `.git`, so no `tools=["git"]`
alone fixes it. They keep running from the tree through the runner's loop, and
the gate test counts them under that one mechanism. `outside-sudoku`,
`count-digits-gac` and the other suites need no git. Wiring them needs either
the reference sources declared as files, or a change to the suite shape
(`tests/pants_prelude.py`), neither of which belongs to this slice.

## Missing-input check (one suite per unit, a declared input dropped)

| Suite | Dropped | Error |
|---|---|---|
| `count-digits-gac:build_required_digits.test.py` | `examples/outside-sudoku:data` | `FileNotFoundError: [Errno 2] No such file or directory: 'examples/outside-sudoku/PUZZLE_LINK.txt'` |
| `outside-sudoku:build_link.test.py` | `:data` | `FileNotFoundError: missing examples/outside-sudoku/example.toml` |
| `numbered-rooms:build_link.test.py` | `:data` | `FileNotFoundError: missing examples/numbered-rooms/example.toml` |
| `running-start:build_link.test.py` | `:data` | `FileNotFoundError: missing examples/running-start/example.toml` |
| `house-gac:build_link.test.py` | `:data` | `FileNotFoundError: missing examples/house-gac/example.toml` |

`pants dependents examples/outside-sudoku:data` lists all eight count-digits-gac
suites, so the one cross-unit edge reaches them.
