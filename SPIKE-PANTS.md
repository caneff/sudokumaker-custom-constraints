# Pants spike: diff-based test selection on the pilot

Throwaway. Branch `prototype/pants-spike`, cut from 843e333. Pants 2.33.1,
2026-10-11, one box (WSL2, 32 cores, capped at 4 Pants processes).
Every result below is a claim to re-run with the command shown. `pants` means
`.scratch/tools/pants` run from the worktree root. Items 2, 5 and 6 were run
through a wrapper that also exported `UV_PROJECT_ENVIRONMENT=$PWD/.venv`;
commit cabcc95 removed the need for it and does not change the graph.

## Verdict

**Workable with these changes**, for the scoped directories:

- 6 new files (`pants.toml`, 5 `BUILD`), 117 lines; 1 line in `.gitignore`.
- **0 test files edited, 0 source files edited.** No pytest conversion, no
  `sys.path` hop removed. The tests run as the scripts they are
  (`uv run file.py`, `node file.test.mjs`) inside `test_shell_command` targets.
- Import edges are inferred, Python and `.mjs` both. Every other edge (a file
  read, a script started as a subprocess, a `// #include`, a Markdown file) is
  hand-declared: 13 `overrides` entries here. A missing one fails the test in
  the sandbox; that is how I found every one.

Holes found, all measured below: a `pants.toml`-only edit selects nothing; the
`node`, `uv` binaries and uv's package cache sit outside the sandbox; a
duplicate module basename drops the edge with a warning unless one option is
set; Pants' own pytest and JS test targets do not fit this repo.

## What is on the branch

| File | Lines | What |
|---|---|---|
| `pants.toml` | 28 | backends, 4 source roots, parallelism 4, `by_source_root` |
| `BUILD` | 5 | `files` for `pyproject.toml` + `uv.lock`, `files` for one Markdown doc |
| `finders/hunt/BUILD` | 1 | `python_sources` |
| `finders/ubahn/BUILD` | 22 | `python_sources`, fixtures, 5 `test_shell_command` |
| `examples/_shared/BUILD` | 19 | `python_sources`, `javascript_sources`, vendor files |
| `examples/up-to-n/BUILD` | 42 | sources, data files, 4 `test_shell_command` |

The branch also carries the experiment commits: 9 tracked files have a junk
comment or trailing newline from items 5a to 5d (not reverted), and items 2,
3, 4 and 6 are commit plus revert pairs.

## 1. Getting the 9 tests green

Shape: each test is a `test_shell_command` whose `execution_dependencies` is
the test file's own `python_source` / `javascript_source` target plus
`//:uvproject`. Pants follows that target's inferred imports transitively and
copies exactly that closure into the sandbox.

- 489ebfa, no hand-declared edge at all: **2 of 9 green**
  (`test_ubahn_brute`, `test_ubahn_measure`). The other 7 failed on a file the
  sandbox did not hold; the errors are quoted under item 6.
- 6469e22, after declaring them (13 `overrides` entries): **9 of 9 green**.

What had to be declared by hand, because no import statement shows it:

| Reader | Needs | Kind |
|---|---|---|
| `ubahn/test_penpa.py`, `test_ubahn_hunt.py` | `ubahn_finder.py` | `subprocess.run([sys.executable, FINDER])` |
| `ubahn/test_penpa.py`, `time_sat.py` | `fixtures/*` | file read |
| `_shared/bundle-solve-lib.mjs` | `link_codec_cli.py` | `execFileSync('uv', ['run', ...])` |
| `_shared/bundle-load.mjs` | `vendor/*` | file read |
| `_shared/framebuild.py`, `no_ring.py` | every shared `.js` | read by computed name |
| `_shared/component_scan.py` | `docs/builtin-components.md` | Markdown read |
| `up-to-n/UpToNComponent.js` | `_shared/line-kind.js` | `// #include` |
| `up-to-n` tests, `build_size.py` | `main.js`, `UpToNComponent.js`, `.golden/*.js`, `*.json`, `PUZZLE_LINK*.txt` | file read |

## 2. Inference through `sys.path.insert`; duplicate basenames

Inference does not read `sys.path.insert`. It works because each directory a
script puts on `sys.path` is listed as a source root in `pants.toml`, so
`import dedupe` resolves to `finders/hunt/dedupe.py`.

