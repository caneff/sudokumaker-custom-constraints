# Pants: `//:tree` narrowed, `.git` out, the nested-Pants group wired (#829)

2026-10-13, ticket #829 (follow-ups of the spec review of #809). Pants 2.33.1.
Every result is one worker's run through `pants test examples/_shared:<file>`
(the command `tests/all.sh` uses, with `UV_PYTHON` set), on this checkout.

## P2: five suites off `//:tree`

Each suite was given the files it reads and run; then each declared input was
dropped, one at a time, and the suite run again. An input is kept only when
dropping it fails the suite on that file.

| Suite | Declared (each by name) | Dropped input -> the failure |
|---|---|---|
| `whole-grid-mains.test.mjs` | `isofill/main.js`, `fillomino/main.js` | `ENOENT: no such file or directory, open 'examples/fillomino/main.js'` |
| `whole-grid-backends.test.mjs` | the same two | BACKENDS_FAILURE |
| `probe_link.test.py` | `skyscraper/PUZZLE_LINK_6x6.txt`, `isofill/PUZZLE_LINK.txt` | `FileNotFoundError ... 'examples/skyscraper/PUZZLE_LINK_6x6.txt'` |
| `bundle-solve.test.mjs` | `house-gac/base/PUZZLE_LINK.txt`, `numbered-rooms/PUZZLE_LINK_clued.txt` | `FileNotFoundError ... 'examples/numbered-rooms/PUZZLE_LINK_clued.txt'` |
| `link_swap.test.py` | 5 boards and components, 5 `build_link.py`, 5 `example.toml`, `house-gac/main.js` | each fails on its own file |

Declared and then dropped because the suite passed without them: the shared
`:data` (none of the three reads a shared `.toml` or `.har`), and for
`link_swap.test.py` the six paths it only names in argv
(`IsofillComponent.js`, `gen_24g.json`, `PUZZLE_LINK_24g.txt`, the isofill and
fillomino `main.js`, running-start's `main-global.js`): the flag check refuses
the run before anything opens them.

The suites that stay on `//:tree` scan a directory: `check_layout.py`,
`check_layout.test.py`, `size_builders.test.py`, `global-backends.test.mjs`,
`time_example.test.py` and `spec_748_closing.test.py`. `just_list.test.py`
reads only the justfile, so it declares `//:justfile`.

## C4: `.git` out of `//:tree`

`//:tree` is `["**", "!.git", "!.git/**"]`. With it, `check_layout.py` and
`time_example.test.py` still pass. The two that ask git fail, as expected:

- `bundle-load.test.mjs`: `Error: Command failed: git grep ...` /
  `fatal: not a git repository (or any of the parent directories): .git`.
- `sudoku_kit_source.test.py`: `CalledProcessError: Command '['git', 'ls-files',
  '-z', '--', '*.py']' returned non-zero exit status 128`.

Both are on `tests/sandbox-exceptions.txt` with that error. So is
`spec_809_closing.test.py`, which lists the tracked tree to copy it.

## P7: the nested-Pants group

**`seam_runner.test.py`'s cause: the sandbox PATH.** It was not found in
#818 because the sandbox's PATH is the tools a suite names and nothing else,
and the suite called more than it named. Wired with `pants` and `just`:

1. `gate_lib.path_without("pants")` dropped every PATH directory holding
   `pants`. In the sandbox that is the one directory holding every tool, so
   `bash` went with it: `FileNotFoundError: 'bash'`. It now links the
   directory's other entries into a scratch directory.
2. `tests/all.sh` ended the unit list with `| sort | xargs`. `xargs` runs
   `echo`, which Pants does not link into the PATH, and `xargs: echo: No such
   file or directory` left the list empty, so the run printed `(narrowed: no
   wired suite)` while running the right suites. The line is `${units//$'\n'/ }`
   now.
3. `just` needs `sh`. `basename` and `readlink` were each found by dropping
   it and watching `gate.test.py` and `seam_runner.test.py` fail; `dirname awk
   cut cat mktemp rm sort grep` are what `tests/all.sh` calls by name, and
   were not dropped one by one.

**The nested Pants.** `"/_binary_shims_*"` in `pants_ignore` is what the spike
in `2026-10-13-pants-shared-tests.md` found. The second failure there, `env:
cannot execute: Permission denied` from `/home/caneff/.local/bin/env`, came
from naming `env` among the tools: the shim runs the first `env` on the PATH,
which on this box is a file uv installed that is no program. None of the five
needs `env`, so the failure goes away by not naming it.

Result: `seam_runner.test.py` (about 85 s: it starts Pants a dozen times),
`gate.test.py`, `ci_workflow.test.py`, `recipe_discovery.test.py` and
`known_edges.test.py` pass in the sandbox. `spec_809_closing.test.py` stays
excepted, for `.git`.

## S6: one shape for a unit

The eleven example units had three data dialects (`*.json` and four others;
the same with `.jsonl`, `.tsv`, `.txt`, `.golden/*.txt`; `**/*` forms with
`PUZZLE_LINK*.txt` only) and two code dialects (`*.py` and `**/*.py`). One
glob set fits every unit: `**/` forms of every file type any unit used. A
dotted directory (`.golden/`) is inside `**`, which `numbered-rooms` already
relied on. `unit(...)` in `tests/pants_prelude.py` is that set, with the
per-unit parts as arguments.
