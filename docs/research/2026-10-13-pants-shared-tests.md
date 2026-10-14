# Pants on the shared tests: what #818 measured

2026-10-13, ticket #818 (slice of spec #809). Pants 2.33.1, as `pants.toml`
sets it. The unit is `examples/_shared`: 42 suites (41 test files and
`check_layout.py`). Every result is one worker's run, to re-run with
`pants test examples/_shared:<file>`.

**Changed since, by later slices of #809 the same day.** `time_example.test.py`
is wired: #815 fixed the `UV_PYTHON` hand-off in `tests/pants_prelude.py`.
The ninth excepted suite is `known_edges.test.py`, which starts Pants inside
the sandbox, and the tenth is the spec's closing test,
`spec_809_closing.test.py`, for the same reason. `harness-lib.test.mjs` no longer starts git. The runner makes
one Pants call per run. `tests/sandbox-exceptions.txt` is the current list,
each entry with its reason, `seam_runner.test.py`'s included; the counts and
reasons below are #818's as measured.

## Result: 33 wired, 9 excepted

33 suites run in the sandbox. 9 cannot, and `tests/sandbox-exceptions.txt`
names each with what the sandbox printed. They fall in three groups.

**npm packages (4).** `pants.toml` keeps `node_modules` out of every sandbox,
and Node resolves a bare ES module import from nowhere else (`NODE_PATH` is
for CommonJS only).

| Suite | What the sandbox printed |
|---|---|
| `app-session.test.mjs` | `Cannot find package 'playwright' imported from examples/_shared/app-session.mjs` |
| `app-solve-lib.test.mjs` | the same, from the `app-solve.mjs` it starts |
| `bundle-index.test.mjs` | `Cannot find package 'acorn' imported from examples/_shared/bundle-index.mjs` |
| `spec_649_closing.test.py` | `StopIteration`: it walks up from the root for a `node_modules` directory |

The Chromium-driving session test never reached Chromium: it stops at the
import. Whether Chromium starts in the sandbox is still not known.

**Pants started inside the sandbox (4).** `gate_lib.pants_suites` asks the
real Pants for its test targets, from the sandbox root. The outer Pants keeps
its tool links there, and the inner one stops on them:
`IntrinsicError: Failed to read link "_binary_shims_<sha>": Absolute symlink`.
That is `gate.test.py`, `ci_workflow.test.py`, `recipe_discovery.test.py` and
`seam_runner.test.py`. The last fails earlier too: a scratch-tree diff of
`examples/fillomino/Component.js` selects no fillomino suite. Its cause was
not found; adding `echo`, `tr`, `sed` and ten more tools did not change it.

