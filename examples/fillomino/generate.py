"""Fillomino generator (OR-Tools CP-SAT). Grown from the research prototype,
docs/research/fillomino_cpsat.py (#280/#288) -- same model, same rule, the
{"grid": [...], "clues": [...]} shape ISOFILL's verify.py prints, so
app-strip and the link builders drive it unchanged for a real (cap <= 9)
puzzle. The prototype's own greedy CP-SAT strip stays there, unshipped;
app-strip.mjs strips in the app.

    uv run --with ortools examples/fillomino/generate.py               # self-check
    uv run --with ortools examples/fillomino/generate.py sample 7      # a full grid
    uv run --with ortools examples/fillomino/generate.py sample 7 9 12 # side 9, cap 12
    uv run --with ortools examples/fillomino/generate.py unique gen.json
    uv run --with ortools examples/fillomino/generate.py unique gen.json 30  # 30s cap

A dropped grid -- no solution for the pinned cells, a striped grid, or a
uniqueness solve that timed out -- prints one `drop (...)` line on stderr
naming the seed and the clue set, so the run reproduces (#303, story 14).

gen.json: {"grid": [N rows of digits], "clues": [[r, c], ...], "cap": N}. Each
row is a list of ints -- a joined char string is ambiguous once a digit can
run two digits wide (cap > 9), so rows are never joined into one string. The
clues name the given cells; their digits come from the grid. `cap` defaults
to the board side (digits 1..side) when absent.

Rule. Partition a `side` x `side` board into orthogonally connected regions;
every cell of a region of k cells holds the digit k; two distinct regions of
the same size may not touch orthogonally. No houses, no row/column/box.
Digits run 1..cap, so a region never exceeds `cap` cells -- `cap` and `side`
are independent: a 9x9 board can carry a digit above 9 if `cap` says so.

The separation rule is what makes the model small: with it, a region *is* an
orthogonally connected component of equal digits, so the model needs no
region count and no region objects -- see
docs/research/fillomino-cpsat.md.
"""

import json
import random
import sys
from pathlib import Path

from ortools.sat.python import cp_model

SIDE = 9
CAP = 9
CELLS = EDGES = UEDGES = None


def set_board(side, cap=None):
    """Set the board side and digit cap (defaults to `side`); rebuild cells/edges."""
    global SIDE, CAP, CELLS, EDGES, UEDGES
    SIDE = side
    CAP = cap if cap is not None else side
    CELLS = [(r, c) for r in range(SIDE) for c in range(SIDE)]
    EDGES = [
        ((r, c), (r + dr, c + dc))
        for (r, c) in CELLS
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))
        if 0 <= r + dr < SIDE and 0 <= c + dc < SIDE
    ]
    UEDGES = [(p, q) for p, q in EDGES if p < q]


set_board(SIDE, CAP)


def idx(p):
    """The cell's index, 0..side*side-1, in reading order."""
    return p[0] * SIDE + p[1]


def model(givens):
    """The fillomino model with `givens` pinned; returns (model, cell vars)."""
    m = cp_model.CpModel()
    x = {p: m.NewIntVar(1, CAP, f"x{p}") for p in CELLS}
    for p, v in givens.items():
        m.Add(x[p] == v)

    # A region id per cell, forced to be the region's lowest cell index.
    rid = {p: m.NewIntVar(0, SIDE * SIDE - 1, f"g{p}") for p in CELLS}
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
    flow = {e: m.NewIntVar(0, CAP - 1, f"f{e}") for e in EDGES}
    for e, f in flow.items():
        m.Add(f <= (CAP - 1) * eq[e])
    for p in CELLS:
        emit = m.NewIntVar(0, CAP, f"s{p}")
        m.Add(emit == x[p]).OnlyEnforceIf(root[p])
        m.Add(emit == 0).OnlyEnforceIf(root[p].Not())
        inflow = sum(f for (_, q), f in flow.items() if q == p)
        outflow = sum(f for (q, _), f in flow.items() if q == p)
        m.Add(inflow - outflow == 1 - emit)
    return m, x


def _rows(s, x):
    """Each row as a list of ints -- unambiguous once a digit can reach two
    digits wide (cap > 9), unlike a joined char string."""
    return [[s.Value(x[r, c]) for c in range(SIDE)] for r in range(SIDE)]


