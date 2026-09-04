"""Feasibility of a Touch grass board: houses + the four clue families with
clue cells as variables, groups read straight from the board JSON.

    uv run --with ortools python check_feasible.py [board_out.json]

Rule semantics match the repo examples' generators (skyscraper/build_size.py,
running-start/generate.py strict ties, numbered-rooms/build_size.py,
outside-sudoku/outside_rule.py). The Outside window is whatever the group
ships (clue first, then the window cells).
"""

import json
import sys

from ortools.sat.python import cp_model

doc = json.load(open(sys.argv[1] if len(sys.argv) > 1 else "board_out.json"))
p = doc["puzzle"]
by_name = {c.get("name"): c for c in p["constraints"]}

house_groups = []
for kind in ("Regions", "Columns", "Rows"):
    for color in ("Red", "Blue", "Purple", "Green"):
        for g in by_name[f"{kind} ({color})"]["input"]["groups"]:
            house_groups.append(g["cells"])

FAMILIES = []
for name, rule in (("Numbered Rooms (Blue)", "nr"), ("Skyscrapers (Red)", "sky"),
                   ("Running Start (Purple)", "rs"), ("Outside Sudoku (Green)", "out")):
    if name in by_name:
        FAMILIES.append((rule, by_name[name]))

need = set()
for cs in house_groups:
    need.update(cs)
for _, c in FAMILIES:
    for g in c["input"]["groups"]:
        need.update(g["cells"])

m = cp_model.CpModel()
x = {i: m.NewIntVar(1, 6, f"x{i}") for i in need}
for cs in house_groups:
    m.AddAllDifferent([x[i] for i in cs])
for rule, c in FAMILIES:
    for t, g in enumerate(c["input"]["groups"]):
        clue, line = g["cells"][0], g["cells"][1:]
        n = len(line)
        if rule == "nr":
            ix = m.NewIntVar(0, n - 1, f"ix{t}")
            m.Add(ix == x[line[0]] - 1)
            m.AddElement(ix, [x[i] for i in line], x[clue])
        elif rule == "sky":
            vis = []
            for a in range(n):
                b = m.NewBoolVar(f"v{t}_{a}")
                if a == 0:
                    m.Add(b == 1)
                else:
                    gs = []
                    for j in range(a):
                        g2 = m.NewBoolVar(f"g{t}_{a}_{j}")
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
                b = m.NewBoolVar(f"i{t}_{a}")
                m.Add(x[line[a]] > x[line[a - 1]]).OnlyEnforceIf(b)
                m.Add(x[line[a]] <= x[line[a - 1]]).OnlyEnforceIf(b.Not())
                inc.append(b)
            for k in range(1, n + 1):
                b = m.NewBoolVar(f"k{t}_{k}")
                m.Add(x[clue] == k).OnlyEnforceIf(b)
                m.Add(x[clue] != k).OnlyEnforceIf(b.Not())
                for a in range(k - 1):
                    m.AddImplication(b, inc[a])
                if k < n:
                    m.AddImplication(b, inc[k - 1].Not())
        elif rule == "out":  # clue appears among the shipped window cells
            lits = []
            for i2 in line:
                b = m.NewBoolVar(f"w{t}_{i2}")
                m.Add(x[i2] == x[clue]).OnlyEnforceIf(b)
                lits.append(b)
            m.AddBoolOr(lits)

s = cp_model.CpSolver()
s.parameters.max_time_in_seconds = 120
s.parameters.num_workers = 8
print("status:", s.StatusName(s.Solve(m)))
