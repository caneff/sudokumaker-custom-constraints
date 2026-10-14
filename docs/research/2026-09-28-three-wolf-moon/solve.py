"""Three Wolf Moon feasibility: two independent CP-SAT encodings + a plain checker."""
import json, sys
from ortools.sat.python import cp_model

R = range(9)
box = lambda r, c: 3 * (r // 3) + c // 3


def bool_model(allow_overlap=False):
    m = cp_model.CpModel()
    x = {(r, c, d): m.NewBoolVar(f"x{r}{c}{d}") for r in R for c in R for d in R}
    for a in R:
        for d in R:
            m.AddExactlyOne(x[a, c, d] for c in R)
            m.AddExactlyOne(x[r, a, d] for r in R)
            m.AddExactlyOne(x[r, c, d] for r in R for c in R if box(r, c) == a)
        for b in R:
            m.AddExactlyOne(x[a, b, d] for d in R)
    for a in R:
        # box set (digit == box): one per row, one per column
        m.AddExactlyOne(x[a, c, box(a, c)] for c in R)
        m.AddExactlyOne(x[r, a, box(r, a)] for r in R)
        # row set (digit == row): one per column, one per box
        m.AddExactlyOne(x[r, a, r] for r in R)
        m.AddExactlyOne(x[r, c, r] for r in R for c in R if box(r, c) == a)
        # column set (digit == column): one per row, one per box
        m.AddExactlyOne(x[a, c, c] for c in R)
        m.AddExactlyOne(x[r, c, c] for r in R for c in R if box(r, c) == a)
    if not allow_overlap:
        for r in R:
            for c in R:
                for d in R:
                    if [box(r, c), r, c].count(d) >= 2:
                        m.Add(x[r, c, d] == 0)
    read = lambda s: [[next(d for d in R if s.Value(x[r, c, d])) for c in R] for r in R]
    return m, read


def int_model(allow_overlap=False):
    m = cp_model.CpModel()
    v = [[m.NewIntVar(0, 8, f"v{r}{c}") for c in R] for r in R]
    for a in R:
        m.AddAllDifferent(v[a])
        m.AddAllDifferent([v[r][a] for r in R])
        m.AddAllDifferent([v[r][c] for r in R for c in R if box(r, c) == a])
    isb, isr, isc = {}, {}, {}
    for r in R:
        for c in R:
            for name, tgt, dct in (("b", box(r, c), isb), ("r", r, isr), ("c", c, isc)):
                t = m.NewBoolVar(f"{name}{r}{c}")
                m.Add(v[r][c] == tgt).OnlyEnforceIf(t)
                m.Add(v[r][c] != tgt).OnlyEnforceIf(t.Not())
                dct[r, c] = t
            if not allow_overlap:
                m.Add(isb[r, c] + isr[r, c] + isc[r, c] <= 1)
    for a in R:
        m.Add(sum(isb[a, c] for c in R) == 1)
        m.Add(sum(isb[r, a] for r in R) == 1)
        m.Add(sum(isr[r, a] for r in R) == 1)
        m.Add(sum(isr[r, c] for r in R for c in R if box(r, c) == a) == 1)
        m.Add(sum(isc[a, c] for c in R) == 1)
        m.Add(sum(isc[r, c] for r in R for c in R if box(r, c) == a) == 1)
    read = lambda s: [[s.Value(v[r][c]) for c in R] for r in R]
    return m, read


def solve(builder, allow_overlap=False):
    m, read = builder(allow_overlap)
    s = cp_model.CpSolver()
    s.parameters.num_workers = 1
    s.parameters.max_time_in_seconds = 60
    st = s.Solve(m)
    name = s.StatusName(st)
    grid = read(s) if st in (cp_model.OPTIMAL, cp_model.FEASIBLE) else None
    return name, s.WallTime(), grid


if __name__ == "__main__":
    out = {}
    for label, b in (("bool", bool_model), ("int", int_model)):
        name, t, g = solve(b)
        out[label] = {"status": name, "wall_s": round(t, 3),
                      "grid": None if g is None else [[d + 1 for d in row] for row in g]}
        print(label, name, f"{t:.3f}s")
    json.dump(out, open(sys.argv[1], "w"), indent=1)
