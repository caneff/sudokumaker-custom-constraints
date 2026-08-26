"""ISOFILL uniqueness checker (OR-Tools CP-SAT).

    uv run --with ortools examples/isofill/verify.py            # self-check
    uv run --with ortools examples/isofill/verify.py puzzle.json

puzzle.json: {"grid": [10 strings of digits], "clues": [[r, c], ...]}. The
clues name the given cells; their digits come from the grid.

Rule (decision #49): ten regions of ten orthogonally connected cells, one
digit per region, all ten digits present. Modelled as exact counts plus a
single-commodity flow per digit: one root cell sends nine units, every other
cell of that digit absorbs one, and flow moves only between orthogonal
neighbours that both hold the digit. A cut-off cell starves, so a split
region is infeasible.
"""

import json
import sys
from pathlib import Path

from ortools.sat.python import cp_model

N = 10
CELLS = [(r, c) for r in range(N) for c in range(N)]
EDGES = [
    ((r, c), (r + dr, c + dc))
    for (r, c) in CELLS
    for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))
    if 0 <= r + dr < N and 0 <= c + dc < N
]


def unique(givens, limit=60):
    """True if exactly one ISOFILL grid matches the givens, False if more.

    Raises ValueError when none does and TimeoutError when a solve hits `limit`
    seconds — a timeout is never reported as unique.
    """
    m = cp_model.CpModel()
    x = {p: m.NewIntVar(0, N - 1, f"x{p}") for p in CELLS}
    for p, v in givens.items():
        m.Add(x[p] == v)
    for d in range(N):
        holds = {p: m.NewBoolVar(f"h{d}{p}") for p in CELLS}
        for p in CELLS:
            m.Add(x[p] == d).OnlyEnforceIf(holds[p])
            m.Add(x[p] != d).OnlyEnforceIf(holds[p].Not())
        m.Add(sum(holds.values()) == N)
        root = {p: m.NewBoolVar(f"r{d}{p}") for p in CELLS}
        m.AddExactlyOne(root.values())
        flow = {e: m.NewIntVar(0, N - 1, f"f{d}{e}") for e in EDGES}
        for (p, q), f in flow.items():
            m.Add(f <= (N - 1) * holds[p])
            m.Add(f <= (N - 1) * holds[q])
        for p in CELLS:
            m.AddImplication(root[p], holds[p])
            inflow = sum(f for (_, q), f in flow.items() if q == p)
            outflow = sum(f for (q, _), f in flow.items() if q == p)
            m.Add(inflow - outflow == holds[p] - N * root[p])

    def solve():
        s = cp_model.CpSolver()
        s.parameters.max_time_in_seconds = limit
        s.parameters.num_workers = 8
        status = s.Solve(m)
        if status == cp_model.UNKNOWN:
            raise TimeoutError(f"CP-SAT hit the {limit}s limit; no verdict")
        return s if status in (cp_model.OPTIMAL, cp_model.FEASIBLE) else None

    s1 = solve()
    if s1 is None:
        raise ValueError("no ISOFILL grid matches the givens")
    diff = []
    for p in CELLS:
        b = m.NewBoolVar(f"d{p}")
        m.Add(x[p] != s1.Value(x[p])).OnlyEnforceIf(b)
        m.Add(x[p] == s1.Value(x[p])).OnlyEnforceIf(b.Not())
        diff.append(b)
    m.AddBoolOr(diff)
    return solve() is None


def self_check():
    rows = ["".join(str(r) for _ in range(N)) for r in range(N)]
    given = lambda *rs: {(r, c): int(rows[r][c]) for r in rs for c in range(N)}
    # Rows 1-9 given: the ten free cells must all be the missing digit 0.
    assert unique(given(*range(1, N))) is True
    # Rows 2-9 given: digits 0 and 1 can split the top strip many ways.
    assert unique(given(*range(2, N))) is False
    # Digit 0 pinned at both ends of row 0 with 1s between, rows 2-9 full:
    # counts allow it, but 0 cannot connect through only eight spare cells.
    split = given(*range(2, N))
    split.update({(0, c): (0 if c in (0, N - 1) else 1) for c in range(N)})
    try:
        unique(split)
    except ValueError:
        pass
    else:
        raise AssertionError("disconnected region accepted")
    # A blank grid under a 1ms cap must raise, never report a verdict.
    try:
        unique({}, limit=0.001)
    except TimeoutError:
        pass
    else:
        raise AssertionError("timeout reported a verdict")
    print("self-check ok")


if __name__ == "__main__":
    if len(sys.argv) == 1:
        self_check()
    else:
        doc = json.loads(Path(sys.argv[1]).read_text())
        givens = {(r, c): int(doc["grid"][r][c]) for r, c in doc["clues"]}
        ok = unique(givens)
        print("unique" if ok else "not unique")
        sys.exit(0 if ok else 1)
