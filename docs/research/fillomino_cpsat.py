"""Fillomino uniqueness prototype (OR-Tools CP-SAT). Research, not shipped.

    uv run --with ortools docs/research/fillomino_cpsat.py            # self-check
    uv run --with ortools docs/research/fillomino_cpsat.py sample 7   # a full grid
    uv run --with ortools docs/research/fillomino_cpsat.py strip 7    # + a clue set
    uv run --with ortools docs/research/fillomino_cpsat.py gen.json   # prove unique

gen.json: {"grid": [N strings of digits], "clues": [[r, c], ...]}. The clues
name the given cells; their digits come from the grid.

Rule. Partition an N x N board into orthogonally connected regions; every cell
of a region of k cells holds the digit k; two distinct regions of the same size
may not touch orthogonally. No houses, no row/column/box. Digits run 1..N, so a
region never exceeds N cells.

The separation rule is what makes the model small: with it, a region *is* an
orthogonally connected component of equal digits. So the model needs no region
count and no region objects. It says one thing about every such component --
its cell count equals the digit its cells hold -- and the whole rule follows.

Modelled as (see docs/research/fillomino-cpsat.md):
  x[p]    the digit in cell p, 1..N.
  rid[p]  the region id of p: the cell index of the region's root.
  root[p] p is its region's root, i.e. rid[p] == idx(p).
  flow    one unit of demand per cell, met by the root, moving only across
          edges whose two cells hold the same digit.

`rid[p] <= idx(p)` pins the root to the lowest-indexed cell of the region, so
each region has exactly one root and there is no root-choice symmetry. Flow
conservation over a component then reads: cells in the component = the root's
digit. A cut-off cell starves, so a split region is infeasible.
"""

import json
import random
import sys
from pathlib import Path

from ortools.sat.python import cp_model

N = 9  # board side and digit count; set_board() changes it
CELLS = EDGES = UEDGES = None


def set_board(n):
    """Set the board side and rebuild the cell and edge lists."""
    global N, CELLS, EDGES, UEDGES
    N = n
    CELLS = [(r, c) for r in range(N) for c in range(N)]
    EDGES = [
        ((r, c), (r + dr, c + dc))
        for (r, c) in CELLS
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))
        if 0 <= r + dr < N and 0 <= c + dc < N
    ]
    UEDGES = [(p, q) for p, q in EDGES if p < q]


set_board(N)


def idx(p):
    """The cell's index, 0..N*N-1, in reading order."""
    return p[0] * N + p[1]


def model(givens):
    """The fillomino model with `givens` pinned; returns (model, cell vars)."""
    m = cp_model.CpModel()
    x = {p: m.NewIntVar(1, N, f"x{p}") for p in CELLS}
    for p, v in givens.items():
        m.Add(x[p] == v)

    # A region id per cell, forced to be the region's lowest cell index.
    rid = {p: m.NewIntVar(0, N * N - 1, f"g{p}") for p in CELLS}
    root = {p: m.NewBoolVar(f"r{p}") for p in CELLS}
    for p in CELLS:
        m.Add(rid[p] <= idx(p))
        m.Add(rid[p] == idx(p)).OnlyEnforceIf(root[p])
        m.Add(rid[p] < idx(p)).OnlyEnforceIf(root[p].Not())

    # Equal digits across an edge means one region: this is the separation rule.
    eq = {}
    for p, q in UEDGES:
        b = m.NewBoolVar(f"e{p}{q}")
        m.Add(x[p] == x[q]).OnlyEnforceIf(b)
        m.Add(x[p] != x[q]).OnlyEnforceIf(b.Not())
        m.Add(rid[p] == rid[q]).OnlyEnforceIf(b)
        eq[p, q] = eq[q, p] = b

    # Single-commodity flow: the root emits its digit, every cell absorbs one,
    # and flow crosses an edge only when both cells hold the same digit.
    flow = {e: m.NewIntVar(0, N - 1, f"f{e}") for e in EDGES}
    for e, f in flow.items():
        m.Add(f <= (N - 1) * eq[e])
    for p in CELLS:
        emit = m.NewIntVar(0, N, f"s{p}")
        m.Add(emit == x[p]).OnlyEnforceIf(root[p])
        m.Add(emit == 0).OnlyEnforceIf(root[p].Not())
        inflow = sum(f for (_, q), f in flow.items() if q == p)
        outflow = sum(f for (q, _), f in flow.items() if q == p)
        m.Add(inflow - outflow == 1 - emit)
    return m, x


def _rows(s, x):
    return ["".join(str(s.Value(x[r, c])) for c in range(N)) for r in range(N)]


def sample(seed):
    """A random full fillomino grid (no givens) as N row strings."""
    m, x = model({})
    s = cp_model.CpSolver()
    s.parameters.random_seed = seed
    # A seed alone barely moves the default search; randomize_search makes the
    # seed pick a genuinely different grid (same finding as ISOFILL's verify.py).
    s.parameters.randomize_search = True
    s.parameters.num_workers = 8
    assert s.Solve(m) in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    return _rows(s, x)


