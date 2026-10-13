# Pants on the first wired unit: what #814 measured

2026-10-13, ticket #814 (slice of spec #809). Pants 2.33.1, no daemon, one
process, no result cache (`pants.toml`). One box (WSL2), 1-minute load under 2.
The unit is `examples/up-to-n`: five suites, wired by its `BUILD` file. Every
number is one worker's measurement, to re-run with the command shown.

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
`uv` and `node`, and no `git`, so a fetch of the git dependency from inside
the sandbox is expected to fail. A box or a CI leg that has run `uv sync` (CI
does, before the gate) has the cache warm.

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
