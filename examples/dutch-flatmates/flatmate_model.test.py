# The CP-SAT flatmate model against an independent statement of the rule: on
# grids reached from the shipped solution by sudoku symmetries (digit
# relabelings, row and column swaps within a band or stack), the model accepts a
# grid exactly when a plain Python check of the rule does. Half the sample keeps
# the 1, 5 and 9 where they are and only moves the columns and the other digits,
# which preserves the rule; the other half moves everything, which moves 5s into
# the top and bottom rows, so both edge cases are in the sample.
#
#   uv run examples/dutch-flatmates/flatmate_model.test.py

import pathlib
import random
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import read_board
from cpsat import SOLVED, solver
from flatmate_model import N, build_model, count_plain_completions


def rule_holds(grid):
    """The rule, stated plainly: every 5 has a 1 above or a 9 below."""
    for r in range(N):
        for c in range(N):
            if grid[r, c] != 5:
                continue
            above = r > 0 and grid[r - 1, c] == 1
            below = r < N - 1 and grid[r + 1, c] == 9
            if not (above or below):
                return False
    return True


def model_accepts(grid, flatmate):
    m, _x = build_model(grid, flatmate)
    return solver(10).Solve(m) in SOLVED


def symmetry(grid, rng, keep_rule):
    """A sudoku symmetry of `grid`: relabel digits, then permute rows within
    bands and bands, columns within stacks and stacks. `keep_rule` leaves the
    1, 5 and 9 and the rows alone, which keeps every flatmate pair intact."""
    digits = list(range(1, N + 1))
    if keep_rule:
        movable = [d for d in digits if d not in (1, 5, 9)]
        shuffled = movable[:]
        rng.shuffle(shuffled)
        digits = [dict(zip(movable, shuffled, strict=True)).get(d, d) for d in digits]
    else:
        rng.shuffle(digits)
    order = []
    for _ in range(2):
        bands = [0, 1, 2]
        rng.shuffle(bands)
        within = []
        for b in bands:
            rows = [3 * b + i for i in range(3)]
            rng.shuffle(rows)
            within.extend(rows)
        order.append(within)
    rows, cols = order
    if keep_rule:
        rows = list(range(N))
    return {
        (r, c): digits[grid[rows[r], cols[c]] - 1] for r in range(N) for c in range(N)
    }


if __name__ == "__main__":
    grid_rows, givens = read_board(HERE / "gen.json")
    grid = {(r, c): int(grid_rows[r][c]) for r in range(N) for c in range(N)}
    assert rule_holds(grid) and model_accepts(grid, True), "the shipped solution fails"

    rng = random.Random(676)
    accepted = rejected = edge_rejected = 0
    for i in range(150):
        g = symmetry(grid, rng, keep_rule=i % 2 == 0)
        want = rule_holds(g)
        assert model_accepts(g, False), "a symmetry of a solution broke plain sudoku"
        assert model_accepts(g, True) == want, (
            f"the model disagrees with the rule on {g}"
        )
        if want:
            accepted += 1
        else:
            rejected += 1
            edge_rejected += any(
                g[r, c] == 5
                and not (r > 0 and g[r - 1, c] == 1)
                and not (r < N - 1 and g[r + 1, c] == 9)
                and r in (0, N - 1)
                for r in range(N)
                for c in range(N)
            )
    assert accepted and rejected, "the sample never exercised both verdicts"
    assert edge_rejected, "no rejected grid had a bad 5 in the top or bottom row"
    print(
        f"model agrees with the rule on 150 symmetries: {accepted} accepted, "
        f"{rejected} rejected ({edge_rejected} with a bad edge-row 5)"
    )

    # the plain count is capped: a count at the cap reads "cap or more"
    assert count_plain_completions({}, 5) == 5
    assert count_plain_completions(grid, 5) == 1
    print("PASS")
