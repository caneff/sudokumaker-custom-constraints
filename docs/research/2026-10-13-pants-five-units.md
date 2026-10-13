# Pants on five more units: what #816 found

2026-10-13, ticket #816 (slice of spec #809). Units: `count-digits-gac`,
`outside-sudoku`, `numbered-rooms`, `running-start`, `house-gac`. Each is wired
by its own `BUILD` file like `examples/up-to-n` (see
`2026-10-13-pants-first-unit.md`).

## Wired: 27 of 27 suites

`bash tests/all.sh --changed origin/spec-809` passed 73 of 115 suites with 0
failures. Every unit gives each suite the whole unit (Python, JavaScript, data).
A file outside the unit is named one by one, never the whole shared directory
(below). Three test files were edited, to read frozen floors; no source file was.

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

## Files outside the unit: 14 hand-declared edges, each by name

Pants infers the shared files a suite imports. What no import shows is declared
on the file that has it, as an `overrides` entry with a comment:

| Unit | File that has it | Names |
|---|---|---|
| count-digits-gac | `RequiredDigitsGacComponent.js` | `_shared/bit-helpers.js` (`// #include`) |
| count-digits-gac | `required-digits/main-required-digits-global.js` | `_shared/frame-lines.js` (`// #include`) |
| count-digits-gac | every suite (`needs`) | `outside-sudoku/PUZZLE_LINK.txt`, read by `build_required_digits.py` (the one cross-unit edge) |
| outside-sudoku | `main-global.js` | `_shared/frame-lines.js` (`// #include`) |
| numbered-rooms | `NumberedRoomsComponent.js` | `_shared/line-kind.js` (`// #include`) |
| numbered-rooms | `main-global.js` | `_shared/frame-lines.js` (`// #include`) |
| running-start | `RunningStartComponent.js` | `_shared/line-kind.js`, `_shared/below.js` (`// #include`) |
| running-start | `RunningStartPairComponent.js` | `_shared/line-kind.js`, `_shared/below.js` (`// #include`) |
| running-start | `main-global.js` | `_shared/frame-lines.js` (`// #include`) |
| house-gac | `soundness-harness.mjs`, `update-strength.test.mjs`, `build_link.py` | `_shared/HouseGacComponent.js`, loaded by path |

That is 14 file-to-file edges: 13 into `examples/_shared/`, 1 across units.

### What `examples/_shared/BUILD` still hides (#818's file, not edited here)

`pants dependents --transitive <shared file>`, counted over these 27 suites:

| Shared file | Real tree | `framebuild.py`/`no_ring.py` `:js` override removed (local, restored) |
|---|---|---|
| `line-kind.js` | 19 | 10 (numbered-rooms, running-start) |
| `bit-helpers.js` | 27 | 8 (count-digits-gac) |
| `HouseGacComponent.js` | 19 | 3 (house-gac) |
| `frame-lines.js` | 27 | 24 |
| `harness-lib.mjs`, `link_swap.py` | 27 | 27 (every suite imports them) |

On the real tree the coarse `:js` dependency of `framebuild.py` and
`no_ring.py` puts every shared `.js` under every suite whose unit has a Python
file importing `framebuild`, so a helper with three real readers lists nineteen
suites. Removing that override locally lists only the readers. With it removed,
five suites fail on a read inside the shared directory, which `_shared/BUILD`
must declare:

- `HouseGacComponent.js` has `// #include ../_shared/bit-helpers.js`;
- `framebuild.py` reads `_shared/frame-rowcol.js` by path
  (`frame_backend_code`, via outside-sudoku `build_size.test.py`) and
  `_shared/house-gac.js` (`house_gac_backend_code`, via running-start
  `build_link.test.py`).
