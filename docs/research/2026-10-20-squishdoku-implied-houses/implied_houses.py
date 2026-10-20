"""Which cell pairs does squishdoku force to differ, and which 9-cell houses cover them?

Squishdoku: 7x7, digits 1-9, nine overlapping 3x3 boxes (rows and columns
{0-2, 2-4, 4-6}) each hold 1-9 once, rows and columns hold no repeats.

For every pair of cells not already in a shared row, column or box, CP-SAT
asks whether the two cells can be equal and whether they can differ. Then
every maximal 9-clique of the "must differ" graph is a forced house.

  uv run --with networkx python docs/research/2026-10-20-squishdoku-implied-houses/implied_houses.py houses.json
"""

import itertools
import json
import sys
from pathlib import Path

from ortools.sat.python import cp_model

N = 7
STARTS = (0, 2, 4)
BOXES = [
    [(r + dr) * N + c + dc for dr in range(3) for dc in range(3)]
    for r in STARTS
    for c in STARTS
]
ROWS = [[r * N + c for c in range(N)] for r in range(N)]
COLS = [[r * N + c for r in range(N)] for c in range(N)]
GROUPS = BOXES + ROWS + COLS


def feasible(extra):
    m = cp_model.CpModel()
    x = [m.NewIntVar(1, 9, f"x{i}") for i in range(N * N)]
    for g in GROUPS:
        m.AddAllDifferent([x[i] for i in g])
    extra(m, x)
    s = cp_model.CpSolver()
    s.parameters.num_workers = 1
    return s.Solve(m) in (cp_model.OPTIMAL, cp_model.FEASIBLE)


def main(out):
    import networkx as nx  # only the clique step needs it; make_boards.py imports this module

    never_equal, never_diff = [], []
    for i, j in itertools.combinations(range(N * N), 2):
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
    boxes = [sorted(b) for b in BOXES]
    houses = [
        sorted(c) for c in nx.find_cliques(g) if len(c) == 9 and sorted(c) not in boxes
    ]
    covered = {frozenset(p) for h in houses for p in itertools.combinations(h, 2)}
    uncovered = [p for p in never_equal if frozenset(p) not in covered]

    print("implied inequalities:", len(never_equal))
    print("implied equalities:", len(never_diff))
    print("9-cell houses beyond the boxes:", len(houses))
    print("implied inequalities no house covers:", len(uncovered))
    result = {"never_equal": never_equal, "never_diff": never_diff, "houses": houses}
    Path(out).write_text(json.dumps(result))


if __name__ == "__main__":
    main(sys.argv[1])