def is_striped(grid):
    """A dull board: CP-SAT's default search, seeded but not diversified,
    keeps returning a grid whose majority of rows use only two digit values
    (an alternating checkerboard band) -- docs/research/fillomino-cpsat.md.
    A row using at most two digits is "dull"; more than half such rows
    across the board means the whole grid is dull."""
    dull_rows = sum(1 for row in grid if len(set(row)) <= 2)
    return dull_rows > len(grid) // 2


def drop(why, seed, givens, sub=None):
    """Log a dropped grid with the seed and the clue set that produced it, so
    any generator run reproduces (#303, story 14). Goes to stderr: `sample`
    prints its JSON on stdout."""
    clues = {f"{r},{c}": d for (r, c), d in sorted(givens.items())}
    print(
        f"drop ({why}): seed={seed}"
        + (f" sub={sub}" if sub is not None else "")
        + f" side={SIDE} cap={CAP} clues={json.dumps(clues, sort_keys=True)}",
        file=sys.stderr,
    )


def sample(seed, side=None, cap=None, pins=4, max_tries=50):
    """A random fillomino grid, retried away from striped rows.

    A handful of cells are pinned to random digits before each solve for
    diversity (`randomize_search` alone still hands back dull striped grids
    on some seeds -- docs/research/fillomino-cpsat.md). A pin combination
    that has no solution, or that solves to a striped grid, is dropped and
    retried with a fresh sub-seed. When `cap` exceeds `side`, one pin is
    forced above `side` so a wide cap actually gets used.
    """
    set_board(side if side is not None else SIDE, cap if cap is not None else CAP)
    rng = random.Random(seed)
    for _ in range(max_tries):
        chosen = rng.sample(CELLS, min(pins, len(CELLS)))
        givens = {}
        if CAP > SIDE and chosen:
            high, *chosen = chosen
            givens[high] = rng.randint(SIDE + 1, CAP)
        givens.update({p: rng.randint(1, CAP) for p in chosen})
        m, x = model(givens)
        s = cp_model.CpSolver()
        sub = rng.randint(0, 2**31 - 1)
        s.parameters.random_seed = sub
        s.parameters.randomize_search = True
        s.parameters.num_workers = 8
        status = s.Solve(m)
        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            drop("no solution", seed, givens, sub=sub)
            continue
        grid = _rows(s, x)
        if not is_striped(grid):
            return grid
        drop("striped", seed, givens, sub=sub)
    raise RuntimeError(f"seed {seed}: no non-striped grid in {max_tries} tries")


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


def brute(givens):
    """Every valid grid for the current (small) board, by exhaustive search.

    The independent reading of the rule that the CP-SAT model is checked
    against: it flood-fills the finished grid and compares each region's cell
    count with its digit. Only usable for side <= 3.
    """
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

    out = []

    def walk(i, g):
        if i == len(cells):
            if ok(g):
                out.append(_rows_from_dict(g))
            return
        p = cells[i]
        for v in [givens[p]] if p in givens else range(1, CAP + 1):
            g[p] = v
            walk(i + 1, g)
        del g[p]

    walk(0, {})
    return out


def _rows_from_dict(g):
    return [[g[r, c] for c in range(SIDE)] for r in range(SIDE)]


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
    grid = sample(seed=1)
    assert unique({(r, c): grid[r][c] for r, c in CELLS}) is True
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
    elif sys.argv[1] == "sample":
        args = [int(a) for a in sys.argv[2:]]
        seed = args[0]
        side = args[1] if len(args) > 1 else None
        cap = args[2] if len(args) > 2 else None
        grid = sample(seed, side=side, cap=cap)
        print(json.dumps({"grid": grid, "clues": CELLS}))
    elif sys.argv[1] == "unique":
        doc = json.loads(Path(sys.argv[2]).read_text())
        set_board(len(doc["grid"]), doc.get("cap"))
        givens = {(r, c): int(doc["grid"][r][c]) for r, c in doc["clues"]}
        limit = float(sys.argv[3]) if len(sys.argv) > 3 else 600
        try:
            ok = unique(givens, limit=limit)
        except TimeoutError:
            # A timeout is no verdict, and the grid is dropped -- but never
            # silently: the log names the clue set that has to be re-run.
            drop(f"timeout at {limit}s", doc.get("seed", "unrecorded"), givens)
            sys.exit(2)
        print("unique" if ok else "not unique")
        sys.exit(0 if ok else 1)
    else:
        sys.exit(
            f"usage: {sys.argv[0]} [sample <seed> [side] [cap] | unique <gen.json> [limit]]"
        )
