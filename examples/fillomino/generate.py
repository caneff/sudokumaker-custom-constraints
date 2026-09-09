"""Fillomino generator (OR-Tools CP-SAT). Grown from the research prototype
docs/research/fillomino-cpsat.md records (#280/#288) -- same model, same rule,
the {"grid": [...], "clues": [...]} shape ISOFILL's verify.py prints, so
app-strip and the link builders drive it unchanged for a real (cap <= 9)
puzzle. This generates; app-strip.mjs strips, in the app.

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
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "_shared"))
import cpsat
from ortools.sat.python import cp_model

# Seconds per solve when no caller names a cap. Every solve here is one solve
# of one board, and a board that has not answered in ten minutes is a board
# the run drops and reports rather than one it waits on.
LIMIT = 600


@dataclass(frozen=True)
class Board:
    """A fillomino board's shape: `side` x `side`, digits 1..`cap`.

    `cap` and `side` are independent -- a 9x9 board carries a digit above 9
    when `cap` says so. `cells` is every cell in reading order, `edges` every
    ordered orthogonal step between two of them, and `uedges` each of those
    pairs once. All three fall out of `side`, so a board is built with
    `Board.of` rather than by naming them.
    """

    side: int
    cap: int
    cells: list
    edges: list
    uedges: list

    @classmethod
    def of(cls, side, cap=None):
        cells = [(r, c) for r in range(side) for c in range(side)]
        edges = [
            ((r, c), (r + dr, c + dc))
            for (r, c) in cells
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))
            if 0 <= r + dr < side and 0 <= c + dc < side
        ]
        uedges = [(p, q) for p, q in edges if p < q]
        return cls(side, side if cap is None else cap, cells, edges, uedges)

    @classmethod
    def of_doc(cls, doc):
        """The board a gen.json describes."""
        return cls.of(len(doc["grid"]), doc.get("cap"))

    def givens(self, doc):
        """The clue cells of a gen.json, as {(row, column): digit}."""
        return {(r, c): int(doc["grid"][r][c]) for r, c in doc["clues"]}

    def idx(self, p):
        """The cell's index, 0..side*side-1, in reading order."""
        return p[0] * self.side + p[1]


def model(board, givens):
    """The fillomino model with `givens` pinned; returns (model, cell vars)."""
    side, cap, cells = board.side, board.cap, board.cells
    m = cp_model.CpModel()
    x = {p: m.NewIntVar(1, cap, f"x{p}") for p in cells}
    for p, v in givens.items():
        m.Add(x[p] == v)

    # A region id per cell, forced to be the region's lowest cell index.
    rid = {p: m.NewIntVar(0, side * side - 1, f"g{p}") for p in cells}
    root = {p: m.NewBoolVar(f"r{p}") for p in cells}
    for p in cells:
        m.Add(rid[p] <= board.idx(p))
        m.Add(rid[p] == board.idx(p)).OnlyEnforceIf(root[p])
        m.Add(rid[p] < board.idx(p)).OnlyEnforceIf(root[p].Not())

    # Equal digits across an edge means one region: this is the separation rule.
    eq = {}
    for p, q in board.uedges:
        b = m.NewBoolVar(f"e{p}{q}")
        m.Add(x[p] == x[q]).OnlyEnforceIf(b)
        m.Add(x[p] != x[q]).OnlyEnforceIf(b.Not())
        m.Add(rid[p] == rid[q]).OnlyEnforceIf(b)
        eq[p, q] = eq[q, p] = b

    # Single-commodity flow: the root emits its digit, every cell absorbs one,
    # and flow crosses an edge only when both cells hold the same digit.
    flow = {e: m.NewIntVar(0, cap - 1, f"f{e}") for e in board.edges}
    for e, f in flow.items():
        m.Add(f <= (cap - 1) * eq[e])
    for p in cells:
        emit = m.NewIntVar(0, cap, f"s{p}")
        m.Add(emit == x[p]).OnlyEnforceIf(root[p])
        m.Add(emit == 0).OnlyEnforceIf(root[p].Not())
        inflow = sum(f for (_, q), f in flow.items() if q == p)
        outflow = sum(f for (q, _), f in flow.items() if q == p)
        m.Add(inflow - outflow == 1 - emit)
    return m, x


def rows(board, s, x):
    """Each row as a list of ints -- unambiguous once a digit can reach two
    digits wide (cap > 9), unlike a joined char string."""
    return [[s.Value(x[r, c]) for c in range(board.side)] for r in range(board.side)]


def is_striped(grid):
    """A dull board: CP-SAT's default search, seeded but not diversified,
    keeps returning a grid whose majority of rows use only two digit values
    (an alternating checkerboard band) -- docs/research/fillomino-cpsat.md.
    A row using at most two digits is "dull"; more than half such rows
    across the board means the whole grid is dull."""
    dull_rows = sum(1 for row in grid if len(set(row)) <= 2)
    return dull_rows > len(grid) // 2


def drop(board, why, seed, givens, sub=None):
    """Log a dropped grid with the seed and the clue set that produced it, so
    any generator run reproduces (#303, story 14). Goes to stderr: `sample`
    prints its JSON on stdout."""
    clues = {f"{r},{c}": d for (r, c), d in sorted(givens.items())}
    print(
        f"drop ({why}): seed={seed}"
        + (f" sub={sub}" if sub is not None else "")
        + f" side={board.side} cap={board.cap}"
        + f" clues={json.dumps(clues, sort_keys=True)}",
        file=sys.stderr,
    )


