"""The checker reads the opener the way OPENER_NOTES.md says, and its count
loop reports what the model holds.

Expected clue positions and values below are the notes' table, read by hand
from the link: circled marks are clues, uncircled marks and entered digits
are hypotheses. The count loop is exercised on a model with every cell fixed
to one grid, where the only honest answer is one solution, ranked as the
oracle ranks it. Workers pinned to 1.

    uv run finders/qqrr/test_checker.py
"""

import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import checker
import oracle

HERE = Path(__file__).resolve().parent
op = checker.load_opener(HERE / "opener.json")

assert op.n == 9
assert op.window_clues == {(6, 6): (10, 10), (2, 5): (51, 56), (4, 4): (58, 64)}
assert op.cell_clues == {(0, 4): 33}
assert op.window_hypotheses == {(3, 2): (9, 9), (4, 1): (8, 8), (3, 1): (1, 1)}
assert op.digit_hypotheses[(0, 3)] == 7
assert op.digit_hypotheses[(8, 0)] == 8
assert len(op.digit_hypotheses) == 13
assert checker.CORNERS == {"tl": (0, 0), "tr": (0, 8), "bl": (8, 0), "br": (8, 8)}

# The bands parse as the notes say: exact, inclusive range, open-ended.
assert checker.parse_band("10", 64) == (10, 10)
assert checker.parse_band("51-56", 64) == (51, 56)
assert checker.parse_band("58+", 64) == (58, 64)


def random_sudoku(rng):
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


grid = random_sudoku(random.Random(7))
ranks, numbers, cranks = oracle.rank_grid(grid)
# A run whose clues are read off the grid itself: the one clue set that is
# certainly consistent. Fixing every digit makes the answer unique.
fixed = checker.Opener(
    n=9,
    window_clues={(6, 6): (ranks[6][6], ranks[6][6])},
    cell_clues={(0, 4): cranks[0][4]},
    window_hypotheses={},
    digit_hypotheses={(r, c): grid[r][c] for r in range(9) for c in range(9)},
)
report = checker.run(
    fixed, corner=None, hypotheses=True, count=2, workers=1, timeout=30
)
assert report.status == "unique", report.status
assert report.solutions[0].grid == grid
assert report.solutions[0].window_ranks == ranks
assert report.solutions[0].cell_ranks == cranks

# With the corner pinned to a rank the grid does not have, nothing satisfies.
wrong = cranks[0][0] % 81 + 1
fixed_wrong = checker.Opener(9, {}, {(0, 0): wrong}, {}, fixed.digit_hypotheses)
report = checker.run(
    fixed_wrong, corner=None, hypotheses=True, count=2, workers=1, timeout=30
)
assert report.status == "infeasible", report.status

# The report renders the grid and all three tables.
text = checker.render(checker.run(fixed, None, True, 2, 1, 30))
assert "unique" in text
assert "window ranks" in text and "cell numbers" in text and "cell ranks" in text

print("ok test_checker")
