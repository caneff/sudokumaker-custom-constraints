"""Split framebuild.unique() wall time into model build, first solve, second solve.

The body of `unique` below is a copy of examples/_shared/framebuild.py `unique`
as of base 9c703cf with clock calls added; it counts first-solve failures only,
not second-solve timeouts. Usage: uv run python <this file> <n> <bh> <bw> <seeds>
"""
import importlib.util, pathlib, sys, time
ROOT = pathlib.Path(__file__).resolve().parents[3]
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
