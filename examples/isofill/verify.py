"""ISOFILL uniqueness checker (OR-Tools CP-SAT).

    uv run --with ortools examples/isofill/verify.py            # self-check
    uv run --with ortools examples/isofill/verify.py gen.json

gen.json: {"grid": [N strings of digits], "clues": [[r, c], ...],
"minDigit": 0}. The clues name the given cells; their digits come from the
grid. The board is N x N with N digits from minDigit (default 0): 10x10 with
0-9, or 9x9 with 1-9.

Rule (decision #49): N regions of N orthogonally connected cells, one
digit per region, all N digits present. Modelled as exact counts plus a
single-commodity flow per digit: one root cell sends nine units, every other
cell of that digit absorbs one, and flow moves only between orthogonal
neighbours that both hold the digit. A cut-off cell starves, so a split
region is infeasible.

Every function here takes the `Board` it works on. Nothing is read off module
state, so two boards can be checked in one process -- which is what
verify.test.py and `just verify-isofill` do.
"""

import json
import sys
from dataclasses import dataclass
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "_shared"))
import cpsat
from ortools.sat.python import cp_model

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
        """The board a gen.json describes."""
        return cls.of(len(doc["grid"]), doc.get("minDigit", 0))

    def givens(self, doc):
        """The clue cells of a gen.json, as {(row, column): digit}."""
        return {(r, c): int(doc["grid"][r][c]) for r, c in doc["clues"]}


def model(board, givens):
    """The ISOFILL model with `givens` pinned; returns (model, cell vars)."""
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
        root = {p: m.NewBoolVar(f"r{d}{p}") for p in board.cells}
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
    """The solved board as `n` row strings."""
    return [
        "".join(str(s.Value(x[r, c])) for c in range(board.n)) for r in range(board.n)
    ]


def sample(board, seed):
    """A random ISOFILL grid (no givens) as `n` row strings."""
    m, x = model(board, {})
    # A seed alone barely moves the default search (it hands back striped
    # grids); randomize_search makes the seed pick a genuinely different grid.
    # Not a proof, so it runs the portfolio: what it draws is written to a gen
    # JSON and proved from there.
    s = cpsat.solver(LIMIT, reproducible=False, seed=seed, randomize=True)
    status = s.Solve(m)
    if status == cpsat.UNKNOWN:
        raise TimeoutError(f"seed {seed}: CP-SAT hit the {LIMIT}s limit; no grid")
    assert status in cpsat.SOLVED, (
        f"seed {seed}: no ISOFILL grid on a {board.n}x{board.n} board"
    )
    return rows(board, s, x)


def strip(board, grid, seed):
    """Greedily drop givens from a full grid in a seeded random order, keeping
    only those whose removal breaks uniqueness. Returns the clue list.

    Hundreds of solves, none of them the proof that ships: the clue set this
    lands on is written to a gen JSON and re-proved by `unique` before the
    link is shared, so these run on the portfolio."""
    import random

    givens = {(r, c): int(grid[r][c]) for r, c in board.cells}
    order = list(board.cells)
    random.Random(seed).shuffle(order)
    for p in order:
        v = givens.pop(p)
        if not unique(board, givens, reproducible=False):
            givens[p] = v
    return sorted(givens)


def unique(board, givens, limit=LIMIT, reproducible=True):
    """True if exactly one ISOFILL grid matches the givens, False if more.

    Raises ValueError when none does and TimeoutError when a solve hits `limit`
    seconds — a timeout is never reported as unique.

    Reproducible by default: one worker and seed 0, so a committed proof gives
    the same answer on every run. `reproducible=False` opens CP-SAT's
    portfolio, which is far faster and is what the generation searches want.
    """
    m, x = model(board, givens)
    s = cpsat.solver(limit, reproducible=reproducible)
    status = s.Solve(m)
    if status == cpsat.UNKNOWN:
        raise TimeoutError(f"CP-SAT hit the {limit}s limit; no verdict")
    if status not in cpsat.SOLVED:
        raise ValueError("no ISOFILL grid matches the givens")
    first = {p: s.Value(x[p]) for p in board.cells}
    return not cpsat.has_second_solution(m, x, first, limit, reproducible=reproducible)


def self_check(board):
    n = board.n
    banded = ["".join(str(r) for _ in range(n)) for r in range(n)]
    given = lambda *rs: {(r, c): int(banded[r][c]) for r in rs for c in range(n)}
    # Every row but the first given: the free row's cells must all be the
    # one missing digit.
    assert unique(board, given(*range(1, n))) is True
    # Every row but the first two given: the top strip can split between the
    # two missing digits many ways.
    assert unique(board, given(*range(2, n))) is False
    # Digit 0 pinned at both ends of row 0 with 1s between, every row but the
    # first two full: counts allow it, but 0 cannot connect through the
    # spare cells outside row 0.
    split = given(*range(2, n))
    split.update({(0, c): (0 if c in (0, n - 1) else 1) for c in range(n)})
    try:
        unique(board, split)
    except ValueError:
        pass
    else:
        raise AssertionError("disconnected region accepted")
    # A blank grid under a 1ms cap must raise, never report a verdict.
    try:
        unique(board, {}, limit=0.001)
    except TimeoutError:
        pass
    else:
        raise AssertionError("timeout reported a verdict")
    print("self-check ok")


if __name__ == "__main__":
    if len(sys.argv) == 1:
        self_check(Board.of(10))
    elif sys.argv[1] in ("sample", "strip"):
        # verify.py sample <seed> [side] [minDigit]: a full grid as gen.json
        # with every cell given, ready for app-strip.mjs --grid.
        # verify.py strip <seed> [side] [minDigit]: the same grid stripped to a
        # minimal unique clue set with CP-SAT (slower than the app strip; fine
        # for a 9x9).
        seed, *shape = (int(a) for a in sys.argv[2:])
        board = Board.of(*shape) if shape else Board.of(10)
        grid = sample(board, seed)
        clues = strip(board, grid, seed) if sys.argv[1] == "strip" else board.cells
        print(json.dumps({"grid": grid, "clues": clues, "minDigit": board.lo}))
    else:
        doc = json.loads(Path(sys.argv[1]).read_text())
        board = Board.of_doc(doc)
        # The one proof here that does NOT run reproducible. A 10x10 ISOFILL
        # model is out of reach of a single worker: gen_24g.json is 187s on
        # the portfolio and hits the 600s limit with no verdict at
        # num_workers=1, and gen.json is 12s against more than twenty minutes.
        # Nothing this prints is committed except the verdict itself, and the
        # verdict is a property of the model, not of the search -- the two
        # configurations agree wherever both terminate, and only one of them
        # terminates. See README, "verify.py".
        ok = unique(board, board.givens(doc), reproducible=False)
        print("unique" if ok else "not unique")
        sys.exit(0 if ok else 1)