```
$ pants dependencies finders/ubahn/test_ubahn_hunt.py:src
finders/hunt/dedupe.py:src
finders/hunt/subprocess_env.py:src
finders/hunt/verified_io.py:src
finders/ubahn/brute.py:src
finders/ubahn/network.py:src

$ pants dependencies finders/ubahn/model.py:src
finders/hunt/uniqueness.py:src
finders/ubahn/network.py:src

$ pants dependencies examples/up-to-n/build_link.test.py:py
examples/_shared/cpsat.py:py
examples/_shared/framebuild.py:py
examples/_shared/link_codec.py:py
examples/_shared/link_swap.py:py
examples/_shared/minify.py:py
examples/_shared/no_ring.py:py
examples/up-to-n/build_size.py:py

$ pants dependents --transitive finders/hunt/dedupe.py:src     (ubahn rows only)
finders/ubahn:src
finders/ubahn:test_ubahn_hunt
finders/ubahn:test_ubahn_measure
finders/ubahn/measure_baseline.py:src
finders/ubahn/test_ubahn_hunt.py:src
finders/ubahn/test_ubahn_measure.py:src
finders/ubahn/ubahn_finder.py:src
```

`*.test.py` file names are accepted by `python_sources`.

Duplicate basename, commit b1bb6d9: `finders/qqrr` added as a fifth source
root, so `model.py` exists in two roots.

```
$ pants dependencies finders/ubahn/ubahn_finder.py:src
[WARN] The target finders/ubahn/ubahn_finder.py:src imports `model`, but Pants cannot safely
infer a dependency because more than one target owns this module, so it is ambiguous which to
use: ['finders/qqrr/model.py:src', 'finders/ubahn/model.py:src'].
$ pants dependents finders/ubahn/model.py:src
finders/ubahn:src                      <- every importer gone
$ pants test finders/ubahn:test_ubahn_sat
ModuleNotFoundError: No module named 'model'
✕ finders/ubahn:test_ubahn_sat failed in 0.07s.
```

So the default is: a warning, the edge dropped, and the test red. Commit
35d73bc sets `[python-infer] ambiguity_resolution = "by_source_root"`:

```
$ pants dependencies finders/ubahn/test_ubahn_sat.py:src
finders/ubahn/brute.py:src
finders/ubahn/model.py:src
finders/ubahn/network.py:src
finders/ubahn/sat_model.py:src
finders/ubahn/time_sat.py:src
$ pants dependencies finders/qqrr/checker.py:src
finders/qqrr/model.py:src
finders/qqrr/oracle.py:src
$ pants test finders/ubahn:test_ubahn_sat
✓ finders/ubahn:test_ubahn_sat succeeded in 5.87s (cached locally).
```

Not tested: a duplicate name imported from a third root, where neither owner
shares the importer's root (`render.py` is in `finders/hunt` and
`finders/counting_shaded`).

## 3. `uv.lock`

Pants does not read `uv.lock`. `pants help-advanced python` offers
`[python].resolver = one of: [pex, uv]`, described as "Which tool to use for
generating lockfiles": it writes a Pants lockfile, it does not read uv's.

What the branch does instead: uv stays the owner. `pyproject.toml` and
`uv.lock` are a `files` target every test depends on, and `uv run` builds the
venv inside the sandbox from them (cabcc95). A `uv.lock` edit selects all 9
tests (item 5d-4).

The Pants-native route, commit 678d42f (reverted):

- `python_requirements(source="pyproject.toml", module_mapping={"python-sat": ["pysat"]})`
  reads `[project].dependencies`.
- `pants generate-lockfiles` first failed on this box:
  `received exit code 1 during execution of ['/usr/bin/python3.12', '-I', '-m', 'venv', ...] ... ModuleNotFoundError: No module named 'ensurepip'`.
  The system Python has no `python3-venv`. I did not install it; I pointed
  `[python-bootstrap].search_path` at uv's own CPython 3.13 instead.
- It then wrote `3rdparty/python/default.lock`, 916 lines, in 25 s. Versions
  equal `uv.lock` today (ortools 9.15.6755, pillow 12.3.0, lzstring 1.0.4,
  python-sat 1.9.dev15) because both took the newest; nothing ties them.
- `python_tests` on `build_link.test.py`: pytest's default import mode fails
  with `ModuleNotFoundError: No module named 'build_link'`; with
  `-- --import-mode=importlib` it collects 4 items. 3 then fail with
  `FileNotFoundError: ... 'examples/up-to-n/main.js'`, even with
  `./main.js:js` in `dependencies`: a `javascript_source` dependency is not
  copied into the pytest sandbox. `test_shell_command` does copy it.

## 4. The `.mjs` half

Relative `.mjs` imports are **inferred** by the experimental JS backend, with
no `package.json` target:

