"""The ISOFILL CP-SAT model and grid sampler, shared by every board that holds
an ISOFILL interior: the bare board (examples/isofill/verify.py) and the ring
board (examples/isofill-skyscraper/build_size.py), so both prove on one model.

Rule: N regions of N orthogonally connected cells, one digit per region, all N
digits present. Modelled as exact counts plus a single-commodity flow per
digit: the digit's first cell in reading order sends N - 1 units, every other
cell of that digit absorbs one, and flow moves only between orthogonal neighbours that both hold the
digit. A cut-off cell starves, so a split region is infeasible.
"""

from dataclasses import dataclass

from ortools.sat.python import cp_model
from sudoku_kit import cpsat

# Seconds per solve when no caller names a cap. A 10x10 proof runs in minutes;
# past ten, the run reports no verdict rather than waiting on one.
LIMIT = 600


@dataclass(frozen=True)
class Board:
    """An ISOFILL board's shape: `n` x `n`, digits `lo` .. `lo + n - 1`.

    `cells` is every cell in reading order, `edges` every ordered orthogonal
    step between two of them. Both fall out of `n`, so a board is built with
    `Board.of` rather than by naming them.
    """

    n: int
    lo: int
    cells: list
    edges: list

    @classmethod
    def of(cls, n, lo=0):
        cells = [(r, c) for r in range(n) for c in range(n)]
        edges = [
            ((r, c), (r + dr, c + dc))
            for (r, c) in cells
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))
            if 0 <= r + dr < n and 0 <= c + dc < n
        ]
        return cls(n, lo, cells, edges)

    @classmethod
    def of_doc(cls, doc):
        return cls.of(len(doc["grid"]), doc.get("minDigit", 0))

    def givens(self, doc):
        return {(r, c): int(doc["grid"][r][c]) for r, c in doc["clues"]}


def model(board, givens):
    n, lo = board.n, board.lo
    m = cp_model.CpModel()
    x = {p: m.NewIntVar(lo, lo + n - 1, f"x{p}") for p in board.cells}
    for p, v in givens.items():
        m.Add(x[p] == v)
    for d in range(lo, lo + n):
        holds = {p: m.NewBoolVar(f"h{d}{p}") for p in board.cells}
        for p in board.cells:
            m.Add(x[p] == d).OnlyEnforceIf(holds[p])
            m.Add(x[p] != d).OnlyEnforceIf(holds[p].Not())
        m.Add(sum(holds.values()) == n)
        # The root is the digit's first cell in reading order, so a grid has
        # one root per digit, not one per cell of the region: with the root
        # free, the exclusion solve of a uniqueness proof refutes each region
        # once for every cell it could grow from (one 9x9 ring board: 17.8 s
        # free, 2.0 s pinned).
        root = {}
        earlier = None  # some cell before p holds d
        for p in board.cells:
            root[p] = m.NewBoolVar(f"r{d}{p}")
            if earlier is None:
                m.Add(root[p] == holds[p])
                earlier = holds[p]
                continue
            m.AddBoolAnd([holds[p], earlier.Not()]).OnlyEnforceIf(root[p])
            m.AddBoolOr([holds[p].Not(), earlier]).OnlyEnforceIf(root[p].Not())
            seen = m.NewBoolVar(f"s{d}{p}")
            m.AddMaxEquality(seen, [earlier, holds[p]])
            earlier = seen
        m.AddExactlyOne(root.values())
        flow = {e: m.NewIntVar(0, n - 1, f"f{d}{e}") for e in board.edges}
        for (p, q), f in flow.items():
            m.Add(f <= (n - 1) * holds[p])
            m.Add(f <= (n - 1) * holds[q])
        for p in board.cells:
            m.AddImplication(root[p], holds[p])
            inflow = sum(f for (_, q), f in flow.items() if q == p)
            outflow = sum(f for (q, _), f in flow.items() if q == p)
            m.Add(inflow - outflow == holds[p] - n * root[p])
    return m, x


def rows(board, s, x):
    return [
        "".join(str(s.Value(x[r, c])) for c in range(board.n)) for r in range(board.n)
    ]


def sample(board, seed, limit=LIMIT):
    m, x = model(board, {})
    # A seed alone barely moves the default search (it hands back striped
    # grids); randomize_search makes the seed pick a genuinely different grid.
    # Not a proof, so it runs the portfolio: what it draws is written to a gen
    # JSON and proved from there.
    s = cpsat.solver(limit, reproducible=False, seed=seed, randomize=True)
    status = s.Solve(m)
    if status == cpsat.UNKNOWN:
        raise TimeoutError(f"seed {seed}: CP-SAT hit the {limit}s limit; no grid")
    assert status in cpsat.SOLVED, (
        f"seed {seed}: no ISOFILL grid on a {board.n}x{board.n} board"
    )
    return rows(board, s, x)
