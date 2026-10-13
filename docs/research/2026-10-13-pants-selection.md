# Pants picks a narrowed run's suites: what #815 measured

2026-10-13, ticket #815 (slice of spec #809). Pants 2.33.1, as `pants.toml`
sets it. One box (WSL2), 1-minute load about 1. Every number is one worker's
measurement, to re-run with the command shown.

**Changed since, by #819 and the spec's review the same day.** No suite keeps
a directory rule: a suite Pants has no target for always runs. A changed file
no target owns widens the run to the whole seam, and so does a deleted file,
because Pants answers from the tree as it is now and no longer lists the
suite that still imports a module that is gone. `.gitignore` is a source of
`//:runner`. `tests/all.sh`'s header is the current rule.

## One Pants call per run: 8 s for five suites, against 16 s

The five `examples/up-to-n` suites, three repetitions each way, measured as
#814 measured them (`docs/research/2026-10-13-pants-first-unit.md`):

| How | Wall time |
|---|---|
| The loop: `uv run <file>` or `node <file>` from the tree | 5.0 s |
| `pants test <target>`, one call per suite (the runner before) | 16.1 to 16.2 s |
| `pants test <five targets>`, one call (the runner now) | 7.9 to 8.1 s |

#814 measured 16.8 to 17.0 s for the per-suite calls and 6.2 to 7.0 s for the
loop. One call pays Pants's start-up once, about 2 s, and about 0.2 s of
sandbox set-up per suite.

`bash tests/all.sh --group test`, 96 suites of which 87 are wired, took
2 min 13 s through the one call. The same group was not timed with one call
per suite.

Pants does not stop at the first failure: one call runs every target it was
given. The runner prints `FAIL <suite>` and that suite's output for each
failure. It reads a pass off Pants's result line, `✓ <target> succeeded in
<time>.`, and a target with no such line is a failure.

## The query a narrowed run asks

```
pants --changed-since=<base> --changed-dependents=transitive \
  --filter-target-type=test_shell_command list
```

It prints one test target per line, 4 s on the real tree. Checked on a
scratch tree of three wired units:

| Diff | Pants lists |
|---|---|
| a shared helper, committed | the suites that import it, and no other |
| a deleted shared helper | the suites that imported it |
| a unit's fixture, named in that unit's `files` target | the suites declaring it |
| a unit's `BUILD` file | that unit's suites |
| `uv.lock` | every suite |
| a file no target owns (a `README.md` outside the unit's globs) | nothing |
| a base git does not know | exit 1, `fatal: bad revision` |

Pants reads `<base>...HEAD` and adds changes not yet committed. The runner's
own diff holds committed changes only, so on a dirty tree Pants selects more.

A file no target owns selects no wired suite. That is sound for a wired
suite: its sandbox holds only owned files, so it cannot read the file. It
says nothing about a suite that is not wired, which is why those keep the
directory rule.

`--filter-target-type` filters the targets named on the command line, not the
answer: `pants --filter-target-type=test_shell_command dependents <file>`
prints nothing, since a file's own target is not a test. The known-edges test
(`examples/_shared/known_edges.test.py`) asks `pants dependents --transitive
--format=json <files>` and keeps the test targets itself.

## Pants's work directory, outside the checkout

`PANTS_WORKDIR=<dir>` moves all of `.pants.d/`: with it set, a `pants list`
and a `pants test` wrote `pants.log`, `exceptions.log` and `run-tracker/`
under `<dir>` and nothing in the tree. `pants_subprocessdir` defaults to
`.pants.d/pids` and is a separate option, but with `pantsd = false` no such
directory was written. The runner makes one temporary directory per run and
removes it on exit, so two worktrees share nothing through it.

## `UV_PYTHON` and a second `uv run`, on uv 0.13.0

Reproduced outside Pants, in a project built from `/usr/bin/python3.12`, with
a script outside the project that imports `sudoku_kit`:

| uv | How the outer run got its interpreter | Inner `uv run --with lzstring <script>` |
|---|---|---|
| 0.13.0 | `UV_PYTHON` in the environment | `ModuleNotFoundError: No module named 'sudoku_kit'` |
| 0.13.0 | nothing set | ok, on the project's `.venv` |
| 0.13.0 | `uv run --python <path>`, variable not set | ok, on the project's `.venv` |
| 0.11.14 | any of the three | ok |

So `tests/pants_prelude.py` starts a Python suite with `--python` and unsets
the variable first. A node suite keeps it: the `uv run` it starts is the
first one in its sandbox, and has to be told the interpreter (#814's CI
failure). With that, `examples/_shared:time_example.test.py` passed in the
sandbox with uv 0.13.0 and a virtual environment's `python3` first on the
`PATH`, and `UV_PYTHON=/usr/bin/python3.12`. **Not reproduced: CI's empty
managed-Python directory.** `HOME` reaches the sandbox, so uv's own CPython
installs were visible in that run.

## Every selection from Pants: what #819 added

2026-10-13, ticket #819. One worker's reading, to re-run with the command
shown.

The narrowed run now asks the same query with no `--filter-target-type`:

```
pants --changed-since=<base> --changed-dependents=transitive list
```

The answer then holds the owners of the changed files as well as their
dependents, 2 s on the real tree for a two-commit diff:

| Changed path | What the answer holds for it |
|---|---|
| a file a target in its own directory owns | `examples/aa/board.txt:data` |
| a file a root target owns | `//uv.lock:uvproject`, `//docs/notes.md:../tree` |
| a file two targets own | one line per owner |
| a deleted file a glob still matches | the generator, `examples/_shared:py`, and no line naming the file |
| a file no target owns | no line |
| a `BUILD` file | every target it defines, and its own file target when `//:tree` owns it |

So the runner reads "Pants cannot place this path" off the answer: a changed
file still in the tree with no line `<file>:` or `//<file>:`. A deleted file
cannot be checked that way and needs no check, since no suite can read it.
On the real tree `//:tree` owns `.github/workflows/ci.yml`, `.gitignore`,
`pants.toml` and each `BUILD` file (`pants list <file>`), so the paths Pants
cannot place there are the ones `pants_ignore` names.

`tests/all.sh`, `pants.toml` and `tests/pants_prelude.py` are owned by
`//:tree` alone unless declared, and a change to one would then select only
the whole-tree suites. `//:runner` names the three, and the prelude puts it
under every suite.