**A spike, reverted.** With `"/_binary_shims_*"` added to `pants_ignore` in
`pants.toml`, the inner `pants peek` ran. `recipe_discovery.test.py` then
passed. `gate.test.py` and `ci_workflow.test.py` failed next on a tool link:
`_binary_shims_<sha>/env: line 2: exec: /home/caneff/.local/bin/env: cannot
execute: Permission denied` (uv installs a file named `env` there that is no
program). The ticket ruled `pants.toml` out, so the line is not in the tree
and the four stay excepted (controller's ruling, 2026-10-13).

**A second `uv run` under the suite's own, on uv 0.13.0 (1).**
`time_example.test.py` passed here (uv 0.11.14) and failed on CI (uv 0.13.0,
run 38396298615): `subprocess.CalledProcessError: Command '['uv', 'run',
'--with', 'lzstring', '/tmp/tmp<id>/backend-changed/build_link.py', ...]'
returned non-zero exit status 1`. The suite writes a builder into a temporary
directory and starts it with `uv run --with lzstring`. `tests/all.sh` hands
every sandbox `UV_PYTHON` (#814's answer to uv picking its own Python). With
that set, uv 0.13.0 builds the inner run's environment from that interpreter,
not from the project's, and the builder stops on
`ModuleNotFoundError: No module named 'sudoku_kit'`. Reproduced here in a
kept sandbox with uv 0.13.0: the inner run exits 1 with `UV_PYTHON` set and 0
with it dropped from the inner run's environment; uv 0.11.14 exits 0 both
ways. The fix sits in the runner or in `time_example.py`, both outside this
ticket. The other 33 suites pass here under uv 0.13.0, `/usr/bin/python3.12`
and a cache warmed by `uv sync`, which is CI's setup.

## A suite can pass in a sandbox that lacks its inputs

Three suites exit 0 with only the shared directory in the sandbox, because
each loops over the examples it finds and found none:

| Suite | The loop | Input declared |
|---|---|---|
| `check_layout.py` | every example directory under `examples/` | `//:tree` |
| `check_layout.test.py` | `HERE.parent.iterdir()`: every example has a manifest | `//:tree` |
| `time_example.test.py` | `examples.iterdir()`: every example resolves its timed component | none: excepted, above |

Their output is the same with and without the examples, so comparing output
does not find them. They were found by reading each passing suite's source
for a directory scan (`glob`, `rglob`, `iterdir`, `readdirSync`, `git
ls-files`, `git grep`). A red run is not the only sign of a missing input.

## What was declared: 42 edges onto 4 targets

Two targets are new: `examples/_shared:data` (the directory's `.toml` and
`.har` files) and `//:tree` (the whole repository, `sources=["**"]`).

| Edge | Suites | Why |
|---|---|---|
| `:data` | 20 | the unit's non-code files, for every suite without `//:tree` |
| `:js` | 8 | a shared `.js` file read by path, not imported |
| `./include_agreement.py:py` | 1 | `include.test.mjs` starts it with `uv run` |
| `//:tree` | 13 | the suite scans the examples, or reads other examples' files |

Eleven suites need nothing past `:data`: Pants infers the rest from imports.

`//:tree` is coarser than the spec asks for a file in another unit ("named
one by one"). The other examples had no `BUILD` file when this was written
(#816 and #817 add them), so a named edge had no target to name. Six of the
thirteen read other examples' files by a written path
(`bundle-solve.test.mjs`, `link_swap.test.py`, `probe_link.test.py`,
`spec_748_closing.test.py`, `whole-grid-backends.test.mjs`,
`whole-grid-mains.test.mjs`). Whether each of them also scans a directory
was not established. Those six are the ones that
can be narrowed once every unit has targets.

Five suites also name tools, since the sandbox's `PATH` holds only `uv`,
`node` and what the suite names: `git` (3), `just` (1), and `bash`,
`dirname`, `awk`, `cut` for the one that lists the seam (1).

## git works in the sandbox, through `//:tree`

`**` takes the `.git` entry with it. In a worktree that is a one-line file
naming the real git directory, so `git ls-files` and `git grep` in the
sandbox answer from the worktree's own index, outside the sandbox. In a
plain clone `.git` is a directory and is copied in: checked on a `--depth 1`
clone (4.2 MB of `.git`), where `bundle-load.test.mjs` (`git grep`),
`sudoku_kit_source.test.py` (`git ls-files`), `time_example.test.py` and
`check_layout.py` all passed (uv 0.11.14), 3 to 7 s each. **Not measured:** a checkout
whose `.git` directory is large (the primary checkout's is 59 MB).

## Cost

Each wired suite pays Pants's start-up, about 2 s (#814's note). 33 suites
add about 70 s to a full seam until #815 makes it one call per run.

## The shared `.js` files `framebuild.py` reads, named

#814 gave `framebuild.py` and `no_ring.py` every shared `.js` (`:js`). Both
read a fixed set by path, so each is now its own edge: `framebuild.py` reads
`frame-rowcol.js` and `frame-corners.js` (`FRAME_BACKENDS`), `house-gac.js`
and `HouseGacComponent.js` (`house_gac_backend_code`); `no_ring.py` reads
`grid-rowcol.js`; `HouseGacComponent.js` includes `bit-helpers.js`. Six
edges replace the two blanket ones.

Suites that `pants dependents --transitive examples/_shared/<file>` lists,
out of 75 test targets (the shared directory, up-to-n and #817's five
units), before and after:

| File | Shared suites | Other units' suites, before | After |
|---|---|---|---|
| `line-kind.js` | 21 | 27 | 18 |
| `bit-helpers.js` | 22 | 27 | 27 |
| `frame-lines.js` | 21 | 27 | 13 |

`bit-helpers.js` does not move: every unit that imports `framebuild` reaches
it through `HouseGacComponent.js`, which `framebuild.py` reads. The shared
count is 13 suites on `//:tree` and 8 on `:js`, which hold every shared
file by declaration. The full seam passed after the change, 115 of 115.
