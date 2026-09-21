"""The CP-SAT model agrees with the oracle whenever the grid is fixed.

Two seams. `add_cell_number` on rank variables pinned to chosen values, one
case per combination of one- and two-digit ranks, against `oracle.concat`.
Then the whole 9x9 model with every cell fixed to a random full sudoku grid:
its window ranks, cell numbers and cell ranks must equal the oracle's. The
grids come from a seeded shuffle of a base pattern, not from a solver, so the
run is the same every time. Workers pinned to 1, well under a second a grid.

    uv run finders/qqrr/test_model.py
"""

import itertools
import random
import sys
from pathlib import Path

from ortools.sat.python import cp_model

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import model
import oracle

from examples._shared import cpsat


def solve(m):
    s = cpsat.solver(30)
    status = s.Solve(m)
    assert status in cpsat.SOLVED, s.StatusName(status)
    return s


# Concatenation: every mix of one- and two-digit ranks, for one, two and four
# windows, reproduces the oracle's unpadded number.
for k in (1, 2, 4):
    for widths in itertools.product((1, 2), repeat=k):
        ranks = [
            random.Random(str(widths)).randint(*((1, 9) if w == 1 else (10, 64)))
            for w in widths
        ]
        m = cp_model.CpModel()
        rank_vars = [m.NewIntVar(1, 64, f"r{i}") for i in range(k)]
        for var, val in zip(rank_vars, ranks, strict=True):
            m.Add(var == val)
        num = model.add_cell_number(m, rank_vars, 64, "n")
        assert solve(m).Value(num) == oracle.concat(ranks), (ranks, widths)


def random_sudoku(rng):
    """A full 9x9 sudoku grid: the base pattern under band, stack and digit shuffles."""
    base = [[(3 * (r % 3) + r // 3 + c) % 9 + 1 for c in range(9)] for r in range(9)]
    rows = [
        r
        for band in rng.sample(range(3), 3)
        for r in rng.sample([3 * band + i for i in range(3)], 3)
    ]
    cols = [
        c
        for stack in rng.sample(range(3), 3)
        for c in rng.sample([3 * stack + i for i in range(3)], 3)
    ]
    digits = rng.sample(range(1, 10), 9)
    return [[digits[base[r][c] - 1] for c in cols] for r in rows]


rng = random.Random(592)
for trial in range(20):
    grid = random_sudoku(rng)
    q = model.build(9, ranked_cells=[(r, c) for r in range(9) for c in range(9)])
    for r in range(9):
        for c in range(9):
            q.m.Add(q.x[r][c] == grid[r][c])
    s = solve(q.m)
    ranks, numbers, cranks = oracle.rank_grid(grid)
    got = [[s.Value(v) for v in row] for row in q.rank]
    assert got == ranks, (trial, got, ranks)
    got = [[s.Value(v) for v in row] for row in q.num]
    assert got == numbers, (trial, got, numbers)
    got = [[s.Value(q.q[(r, c)]) for c in range(9)] for r in range(9)]
    assert got == cranks, (trial, got, cranks)

# The sudoku houses are in the model: a grid with a repeated digit in a row
# has no solution.
q = model.build(9)
q.m.Add(q.x[0][0] == 5)
q.m.Add(q.x[0][8] == 5)
assert cpsat.solver(30).Solve(q.m) == cp_model.INFEASIBLE

print("ok test_model")