def solutions(givens, cap=2, limit=600):
    """Up to `cap` distinct grids matching `givens`, as lists of row strings.

    Each round solves, records the grid, and forbids it, so the grids differ in
    the digits themselves and not in the model's internal region bookkeeping.
    Raises TimeoutError when a solve hits `limit` seconds.
    """
    m, x = model(givens)
    found = []
    while len(found) < cap:
        s = cp_model.CpSolver()
        s.parameters.max_time_in_seconds = limit
        s.parameters.num_workers = 8
        status = s.Solve(m)
        if status == cp_model.UNKNOWN:
            raise TimeoutError(f"CP-SAT hit the {limit}s limit; no verdict")
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            break
        found.append(_rows(s, x))
        diff = []
        for p in CELLS:
            b = m.NewBoolVar(f"d{len(found)}{p}")
            m.Add(x[p] != s.Value(x[p])).OnlyEnforceIf(b)
            m.Add(x[p] == s.Value(x[p])).OnlyEnforceIf(b.Not())
            diff.append(b)
        m.AddBoolOr(diff)
    return found


def unique(givens, limit=600):
    """True if exactly one fillomino grid matches the givens, False if more.

    Raises ValueError when none does and TimeoutError when a solve hits `limit`
    seconds -- a timeout is never reported as unique.
    """
    found = solutions(givens, cap=2, limit=limit)
    if not found:
        raise ValueError("no fillomino grid matches the givens")
    return len(found) == 1


def strip(grid, seed, limit=600):
    """Greedily drop givens from a full grid in a seeded random order, keeping
    only those whose removal breaks uniqueness. Returns the clue list."""
    givens = {(r, c): int(grid[r][c]) for r, c in CELLS}
    order = list(CELLS)
    random.Random(seed).shuffle(order)
    for p in order:
        v = givens.pop(p)
        if not unique(givens, limit=limit):
            givens[p] = v
    return sorted(givens)


def brute(givens):
    """Every valid grid for the current (small) board, by exhaustive search.

    The independent reading of the rule that the CP-SAT model is checked
    against: it flood-fills the finished grid and compares each region's cell
    count with its digit. Only usable for N <= 3.
    """
    out = []
    cells = CELLS

    def ok(g):
        seen = set()
        for p in cells:
            if p in seen:
                continue
            blob, stack = {p}, [p]
            while stack:
                r, c = stack.pop()
                for q in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                    if q in g and g[q] == g[p] and q not in blob:
                        blob.add(q)
                        stack.append(q)
            if len(blob) != g[p]:
                return False
            seen |= blob
        return True

    def walk(i, g):
        if i == len(cells):
            if ok(g):
                out.append(["".join(str(g[r, c]) for c in range(N)) for r in range(N)])
            return
        p = cells[i]
        for v in [givens[p]] if p in givens else range(1, N + 1):
            g[p] = v
            walk(i + 1, g)
        del g[p]

    walk(0, {})
    return out


def self_check():
    """Assert the model against brute force on 2x2 and 3x3, then on a 9x9."""
    for n in (2, 3):
        set_board(n)
        want = sorted(brute({}))
        got = sorted(solutions({}, cap=len(want) + 5))
        assert got == want, f"{n}x{n}: model {len(got)} grids, brute {len(want)}"
        print(f"{n}x{n}: {len(want)} grids, model agrees with brute force")

    # A 3x3 clue set the model must call unique, checked against brute force.
    set_board(3)
    for clues in ({(0, 0): 1}, {(1, 1): 3}, {(0, 0): 3, (2, 2): 3}):
        assert unique(clues) == (len(brute(clues)) == 1)
    print("3x3: unique() agrees with brute force on three clue sets")

    set_board(9)
    grid = sample(1)
    assert unique({(r, c): int(grid[r][c]) for r, c in CELLS}) is True
    try:
        unique({}, limit=0.001)
    except TimeoutError:
        pass
    else:
        raise AssertionError("timeout reported a verdict")
    print("9x9: a sampled grid is unique under all 81 givens; timeouts raise")
    print("self-check ok")


if __name__ == "__main__":
    if len(sys.argv) == 1:
        self_check()
    elif sys.argv[1] in ("sample", "strip"):
        args = [int(a) for a in sys.argv[2:]]
        seed = args[0]
        if len(args) > 1:
            set_board(args[1])
        grid = sample(seed)
        clues = strip(grid, seed) if sys.argv[1] == "strip" else CELLS
        print(json.dumps({"grid": grid, "clues": clues}))
    else:
        doc = json.loads(Path(sys.argv[1]).read_text())
        set_board(len(doc["grid"]))
        givens = {(r, c): int(doc["grid"][r][c]) for r, c in doc["clues"]}
        ok = unique(givens)
        print("unique" if ok else "not unique")
        sys.exit(0 if ok else 1)