```
$ pants dependencies examples/up-to-n/update-strength.test.mjs:js
examples/_shared/harness-lib.mjs:js
examples/up-to-n/fixture.mjs:js
$ pants dependencies examples/up-to-n/end-to-end.test.mjs:js
examples/_shared/bundle-solve-lib.mjs:js
examples/up-to-n/fixture.mjs:js
$ pants dependencies examples/_shared/harness-lib.mjs:js
examples/_shared/include.mjs:js
```

Node built-ins (`fs`, `path`) and npm packages (`acorn`, `playwright`) raise
an "cannot infer owners" warning each; `[nodejs-infer]
unowned_dependency_behavior = "ignore"` silences it. npm packages are
therefore not edges: none of the scoped tests imports one, and I did not wire
`package-lock.json`.

The backend's own test target does not fit, commit f144b4f (reverted):
`javascript_tests` needs a `package_json` target and the repo root as a source
root, ran an npm install (about 12 s), then:

```
> just test examples/up-to-n/marker-contract.test.mjs
/usr/bin/sh: 1: just: not found
✕ examples/up-to-n/marker-contract.test.mjs:jstests failed in 0.14s.
```

It runs `package.json#scripts.test`, which here is `just test`. The branch
runs `node file.test.mjs` through `test_shell_command` instead.

## 5. Selection experiments

Each is a commit; the command is
`pants --changed-since=HEAD~1 --changed-dependents=transitive --filter-target-type=test_shell_command list`
run at that commit.

| | Commit | File edited | Tests selected |
|---|---|---|---|
| a | 9dac36a | `finders/hunt/dedupe.py` | `test_penpa`, `test_ubahn_hunt`, `test_ubahn_measure` (3 of 5 ubahn) |
| b | 58cadee | `examples/_shared/harness-lib.mjs` | `update-strength.test`, `build_link.test` |
| c1 | eea5ac1 | `README.md`, `examples/skyscraper/main.js` (no target owns them) | none: `[WARN] No targets were matched in goal list.` |
| c2 | 046d2c9 | `finders/hunt/toy_finder.py`, `examples/up-to-n/README.md` | none |
| d1 | 6245d42 | `finders/ubahn/fixtures/timing-puzzles.json` | `test_penpa`, `test_ubahn_sat` |
| d2 | ad76b32 | `docs/builtin-components.md` | `build_link.test` |
| d3 | 4eb6d7b | `examples/up-to-n/gen_4x4.json` | `build_link.test`, `end-to-end.test` |
| d4 | 0e60992 | `uv.lock` | all 9 |

Reading the rows:

- a: the two not selected (`test_ubahn_brute`, `test_ubahn_sat`) do not reach
  `dedupe.py`. `test_penpa` is selected only through the hand-declared
  subprocess edge to `ubahn_finder.py`. The same command with the `test` goal
  ran exactly those 3, green.
- b: `update-strength.test` is the only one of the three `.mjs` tests that
  imports `harness-lib.mjs`; `end-to-end` and `marker-contract` do not.
  `build_link.test` (Python) is selected through a hand-declared edge.
- d: a non-code file is selected only when a `files(...)` target owns it and
  something names that target in `dependencies` / `overrides`. d1 selects
  `test_penpa` although it reads only the `.txt` fixtures, because I declared
  the whole `fixtures/*` glob (coarse on purpose).

Two more, uncommitted edits against `--changed-since=HEAD`:

```
(comment appended to finders/ubahn/BUILD)   -> all 5 ubahn tests selected
(comment appended to pants.toml)            -> 0 targets selected
```

## 6. Loud failure

Undeclared inputs at 489ebfa (`pants test ::`), one line each:

```
Error: ENOENT: no such file or directory, open 'examples/up-to-n/UpToNComponent.js'
error: Failed to spawn: `examples/_shared/link_codec_cli.py`  Caused by: No such file or directory (os error 2)
Error: ENOENT: no such file or directory, open 'examples/up-to-n/main.js'
.../python3: can't open file 'finders/ubahn/ubahn_finder.py': [Errno 2] No such file or directory
FileNotFoundError: [Errno 2] No such file or directory: 'finders/ubahn/fixtures/publ-knt.txt'
FileNotFoundError: [Errno 2] No such file or directory: 'finders/ubahn/fixtures/timing-puzzles.json'
```

Removing edges from the green state:

```
## 6a2, commit 528410b: `# pants: no-infer-dep` on model.py's `from uniqueness import check_uniqueness`
$ pants dependencies --transitive finders/ubahn:test_ubahn_brute | grep -c uniqueness
0
$ pants test finders/ubahn:test_ubahn_brute
ModuleNotFoundError: No module named 'uniqueness'
✕ finders/ubahn:test_ubahn_brute failed in 0.34s.

