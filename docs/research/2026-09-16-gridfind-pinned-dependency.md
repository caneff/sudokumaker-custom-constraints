# Can this repo take gridfind as a pinned git dependency on Python 3.14?

caneff/sudokumaker-custom-constraints#479, child of the wayfinder map
caneff/sudokumaker-custom-constraints#478.

## Answer

Yes. A git dependency on gridfind pinned to a sha resolves and installs
cleanly with uv on Python 3.14; ortools ships cp314 manylinux wheels; the
shaded cells ctypes build (`finders/shaded/fastclimb.py` + `shaded_fast.c`, gcc via
`subprocess`) is Python-version-independent and passed its parity test; and
every existing Python generator and Node test passed under `just test` on
3.14. Both repos are public, so CI needs no auth to clone gridfind. The one
real cost: bumping `requires-python` to `>=3.14` makes `ruff format` apply
PEP 758's unparenthesized multi-exception clauses, which is a small,
mechanical repo-wide reformat (2 files today), not a blocker.

## Method

Probed in a disposable worktree (`.claude/worktrees/research-479`, branch
`research/479-gridfind-dep`, off `origin/main` at `dcae18b`), never in the
primary checkout. Edited `pyproject.toml` there only — no commit — then
reverted. Box: `uv 0.11.14`, `python3.14.5` already installed via
`uv python install` (`~/.local/share/uv/python/cpython-3.14-linux-x86_64-gnu`),
so no network install was needed for the interpreter itself.

## uv resolution

gridfind at commit `d8f8d722f567d363a9e630c786da4de578a373a5` (current
`origin/main` tip of caneff/gridfind, verified `git log -1` in
`/home/caneff/src/gridfind`) declares `requires-python = ">=3.14"`,
`uv_build` backend, deps `lzstring>=1.0.4` and `ortools>=9.15.6755`.

Probe change to this repo's `pyproject.toml`:

```toml
[project]
requires-python = ">=3.14"
dependencies = ["lzstring", "ortools", "gridfind"]

[tool.uv.sources]
gridfind = { git = "https://github.com/caneff/gridfind", rev = "d8f8d722f567d363a9e630c786da4de578a373a5" }
```

`uv lock` resolved 14 packages in 534ms, no conflicts (only side effect:
`numpy` moved from 2.4.6 to 2.5.3, gridfind's own transitive pin). `uv sync`
built gridfind from the pinned git rev and installed 12 packages including
`ortools==9.15.6755`. Both this repo's `>=3.11` floor and gridfind's `>=3.14`
floor are compatible once this repo's floor is raised to match — a git
dependency does not let a `>=3.11` consumer depend on a `>=3.14` package; the
consumer's own `requires-python` must satisfy the dependency's floor, per
uv's dependency-sources model (a git source is just an alternative source for
the same PEP 621 dependency entry — it does not relax `requires-python`
matching): <https://docs.astral.sh/uv/concepts/projects/dependencies/#git>.

The mechanics (`git = "<url>"`, `rev = "<sha>"`, `tag =`, `branch =`) are
documented at the URL above under "Git". Pinning to an exact sha uses `rev`.
`uv add "gridfind @ git+https://github.com/caneff/gridfind" --rev <sha>`
would write the same entry; editing `pyproject.toml` by hand (as probed here)
works identically since uv treats `tool.uv.sources` as data, not a cache of
CLI history.

## ortools compatibility

PyPI's `ortools` 9.15.6755 (the exact version gridfind pins, checked via
`https://pypi.org/pypi/ortools/json`) ships `cp314` and `cp314t` manylinux
and macOS/Windows wheels alongside cp310–cp313, so no source build and no
version conflict between this repo's own `ortools` dependency and gridfind's.
Both resolve to the same 9.15.6755. Sanity-checked a CP-SAT solve
(`cp_model.CpModel` / `CpSolver`) under the 3.14 venv — `OPTIMAL`, correct
value.

## CI

Both `caneff/sudokumaker-custom-constraints` and `caneff/gridfind` are public
(`gh repo view --json isPrivate,visibility` on each), so `actions/checkout`
and uv's anonymous git clone of gridfind need no token or deploy key in CI —
this is a plain `https://` git dependency, and GitHub allows anonymous HTTPS
clones of public repos. `astral-sh/setup-uv@v5` (already in `ci.yml`) installs
whatever interpreter `requires-python` calls for, the same way it does for
3.11 today — no CI config change needed beyond the pyproject bump itself.

## The shaded cells ctypes build

