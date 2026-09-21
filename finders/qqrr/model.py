"""The QQRR rule as a CP-SAT model, one encoding decision per function.

`build` returns a `Model` holding the digit variables `x`, every window's
value `v` and rank `rank`, every cell's number `num`, and a cell rank `q` for
each cell in `ranked_cells` only. The rule is the oracle's (`oracle.py`); the
encoding follows the speed list on map #591:

- a rank is `1 + count(strictly less)`, one reified strict-less literal per
  ordered pair, so ties come free of any equality literal;
- a cell number is the unpadded concatenation of its windows' ranks, written
  as one linear equality per combination of the later ranks' widths under
  enforcement literals, never as a multiplication;
- a cell rank counts only the cells whose number can fall below this one's
  upper bound, which drops every interior cell from a corner's count;
- the leading-digit bound (map #321, #324) is posted on every window as two
  linear inequalities. It is sound only on a full latin square with digits
  1..n, which every sudoku grid is; `build(latin=False)` leaves it out.
"""

from dataclasses import dataclass

from ortools.sat.python import cp_model


@dataclass
class Model:
    n: int
    m: cp_model.CpModel
    x: list  # x[r][c]: the digit in cell (r, c)
    v: list  # v[wr][wc]: the window value, top-left cell (wr, wc)
    rank: list  # rank[wr][wc]: the window's quad rank
    num: list  # num[r][c]: the cell number
    q: dict  # (r, c) -> the cell's quad quad rank rank, for ranked cells only


def windows_of(n, r, c):
    return [
        (wr, wc)
        for wr in (r - 1, r)
        for wc in (c - 1, c)
        if 0 <= wr <= n - 2 and 0 <= wc <= n - 2
    ]


def add_rank(m, values, mine, name, lo=1, hi=None):
    """`1 + count(u < mine for u in values)` as a new int var.

    `values` excludes `mine`. The two literals per pair make the count exact:
    `b` forces `u < mine`, `not b` forces `u >= mine`.
    """
    lits = []
    for i, u in enumerate(values):
        b = m.NewBoolVar(f"{name}_lt{i}")
        m.Add(u <= mine - 1).OnlyEnforceIf(b)
        m.Add(u >= mine).OnlyEnforceIf(b.Not())
        lits.append(b)
    hi = len(values) + 1 if hi is None else hi
    r = m.NewIntVar(lo, hi, name)
    m.Add(r == 1 + sum(lits))
    return r


def add_cell_number(m, ranks, top, name):
    """The unpadded concatenation of `ranks` (int vars in 1..`top`, `top` < 100).

    Each rank after the first is one or two digits wide, which sets the
    power of ten under every earlier rank. One linear equality per width
    combination, enforced by the width literals it assumes.
    """
    k = len(ranks)
    num = m.NewIntVar(*number_bounds(k, top), name)
    wide = []
    for i, r in enumerate(ranks[1:], 1):
        b = m.NewBoolVar(f"{name}_w{i}")
        m.Add(r >= 10).OnlyEnforceIf(b)
        m.Add(r <= 9).OnlyEnforceIf(b.Not())
        wide.append(b)
    for widths in _width_cases(k - 1):
        lits = [b if w == 2 else b.Not() for b, w in zip(wide, widths, strict=True)]
        shift = 0
        terms = []
        for r, w in zip(reversed(ranks), reversed((1, *widths)), strict=True):
            terms.append(r * 10**shift)
            shift += w
        m.Add(num == sum(terms)).OnlyEnforceIf(lits)
    return num


def number_bounds(k, top):
    """The smallest and largest number `k` ranks in 1..`top` can concatenate to."""
    assert top < 100, "widths beyond two digits are not encoded"
    return int("1" * k), int(str(top) * k)


def _width_cases(count):
    if count == 0:
        return [()]
    return [(w, *rest) for w in (1, 2) for rest in _width_cases(count - 1)]


def build(n=9, ranked_cells=(), latin=True):
    m = cp_model.CpModel()
    x = [[m.NewIntVar(1, n, f"x{r}{c}") for c in range(n)] for r in range(n)]
    for i in range(n):
        m.AddAllDifferent(x[i])
        m.AddAllDifferent([x[r][i] for r in range(n)])
    box = int(n**0.5)
    assert box * box == n, "boxes need a square size"
    for br in range(0, n, box):
        for bc in range(0, n, box):
            m.AddAllDifferent(
                [x[r][c] for r in range(br, br + box) for c in range(bc, bc + box)]
            )

    w = n - 1
    top = w * w
    v = [[m.NewIntVar(1111, 9999, f"v{r}{c}") for c in range(w)] for r in range(w)]
    for r in range(w):
        for c in range(w):
            m.Add(
                v[r][c]
                == 1000 * x[r][c]
                + 100 * x[r][c + 1]
                + 10 * x[r + 1][c]
                + x[r + 1][c + 1]
            )
    flat = [v[r][c] for r in range(w) for c in range(w)]
    rank = [[None] * w for _ in range(w)]
    for r in range(w):
        for c in range(w):
            mine = v[r][c]
            others = [u for u in flat if u is not mine]
            rank[r][c] = add_rank(m, others, mine, f"rank{r}{c}", hi=top)
            if latin:
                # Leading-digit bound: a window whose top-left digit is d ranks
                # within [(n-2)(d-1)+1, (n-2)(d-1)+(n-1)] on a full latin square.
                m.Add(rank[r][c] >= (n - 2) * (x[r][c] - 1) + 1)
                m.Add(rank[r][c] <= (n - 2) * (x[r][c] - 1) + (n - 1))

    num = [
        [
            add_cell_number(
                m, [rank[wr][wc] for wr, wc in windows_of(n, r, c)], top, f"num{r}{c}"
            )
            for c in range(n)
        ]
        for r in range(n)
    ]
    bounds = [
        [number_bounds(len(windows_of(n, r, c)), top) for c in range(n)]
        for r in range(n)
    ]
    q = {}
    for r, c in ranked_cells:
        q[(r, c)] = add_cell_rank(m, num, bounds, (r, c), f"q{r}{c}")
    return Model(n, m, x, v, rank, num, q)


def add_cell_rank(m, num, bounds, cell, name):
    """The cell's rank among all cells, counting only cells that can lie below it."""
    r, c = cell
    ceiling = bounds[r][c][1]
    others = [
        u
        for rr, row in enumerate(num)
        for cc, u in enumerate(row)
        if (rr, cc) != cell and bounds[rr][cc][0] < ceiling
    ]
    return add_rank(m, others, num[r][c], name, hi=len(num) * len(num[0]))