## 6b, commit 0ddb15d: remove the declared edge time_sat.py -> :fixtures
$ pants test finders/ubahn:test_ubahn_sat
FileNotFoundError: [Errno 2] No such file or directory: 'finders/ubahn/fixtures/timing-puzzles.json'
✕ finders/ubahn:test_ubahn_sat failed in 3.29s.

## 6c, commit 2896c73: mutation, dedupe.py raises at import
$ pants --changed-since=HEAD~1 --changed-dependents=transitive test
RuntimeError: spike mutation          (x3)
✕ finders/ubahn:test_penpa failed in 0.52s.
✕ finders/ubahn:test_ubahn_hunt failed in 0.07s.
✕ finders/ubahn:test_ubahn_measure failed in 0.06s.
```

A first try, commit 1f1af46 (6a), hid ubahn's four `dedupe` imports and the
test stayed green: `dedupe.py` still arrived through `finders/hunt/driver.py`,
so it was still in the closure. That is correct behaviour, and a reminder that
removing one edge proves nothing unless it is the only path.

Where the sandbox does not reach (not loud):

- **The worktree `.venv`, before cabcc95.** With `UV_PROJECT_ENVIRONMENT`
  pointing at it, moving `lzstring` out of `.venv` made the native command
  fail (`ModuleNotFoundError: No module named 'lzstring'`) while
  `pants --no-pantsd test examples/up-to-n:end-to-end.test` printed
  `✓ ... (cached locally)`. After cabcc95 the sandbox builds its own venv and
  the same probe, with `--no-local-cache`, passes for the right reason.
- `node` and `uv` come from `PATH` (`tools=[...]`), and uv's package cache and
  managed CPython come from `HOME`. A new Node or uv is not a tracked input.
  Not measured.
- A `pants.toml`-only edit selects nothing (item 5).

## 7. Cost

- Files: 6 added, 1 edited (`.gitignore`, `+.pants.d/`). 117 lines of
  `pants.toml` + `BUILD`. Test and source files edited: 0.
- Wall time, 9 scoped tests, 4 processes:

| Run | Command | Wall |
|---|---|---|
| Native, serial | `uv run` / `node` in a loop | 57.7 s |
| Pants, cold | `pants --no-pantsd --no-local-cache test ::` | 29.6 s (31.7 s with the shared venv) |
| Pants, daemon up, results cached on disk | `pants test ::` | 2.9 s |
| Pants, daemon up, memoized | `pants test ::` again | 0.16 s |
| Pants, no daemon, results cached | `pants --no-pantsd test ::` | 3.4 s |
| Selection only, daemon up | `--changed-since ... list` | 0.9 s |
| Selection only, no daemon | same with `--no-pantsd` | 3.1 s |

  The cold run is bounded by `test_ubahn_brute` (26.6 s). A per-sandbox venv
  cost about 0.2 to 1 s per Python test. First-ever launch (`pants --version`,
  downloads Pants) was 25.9 s.
- Disk, both created by this spike: `~/.cache/nce` 822M (Pants and its
  Python), `~/.cache/pants` 772M (`lmdb_store` 295M, `named_caches` 478M;
  includes the item 3 Pex resolve and the item 4 npm install).
  In the worktree: `.pants.d/` 604K, `.scratch/tools/pants` 11M.
- Daemon: one `pantsd` per checkout, about 208 MB RSS. Stopped at the end of
  the spike.

## Could not establish

- Whether a Node, uv or CPython upgrade invalidates cached results. I expect
  not; no run tested it.
- Cross-root duplicate basenames (item 2, last line).
- npm packages as edges (`package-lock.json`); no scoped test imports one.
- Behaviour when uv's cache is cold or the box is offline inside the sandbox.
- Anything outside the four scoped directories: the remaining examples and
  finders, the heavy suites, `tests/all.sh`.
- Remote caching, CI wiring, and how the daemon behaves across many
  worktrees.

## My choices, flag if you disagree

- `test_shell_command` over pytest conversion: it was the least change and
  the only route that carried `.js` files into a Python test's sandbox.
- One source root per directory that today goes on `sys.path`.
- Coarse declarations in three places: all shared `.js` for `framebuild.py`
  and `no_ring.py`; the whole `fixtures/*` glob; `uvproject` on the `.mjs`
  tests too (one of them shells out to `uv run`).
- `HOME` passed into every sandbox so uv finds its cache.
- `finders/qqrr` wired for item 2 only, then removed.
- Used uv's CPython 3.13 for item 3 instead of asking for `python3-venv`.
