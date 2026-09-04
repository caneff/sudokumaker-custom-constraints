"""1x1 geometry, wide boxes, Outside = first-box window (3 along rows,
2 down columns): which of the 24 rule->grid assignments are feasible?"""
import itertools
from ortools.sat.python import cp_model

W = 20
GRIDS = {"Red": (2, 7), "Blue": (7, 12), "Purple": (7, 2), "Green": (12, 7)}
R6 = range(6)
i = lambda r, c: r * W + c

def houses():
    hs = []
    for r0, c0 in GRIDS.values():
        for k in R6:
            hs.append([i(r0 + k, c0 + j) for j in R6])
            hs.append([i(r0 + j, c0 + k) for j in R6])
        for br in range(0, 6, 2):
            for bc in range(0, 6, 3):
                hs.append([i(r0 + br + dr, c0 + bc + dc) for dr in range(2) for dc in range(3)])
    return hs
HOUSES = houses()

def groups(r0, c0, firstbox):
    gs = []
    for k in R6:
        r, c = r0 + k, c0 + k
        if firstbox:
            gs.append([i(r, c0 - 1), i(r, c0), i(r, c0 + 1), i(r, c0 + 2)])
            gs.append([i(r, c0 + 6), i(r, c0 + 5), i(r, c0 + 4), i(r, c0 + 3)])
            gs.append([i(r0 - 1, c), i(r0, c), i(r0 + 1, c)])
            gs.append([i(r0 + 6, c), i(r0 + 5, c), i(r0 + 4, c)])
        else:
            gs.append([i(r, c0 - 1)] + [i(r, c0 + j) for j in R6])
            gs.append([i(r, c0 + 6)] + [i(r, c0 + 5 - j) for j in R6])
            gs.append([i(r0 - 1, c)] + [i(r0 + j, c) for j in R6])
            gs.append([i(r0 + 6, c)] + [i(r0 + 5 - j, c) for j in R6])
    return gs

def add_rule(m, x, rule, gs):
    for t, cs in enumerate(gs):
        clue, line = cs[0], cs[1:]
        n = len(line)
        tag = f"{rule}{t}{clue}"
        if rule == "nr":
            ix = m.NewIntVar(0, n - 1, "ix" + tag)
            m.Add(ix == x[line[0]] - 1)
            m.AddElement(ix, [x[c] for c in line], x[clue])
        elif rule == "sky":
            vis = []
            for a in range(n):
                b = m.NewBoolVar(f"v{tag}_{a}")
                if a == 0: m.Add(b == 1)
                else:
                    gg = []
                    for j in range(a):
                        g2 = m.NewBoolVar(f"g{tag}_{a}_{j}")
                        m.Add(x[line[a]] > x[line[j]]).OnlyEnforceIf(g2)
                        m.Add(x[line[a]] <= x[line[j]]).OnlyEnforceIf(g2.Not())
                        gg.append(g2)
                    m.AddBoolAnd(gg).OnlyEnforceIf(b)
                    m.AddBoolOr([g2.Not() for g2 in gg]).OnlyEnforceIf(b.Not())
                vis.append(b)
            m.Add(sum(vis) == x[clue])
        elif rule == "rs":
            inc = []
            for a in range(1, n):
                b = m.NewBoolVar(f"i{tag}_{a}")
                m.Add(x[line[a]] > x[line[a - 1]]).OnlyEnforceIf(b)
                m.Add(x[line[a]] <= x[line[a - 1]]).OnlyEnforceIf(b.Not())
                inc.append(b)
            for k in range(1, n + 1):
                b = m.NewBoolVar(f"k{tag}_{k}")
                m.Add(x[clue] == k).OnlyEnforceIf(b)
                m.Add(x[clue] != k).OnlyEnforceIf(b.Not())
                for a in range(k - 1): m.AddImplication(b, inc[a])
                if k < n: m.AddImplication(b, inc[k - 1].Not())
        elif rule == "out":
            lits = []
            for c in line:
                b = m.NewBoolVar(f"w{tag}_{c}")
                m.Add(x[c] == x[clue]).OnlyEnforceIf(b)
                lits.append(b)
            m.AddBoolOr(lits)

def solve(assign):
    m = cp_model.CpModel()
    need = set()
    for cs in HOUSES: need.update(cs)
    gsets = {color: groups(*o, assign[color] == "out") for color, o in GRIDS.items()}
    for gs in gsets.values():
        for cs in gs: need.update(cs)
    x = {c: m.NewIntVar(1, 6, f"x{c}") for c in need}
    for cs in HOUSES: m.AddAllDifferent([x[c] for c in cs])
    for color, rule in assign.items():
        add_rule(m, x, rule, gsets[color])
    s = cp_model.CpSolver()
    s.parameters.max_time_in_seconds = 60
    s.parameters.num_workers = 8
    return s.StatusName(s.Solve(m))

hits = 0
for perm in itertools.permutations(["nr", "sky", "rs", "out"]):
    assign = dict(zip(GRIDS, perm))
    st = solve(assign)
    if st != "INFEASIBLE":
        hits += 1
        print("HIT:", assign, st, flush=True)
print(hits, "of 24 feasible; done", flush=True)
