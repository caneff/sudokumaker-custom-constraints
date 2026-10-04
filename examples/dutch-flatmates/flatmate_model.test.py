# Not covered: a top-row 5 leaning on a 1 wrapped up from the bottom row.

import pathlib
import random
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import read_board
from cpsat import SOLVED, solver
from flatmate_model import N, build_model, count_plain_completions


def bad_fives(grid):
    return [
        (r, c)
        for r in range(N)
        for c in range(N)
        if grid[r, c] == 5
        and not (r > 0 and grid[r - 1, c] == 1)
        and not (r < N - 1 and grid[r + 1, c] == 9)
    ]


def rule_holds(grid):
    return not bad_fives(grid)


def model_accepts(grid, flatmate):
    m, _x = build_model(grid, flatmate)
    return solver(10).Solve(m) in SOLVED


def symmetry(grid, rng, keep_rule):
    """`keep_rule` leaves the 1, 5 and 9 and the rows alone, which keeps every
    flatmate pair intact."""
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


# The wrap case turns up about 4 times in a million symmetries, so the search runs long.
SEARCH_TRIES = 1_000_000


def edge_only_violations(grid, rng):
    """One symmetry of `grid` for each edge case whose only bad 5 is an edge-row
    one: {"top": g, "bottom": g, "wrap": g}. The wrap grid's bad 5 is in the
    bottom row with a 9 at the top of its column, which a model that wraps the 9
    below round to the top row would accept. Raises AssertionError when the
    sample misses a case."""
    found = {}
    for _ in range(SEARCH_TRIES):
        g = symmetry(grid, rng, keep_rule=False)
        bad = bad_fives(g)
        if len(bad) != 1:
            continue
        ((r, c),) = bad
        if r == 0:
            found.setdefault("top", g)
        elif r == N - 1:
            found.setdefault("bottom", g)
            if g[0, c] == 9:
                found.setdefault("wrap", g)
        if len(found) == 3:
            return found
    raise AssertionError(
        f"{SEARCH_TRIES} symmetries missed an edge case: {sorted(found)}"
    )


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
            edge_rejected += any(r in (0, N - 1) for r, _c in bad_fives(g))
    assert accepted and rejected, "the sample never exercised both verdicts"
    assert edge_rejected, "no rejected grid had a bad 5 in the top or bottom row"
    print(
        f"model agrees with the rule on 150 symmetries: {accepted} accepted, "
        f"{rejected} rejected ({edge_rejected} with a bad edge-row 5)"
    )

    for case, g in edge_only_violations(grid, rng).items():
        assert model_accepts(g, False), f"{case}: not a plain sudoku grid"
        assert not model_accepts(g, True), (
            f"the model accepted a grid whose only bad 5 is the {case} edge-row one"
        )
    print("model rejects grids whose only violation is an edge-row 5")

    assert count_plain_completions({}, 5) == 5
    assert count_plain_completions(grid, 5) == 1
    assert count_plain_completions({(0, 0): 1, (0, 1): 1}, 5) == 0
    try:
        count_plain_completions({}, 10**9, limit=0.3)
    except TimeoutError:
        pass
    else:
        raise AssertionError("a timed-out count was returned as a verdict")
    print("PASS")
