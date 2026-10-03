# Framebuild carve cost: solve dominates, a C solver is not worth it (2026-10-03)

Ticket #473, step 1. Question: in `framebuild.generate`, is the carve's cost
model construction and solver startup, or the CP-SAT search itself?

**Verdict: the search. Model build is about 7% of `unique()`; the two solves
are about 93%. Step 2 (a C bitmask DFS) is not started, as the ticket says.**

## Measurement

One 9x9 skyscraper `generate` (`examples/skyscraper/build_size.py`, box 3x3,
seeds 101 up), `unique` replaced by a copy that times each phase with
`time.perf_counter`. Same model, same `cpsat.solver(SOLVE_LIMIT)`, same
`forbid`; only the clock calls differ. Box load average was about 4 on a
32-core WSL machine. Reps: one per row, no repeats.

| seeds | wall | `unique()` calls | build | first solve | forbid | second solve | loop overhead |
|---|---|---|---|---|---|---|---|
| 3 (101-103) | 34.3 s | 174 | 2.10 s (6.1%) | 16.08 s (46.9%) | 0.12 s (0.3%) | 15.97 s (46.6%) | 0.04 s |
| 10 (101-110) | 85.9 s | 575 | 6.14 s (7.1%) | 39.87 s (46.4%) | 0.33 s (0.4%) | 39.39 s (45.9%) | 0.13 s |

Per call (10 seeds): build 10.7 ms, first solve 69.3 ms, second solve 68.5 ms.

- Every call reached its second solve: no first solve came back empty, so no
  call spent the 10 s cap, and none returned `None`.
- Calls per seed: about 57, not the ticket's 117 (`n^2 + 4n`). The given-adding
  loop stops at the first unique board, and the given-removal pass walks only
  the givens that were added (4 to 6 here); only the 4n = 36 ring-key pass is
  full length, and it runs once on the chosen board.
- Extrapolated to the 40-seed default: about 5.7 min under this load (the
  `up-to-n` README says about 4 min for its own 9x9). The cost scales with
  seed count and is per-solve, not per-model.

## What follows

- Removing all model build (the best a C solver or a reused model could do on
  that axis) saves at most 7%. The CP-SAT solves are about 70 ms each at 9x9
  with 20 shown clues, not "milliseconds".
- A C bitmask DFS would replace the solves, not the build, so its payoff is a
  different question from the ticket's premise: it would have to beat about
  70 ms per proof at 9x9 with the Spec's clue check at the leaves. This
  measurement does not say whether it would; it only removes the stated
  reason for trying (build dominating). Not measured: `up-to-n` and the 4x4
  and 6x6 sizes, other ring-key counts, and a bitmask DFS of any kind.
- The `ortools-tuning.md` idea (one solve with `x[p] != v` in place of "find
  any, then forbid it") targets the same solve time. `unique` already makes
  exactly two solves, because it needs a first solution to forbid; the idea
  applies to the strip loops that ask for any solution, not to this call.

## Reproduce

Run from the repo root as `uv run python measure_carve.py 9 3 3 10`, with the
script below saved there. It imports `examples/_shared/framebuild.py` and the
skyscraper Spec; it writes nothing.

```python
"""Split framebuild.unique() wall time into model build, first solve, second solve."""
import importlib.util, pathlib, sys, time
ROOT = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "examples/_shared"))
import framebuild, cpsat
from ortools.sat.python import cp_model

spec_mod = importlib.util.spec_from_file_location("sky_build", ROOT / "examples/skyscraper/build_size.py")
mod = importlib.util.module_from_spec(spec_mod); spec_mod.loader.exec_module(mod)

T = {"build": 0.0, "solve1": 0.0, "solve2": 0.0, "forbid": 0.0}
calls = {"n": 0, "none": 0, "second": 0}

def unique(post_clue, board):
    calls["n"] += 1
    t0 = time.perf_counter()
    n, bh, bw = board.n, board.bh, board.bw
    m = cp_model.CpModel()
    x = {(r, c): m.NewIntVar(1, n, f"x{r}{c}") for r in range(n) for c in range(n)}
    for i in range(n):
        m.AddAllDifferent([x[i, c] for c in range(n)])
        m.AddAllDifferent([x[r, i] for r in range(n)])
    for br in range(0, n, bh):
        for bc in range(0, n, bw):
            m.AddAllDifferent([x[br + dr, bc + dc] for dr in range(bh) for dc in range(bw)])
    for (r, c), v in board.givens.items():
        m.Add(x[r, c] == v)
    for k in sorted(board.active):
        post_clue(m, x, board.lines[k], board.clue[k], n, framebuild._ring_name(k), board.box)
    t1 = time.perf_counter(); T["build"] += t1 - t0
    s = cpsat.solver(framebuild.SOLVE_LIMIT)
    st = s.Solve(m)
    t2 = time.perf_counter(); T["solve1"] += t2 - t1
    if st not in cpsat.SOLVED:
        calls["none"] += 1
        return None
    s1 = {(r, c): s.Value(x[r, c]) for r in range(n) for c in range(n)}
    t3 = time.perf_counter()
    cpsat.forbid(m, x, s1)
    t4 = time.perf_counter(); T["forbid"] += t4 - t3
    s2 = cpsat.solver(framebuild.SOLVE_LIMIT)
    st2 = s2.Solve(m)
    T["solve2"] += time.perf_counter() - t4
    calls["second"] += 1
    if st2 == cp_model.UNKNOWN:
        return None
    return st2 not in cpsat.SOLVED

framebuild.unique = unique
n, bh, bw, k = map(int, sys.argv[1:5])
t = time.perf_counter()
framebuild.generate(mod.SPEC, n, bh, bw, range(101, 101 + k))
wall = time.perf_counter() - t
tot = sum(T.values())
print(f"\nn={n} seeds={k} wall={wall:.1f}s unique() calls={calls['n']} (no first solution: {calls['none']}, reached 2nd solve: {calls['second']})")
for key, v in T.items():
    print(f"  {key:7s} {v:8.2f}s  {100*v/wall:5.1f}% of wall  {1000*v/calls['n']:.2f} ms/call")
print(f"  other   {wall-tot:8.2f}s (python carve loop, replace(), shuffles)")
```
