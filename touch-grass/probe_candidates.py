"""Per-cell feasible-value sets for a Touch grass board, by CP-SAT probing.

    uv run --with ortools python probe_candidates.py <board.json> <cands_out.json>

Families are found by rule prefix; the Outside window is whatever each group
ships. Each satisfiable probe donates its whole solution to every cell's
candidate set; each unsatisfiable probe eliminates one (cell, digit) pair.
"""

import json
import sys

from ortools.sat.python import cp_model

doc = json.load(open(sys.argv[1]))
p = doc["puzzle"]
by_name = {c.get("name"): c for c in p["constraints"]}

house_groups = []
for kind in ("Regions", "Columns", "Rows"):
    for color in ("Red", "Blue", "Purple", "Green"):
        for g in by_name[f"{kind} ({color})"]["input"]["groups"]:
            house_groups.append(g["cells"])

FAMILIES = []
for prefix, rule in (("Numbered Rooms (", "nr"), ("Skyscrapers (", "sky"),
                     ("Running Start (", "rs"), ("Outside Sudoku (", "out")):
    for name, c in by_name.items():
        if name and name.startswith(prefix):
            FAMILIES.append((rule, c))
if len(FAMILIES) != 4:
    raise SystemExit(f"expected 4 clue families, found {len(FAMILIES)}")

need = set()
for cs in house_groups:
    need.update(cs)
for _, c in FAMILIES:
    for g in c["input"]["groups"]:
        need.update(g["cells"])


def build(fixed=None):
    m = cp_model.CpModel()
    x = {i: m.NewIntVar(1, 6, f"x{i}") for i in need}
    for cs in house_groups:
        m.AddAllDifferent([x[i] for i in cs])
    for rule, c in FAMILIES:
        for t, g in enumerate(c["input"]["groups"]):
            clue, line = g["cells"][0], g["cells"][1:]
            n = len(line)
            if rule == "nr":
                ix = m.NewIntVar(0, n - 1, f"ix{t}{clue}")
                m.Add(ix == x[line[0]] - 1)
                m.AddElement(ix, [x[i] for i in line], x[clue])
            elif rule == "sky":
                vis = []
                for a in range(n):
                    b = m.NewBoolVar(f"v{t}{clue}_{a}")
                    if a == 0:
                        m.Add(b == 1)
                    else:
                        gs = []
                        for j in range(a):
                            g2 = m.NewBoolVar(f"g{t}{clue}_{a}_{j}")
                            m.Add(x[line[a]] > x[line[j]]).OnlyEnforceIf(g2)
                            m.Add(x[line[a]] <= x[line[j]]).OnlyEnforceIf(g2.Not())
                            gs.append(g2)
                        m.AddBoolAnd(gs).OnlyEnforceIf(b)
                        m.AddBoolOr([g2.Not() for g2 in gs]).OnlyEnforceIf(b.Not())
                    vis.append(b)
                m.Add(sum(vis) == x[clue])
            elif rule == "rs":  # strict: run = longest strictly ascending prefix
                inc = []
                for a in range(1, n):
                    b = m.NewBoolVar(f"i{t}{clue}_{a}")
                    m.Add(x[line[a]] > x[line[a - 1]]).OnlyEnforceIf(b)
                    m.Add(x[line[a]] <= x[line[a - 1]]).OnlyEnforceIf(b.Not())
                    inc.append(b)
                for k in range(1, n + 1):
                    b = m.NewBoolVar(f"k{t}{clue}_{k}")
                    m.Add(x[clue] == k).OnlyEnforceIf(b)
                    m.Add(x[clue] != k).OnlyEnforceIf(b.Not())
                    for a in range(k - 1):
                        m.AddImplication(b, inc[a])
                    if k < n:
                        m.AddImplication(b, inc[k - 1].Not())
            elif rule == "out":  # clue appears among the shipped window cells
                lits = []
                for i2 in line:
                    b = m.NewBoolVar(f"w{t}{clue}_{i2}")
                    m.Add(x[i2] == x[clue]).OnlyEnforceIf(b)
                    lits.append(b)
                m.AddBoolOr(lits)
    if fixed:
        m.Add(x[fixed[0]] == fixed[1])
    return m, x


def solve(fixed=None):
    m, x = build(fixed)
    s = cp_model.CpSolver()
    s.parameters.max_time_in_seconds = 60 if fixed is None else 30
    s.parameters.num_workers = 8
    return s.StatusName(s.Solve(m)), s, x


st, s, x = solve()
assert st in ("OPTIMAL", "FEASIBLE"), st
cand = {i: {s.Value(x[i])} for i in need}
probes = 0
for i in sorted(need):
    for d in range(1, 7):
        if d in cand[i]:
            continue
        st, s2, x2 = solve((i, d))
        probes += 1
        if st in ("OPTIMAL", "FEASIBLE"):
            for j in need:
                cand[j].add(s2.Value(x2[j]))
        elif st != "INFEASIBLE":
            raise RuntimeError(f"probe UNKNOWN at cell {i} digit {d}")
json.dump({str(i): sorted(cand[i]) for i in need}, open(sys.argv[2], "w"))
forced = sum(1 for i in need if len(cand[i]) == 1)
print("probes:", probes, "forced:", forced, "cells:", len(need))