`finders/shaded/fastclimb.py` shells out to `gcc` on first import to build
`shaded_fast.so` into the worktree's `.scratch/shaded/build/`, then loads it
via `ctypes.CDLL`. This has no dependency on the Python version beyond
`ctypes` itself (stable stdlib module, unaffected by 3.14). Ran
`uv run finders/shaded/fastclimb.py --test` under the 3.14 venv with gridfind
installed: builds and passes its parity test against `shapes.py`
(`parity OK (plain/eight/pins)`, 20000 shapes each leg).

## Existing generators and tests on 3.14

`just test` (Node + Python suite, skipping the heavy/soundness legs) passed
in full under the 3.14 venv — exit 0, every `PASS`/`ok` line present, no
tracebacks. Not run: `just check-full` (heavy tests + soundness fuzz) — out
of scope for a 10-minute probe and not needed to answer the resolution
question; nothing in the heavy suite touches Python-version-sensitive syntax.

## What breaks: PEP 758 reformat

`uvx ruff` (0.16.7) infers its target Python version from `requires-python`.
At `>=3.14` it applies PEP 758 (parenthesized multi-exception clauses become
optional in 3.14) and wants to rewrite `except (A, B):` to `except A, B:`.
`uvx ruff format --check` failed on exactly 2 files today:
`examples/_shared/check_layout.py` and `examples/_shared/link_swap.py`
(confirmed by diffing against the `>=3.11` baseline, where `ruff format
--check` passes clean on the same files). This is real 3.14 syntax (PEP 758
landed in CPython 3.14), not a ruff bug or truncation — old-style bare-comma
`except A, B:` (Python 2) is a different, invalid construct; PEP 758's
grammar is unambiguous only from 3.14 on, which is why ruff only offers the
rewrite once `requires-python` says 3.14. Fix is mechanical: `just fmt` once,
repo-wide, as part of landing the bump — not a per-PR recurring cost.

## Local path override for co-development

Per uv's dependency-sources docs
(<https://docs.astral.sh/uv/concepts/projects/dependencies/#path>), toggling
between the pinned git sha and a local gridfind checkout without committing
the toggle is a `[tool.uv.sources]` swap:

```toml
[project]
dependencies = ["gridfind"]

[tool.uv.sources]
gridfind = { git = "https://github.com/caneff/gridfind", rev = "<pinned-sha>" }
```

For local co-development, override just that one table entry to a path
source, editable so edits in the local gridfind checkout are live without a
rebuild:

```toml
[tool.uv.sources]
gridfind = { path = "../../gridfind", editable = true }
```

To do this **without committing** the swap, checked against
<https://docs.astral.sh/uv/concepts/configuration-files/>: uv discovers a
`uv.toml` in the project directory and, if present, **uv.toml wins wholesale
over `pyproject.toml`'s `[tool.uv]` table — not a per-key merge.** ("if both
`uv.toml` and `pyproject.toml` files are present in a directory,
configuration will be read from `uv.toml`, and `[tool.uv]` section in the
accompanying `pyproject.toml` will be ignored.") So a gitignored `uv.toml`
overriding just `gridfind`'s source would silently drop every other
`[tool.uv]` setting this repo has (`package = false`, any future sources,
etc.) — it isn't a safe single-key override. The two options that are safe:
1. **Duplicate the whole `[tool.uv]` table** into the gitignored `uv.toml`
   (sans the `[tool.uv]` prefix, per the docs) with the path source swapped
   in, and keep it in sync by hand whenever `pyproject.toml`'s `[tool.uv]`
   table changes. Workable but a maintenance trap given the wholesale
   override.
2. **Shadow the venv instead of the source table**: leave `pyproject.toml`
   committed with the pinned git source, `uv sync` normally, then
   `uv pip install -e ../gridfind` into the resulting `.venv` for local
   co-dev. This never touches `pyproject.toml`/`uv.lock`, so nothing to
   avoid committing — but it's an extra manual step after every `uv sync`
   (a bare `uv sync` re-resolves the git source and un-shadows it), and it
   is a `uv pip` (legacy-compatible) command, not a first-class `uv sync`
   source, so it needs its own note in the repo's docs if adopted.
Option 1 matches the intent of "local path override toggled without
committing" most directly; option 2 is lower-ceremony but easier to forget.
Recommend deciding between them as part of the actual dependency-adding
ticket, not this probe.

## What did not break, worth noting explicitly

- No conflict between this repo's own `ortools`/`lzstring` deps and
  gridfind's own pins of the same packages — uv unified them.
- No `dependency-groups` / dev-dependency friction.
- No workspace needed — a plain git source, not a `tool.uv.workspace`
  member, since this repo doesn't want to build gridfind as a sibling
  package in the same repo.