def sample(board, seed, pins=4, max_tries=50):
    """A random fillomino grid, retried away from striped rows.

    A handful of cells are pinned to random digits before each solve for
    diversity (`randomize_search` alone still hands back dull striped grids
    on some seeds -- docs/research/fillomino-cpsat.md). A pin combination
    that has no solution, or that solves to a striped grid, is dropped and
    retried with a fresh sub-seed. When `cap` exceeds `side`, one pin is
    forced above `side` so a wide cap actually gets used.
    """
    rng = random.Random(seed)
    for _ in range(max_tries):
        chosen = rng.sample(board.cells, min(pins, len(board.cells)))
        givens = {}
        if board.cap > board.side and chosen:
            high, *chosen = chosen
            givens[high] = rng.randint(board.side + 1, board.cap)
        givens.update({p: rng.randint(1, board.cap) for p in chosen})
        m, x = model(board, givens)
        sub = rng.randint(0, 2**31 - 1)
        # A draw, not a proof: the portfolio and the sub-seed are what make
        # two seeds land on two different grids. What it draws is written to
        # a gen JSON and proved from there.
        s = cpsat.solver(LIMIT, reproducible=False, seed=sub, randomize=True)
        status = s.Solve(m)
        if status not in cpsat.SOLVED:
            why = f"timeout at {LIMIT}s" if status == cpsat.UNKNOWN else "no solution"
            drop(board, why, seed, givens, sub=sub)
            continue
        grid = rows(board, s, x)
        if not is_striped(grid):
            return grid
        drop(board, "striped", seed, givens, sub=sub)
    raise RuntimeError(f"seed {seed}: no non-striped grid in {max_tries} tries")


def solutions(board, givens, most=2, limit=LIMIT, reproducible=True):
    """Up to `most` distinct grids matching `givens`, as lists of row lists.

    Each round solves, records the grid, and forbids it, so the grids differ in
    the digits themselves and not in the model's internal region bookkeeping.
    Raises TimeoutError when a solve hits `limit` seconds.
    """
    m, x = model(board, givens)
    found = []
    while len(found) < most:
        s = cpsat.solver(limit, reproducible=reproducible)
        status = s.Solve(m)
        if status == cpsat.UNKNOWN:
            raise TimeoutError(f"CP-SAT hit the {limit}s limit; no verdict")
        if status not in cpsat.SOLVED:
            break
        found.append(rows(board, s, x))
        cpsat.forbid(m, x, {p: s.Value(x[p]) for p in board.cells}, tag=len(found))
    return found


def unique(board, givens, limit=LIMIT, reproducible=True):
    """True if exactly one fillomino grid matches the givens, False if more.

    Raises ValueError when none does and TimeoutError when a solve hits `limit`
    seconds -- a timeout is never reported as unique.

    Reproducible by default: one worker and seed 0, so a committed proof gives
    the same answer on every run.
    """
    found = solutions(board, givens, most=2, limit=limit, reproducible=reproducible)
    if not found:
        raise ValueError("no fillomino grid matches the givens")
    return len(found) == 1


def brute(board, givens):
    """Every valid grid for a small `board`, by exhaustive search.

    The independent reading of the rule that the CP-SAT model is checked
    against: it flood-fills the finished grid and compares each region's cell
    count with its digit. Only usable for side <= 3.
    """
    cells = board.cells

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
                out.append(_rows_from_dict(board, g))
            return
        p = cells[i]
        for v in [givens[p]] if p in givens else range(1, board.cap + 1):
            g[p] = v
            walk(i + 1, g)
        del g[p]

    walk(0, {})
    return out


def _rows_from_dict(board, g):
    return [[g[r, c] for c in range(board.side)] for r in range(board.side)]


def self_check():
    """Assert the model against brute force on 2x2 and 3x3, then on a 9x9."""
    for n in (2, 3):
        board = Board.of(n)
        want = sorted(brute(board, {}))
        got = sorted(solutions(board, {}, most=len(want) + 5))
        assert got == want, f"{n}x{n}: model {len(got)} grids, brute {len(want)}"
        print(f"{n}x{n}: {len(want)} grids, model agrees with brute force")

    # A 3x3 clue set the model must call unique, checked against brute force.
    board = Board.of(3)
    for clues in ({(0, 0): 1}, {(1, 1): 3}, {(0, 0): 3, (2, 2): 3}):
        assert unique(board, clues) == (len(brute(board, clues)) == 1)
    print("3x3: unique() agrees with brute force on three clue sets")

    board = Board.of(9)
    grid = sample(board, seed=1)
    assert unique(board, {p: grid[p[0]][p[1]] for p in board.cells}) is True
    try:
        unique(board, {}, limit=0.001)
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
        seed, *shape = (int(a) for a in sys.argv[2:])
        board = Board.of(*shape) if shape else Board.of(9)
        grid = sample(board, seed)
        print(json.dumps({"grid": grid, "clues": board.cells}))
    elif sys.argv[1] == "unique":
        doc = json.loads(Path(sys.argv[2]).read_text())
        board = Board.of_doc(doc)
        givens = board.givens(doc)
        limit = float(sys.argv[3]) if len(sys.argv) > 3 else LIMIT
        try:
            ok = unique(board, givens, limit=limit)
        except TimeoutError:
            # A timeout is no verdict, and the grid is dropped -- but never
            # silently: the log names the clue set that has to be re-run.
            drop(board, f"timeout at {limit}s", doc.get("seed", "unrecorded"), givens)
            sys.exit(2)
        print("unique" if ok else "not unique")
        sys.exit(0 if ok else 1)
    else:
        sys.exit(
            f"usage: {sys.argv[0]} [sample <seed> [side] [cap] | unique <gen.json> [limit]]"
        )
