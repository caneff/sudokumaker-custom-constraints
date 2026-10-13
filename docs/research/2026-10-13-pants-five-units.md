# Pants on five more units: what #816 found

2026-10-13, ticket #816 (slice of spec #809). Units: `count-digits-gac`,
`outside-sudoku`, `numbered-rooms`, `running-start`, `house-gac`. Each is wired
by its own `BUILD` file like `examples/up-to-n` (see
`2026-10-13-pants-first-unit.md`).

## Wired: 27 of 27 suites

`bash tests/all.sh --changed origin/spec-809` passed 73 of 115 suites with 0
failures. Every unit gives each suite the whole unit (Python, JavaScript, data)
plus `examples/_shared:py` and `:js`. Three test files were edited, to read frozen floors (below); no source file was.

## Three `update-strength.test.mjs` suites read git history, so their floors are frozen

`house-gac`, `numbered-rooms` and `running-start` read a component as it stood
at a commit (`loadAt` in `examples/_shared/harness-lib.mjs`, or `gitShow` in
numbered-rooms). In the sandbox they failed with `spawnSync git ENOENT`: the
sandbox has no `git` on its `PATH` and holds no `.git`. Each floor is now a
frozen copy under the unit's `.golden/`, named `<stem>.<commit>.js`, loaded
with `load`:

| Unit | Frozen copy | From |
|---|---|---|
| house-gac | `HouseGacComponent.3279a3d.js` | `examples/_shared/HouseGacComponent.js` at `3279a3d` |
| numbered-rooms | `NumberedRoomsComponent.143b34d.js` | `examples/numbered-rooms/NumberedRoomsComponent.js` at `143b34d` |
| numbered-rooms | `NumberedRoomsLinesComponent.56e707a.js` | `examples/numbered-rooms-lines/NumberedRoomsLinesComponent.js` at `56e707a` |
| running-start | `RunningStartComponent.db93523.js` | same path at `db93523` |
| running-start | `RunningStartPairComponent.db93523.js` | same path at `db93523` |

How the copies were checked: each was written from `assembleSource(path, [],
<git show at commit>)`, the exact call `loadAt` makes, so any `// #include` is
spliced as at that commit. The check then re-assembled the written file with
the default reader and compared it to that string: byte-equal for all five,
no directive left in any. None of the five commits' files held an `// #include`,
so each copy also `cmp`s equal to plain `git show <commit>:<path>`.

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
