"""Embedded squishdoku: a 9x9 Latin square with squishdoku boxes on r2c2-r8c8.

Same method as implied_houses.py: CP-SAT asks, for every pair of cells not
already sharing a row, column or box, whether they can be equal and whether
they can differ; every maximal 9-clique of the "must differ" graph other than
the boxes, rows and columns is a forced house.

  uv run --with networkx python embedded_houses.py embedded-houses.json
"""

import itertools
import json
import sys
from pathlib import Path

from ortools.sat.python import cp_model

W = 9
STARTS = (1, 3, 5)
BOXES = [
    [(r + dr) * W + c + dc for dr in range(3) for dc in range(3)]
    for r in STARTS
    for c in STARTS
]
ROWS = [[r * W + c for c in range(W)] for r in range(W)]
COLS = [[r * W + c for r in range(W)] for c in range(W)]
GROUPS = BOXES + ROWS + COLS


def feasible(extra):
    m = cp_model.CpModel()
    x = [m.NewIntVar(1, 9, f"x{i}") for i in range(W * W)]
    for g in GROUPS:
        m.AddAllDifferent([x[i] for i in g])
    extra(m, x)
    s = cp_model.CpSolver()
    s.parameters.num_workers = 1
    return s.Solve(m) in (cp_model.OPTIMAL, cp_model.FEASIBLE)


def main(out):
    import networkx as nx

    never_equal, never_diff = [], []
    for i, j in itertools.combinations(range(W * W), 2):
        if any(i in g and j in g for g in GROUPS):
            continue
        if not feasible(lambda m, x, i=i, j=j: m.Add(x[i] == x[j])):
            never_equal.append((i, j))
        elif not feasible(lambda m, x, i=i, j=j: m.Add(x[i] != x[j])):
            never_diff.append((i, j))

    g = nx.Graph()
    for grp in GROUPS:
        g.add_edges_from(itertools.combinations(grp, 2))
    g.add_edges_from(never_equal)
    known = [sorted(grp) for grp in GROUPS]
    houses = [
        sorted(c) for c in nx.find_cliques(g) if len(c) == 9 and sorted(c) not in known
    ]
    covered = {frozenset(p) for h in houses for p in itertools.combinations(h, 2)}
    print("implied inequalities:", len(never_equal))
    print("implied equalities:", len(never_diff))
    print("9-cell houses beyond boxes, rows and columns:", len(houses))
    print(
        "implied inequalities no house covers:",
        sum(frozenset(p) not in covered for p in never_equal),
    )
    result = {"never_equal": never_equal, "never_diff": never_diff, "houses": houses}
    Path(out).write_text(json.dumps(result))


if __name__ == "__main__":
    main(sys.argv[1])
