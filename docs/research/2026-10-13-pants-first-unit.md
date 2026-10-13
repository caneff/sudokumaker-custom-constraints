# Pants on the first wired unit: what #814 measured

2026-10-13, ticket #814 (slice of spec #809). Pants 2.33.1, no daemon, one
process, no result cache (`pants.toml`). One box (WSL2), 1-minute load under 2.
The unit is `examples/up-to-n`: five suites, wired by its `BUILD` file. Every
number is one worker's measurement, to re-run with the command shown.

**Changed since, by later slices of #809 the same day.** The runner now makes
one `pants test` call per run, not one per suite, and gives Pants a temporary
work directory outside the tree, so the per-suite cost and the `.pants.d/`
described below are #814's runner, not today's
(`docs/research/2026-10-13-pants-selection.md`).

## Wall time: Pants costs about 2 s per suite

The five suites, one after another, three repetitions. "Loop" is the command
as the seam runner ran it before (`uv run <file>` or `node <file>` from the
tree). "Pants" is `pants test <directory>:<file>`, one call per suite, which
is what the runner does now.

| Suite | Loop | Pants |
|---|---|---|
| `build_link.test.py` | 1.6 to 2.3 s | 4.4 to 4.5 s |
| `end-to-end.test.mjs` | 1.2 s | 3.3 to 3.5 s |
| `marker-contract.test.mjs` | 0.03 s | 1.9 to 2.0 s |
| `update-strength.test.mjs` | 0.6 s | 2.5 to 2.6 s |
| `soundness-harness.mjs` | 2.7 s | 4.5 to 4.6 s |
| **All five** | **6.2 to 7.0 s** | **16.8 to 17.0 s** |

The runner also asks Pants for its test targets once per run that holds a
test file: `pants --filter-target-type=test_shell_command list ::`, 1.5 s.

The cost is Pants starting up, not the sandbox: the suite that does nothing
(0.03 s) takes 1.9 s. The whole seam holds 111 test-file suites, so one
`pants test` call per suite would add about 3½ minutes to a seam that takes
about 3½ minutes today. One `pants test` call for many suites would pay the
start-up once; the runner does not do that yet, because it prints one line
per suite as it finishes and stops at the first failure.

## `sudoku-kit` in the sandbox: installed from uv's cache

`uv run` inside the sandbox builds a `.venv` there from `pyproject.toml` and
`uv.lock` (195 MB, hard links into uv's cache) and installs `sudoku-kit` at
the locked commit. Read from a kept sandbox
(`pants --keep-sandboxes=always test examples/up-to-n:build_link.test.py`):
`sudoku_kit-*.dist-info/direct_url.json` names commit `c38103c9`, tag `v0.1.0`,
the commit `uv.lock` pins.

That is with uv's cache warm, which `HOME` in the sandbox's environment makes
reachable. **Not measured: a cold uv cache.** The sandbox's `PATH` holds only
the tools the suite names, and no `git`, so a fetch of the git dependency
from inside the sandbox is expected to fail.

## What CI showed: uv picks its own Python inside the sandbox

The first CI run of this change (run 38387790715, `check` leg) failed on
`node examples/up-to-n/end-to-end.test.mjs`. Outside the sandbox the leg's
`uv sync` printed `Using CPython 3.12.3 interpreter at: /usr/bin/python3`.
Inside it uv downloaded CPython 3.15.0 and stopped: `ortools==9.15.6755` has
no wheel for `cp315`. This box never showed it, because uv has its own
CPython 3.14 installed under `HOME` and takes that first.

Putting `python3` among the sandbox's tools did not fix it (run 38388402672,
same failure). CI runs the gate as `uvx --from rust-just just <recipe>`, and
`uvx` puts its tool environment first on the `PATH`, so the first `python3`
Pants finds there belongs to a virtual environment. `uv run` will not build a
project environment from one: it finds it, passes over it and downloads.
Reproduced here with uv 0.13.0 (CI's version), an empty
`UV_PYTHON_INSTALL_DIR` and a `PATH` holding only such a `python3`.

What answers it: `tests/all.sh` passes `UV_PYTHON`, the resolved path of the
tree's own `.venv/bin/python`, to every `pants test` call, and the sandbox
lets it through. A suite then gets the same interpreter inside the sandbox
and outside it. `UV_CACHE_DIR` is let through too: `astral-sh/setup-uv` sets
it on CI, so `HOME` alone does not reach the cache `uv sync` warmed.

With both, CI run 38389689616 passed on all four legs: the five up-to-n
suites through Pants, `sudoku-kit` included, from the cache `uv sync` warmed.

Pants also reads the whole tree and stops on an absolute symlink, which a
`.venv` holds. The real tree is safe through `.gitignore`; `pants.toml` now
ignores `/.venv/` itself, so a tree with no `.gitignore` is safe too.

## Pants's download cache is shared across worktrees

The prototype (`prototype/pants-spike`) downloaded Pants in another worktree.
This worktree's first `pants` call took 1.7 s and downloaded nothing:
`~/.cache/nce` stayed at 822 MB and `~/.cache/pants` went from 772 to 773 MB.
Both live under the user's home directory, not the checkout. Each worktree
adds only its own `.pants.d/` (160 KB here).

## What the suites needed declared

With no hand-declared input all five failed on a file the sandbox did not
hold (`UpToNComponent.js`, `main.js`, `PUZZLE_LINK_4x4.txt`). The unit's
`BUILD` file now gives every suite the whole unit (its Python, its JavaScript
and its non-code files), and names one file outside it: `UpToNComponent.js`
pulls `examples/_shared/line-kind.js` in by `// #include`, which no import
shows. No test or source file was edited.
