# Generate the Numbered Rooms Lines board: a 6x6 sudoku inside an interactive
# clue ring, where five of the twenty-four lines are DRAWN rather than straight
# -- two diagonals, a bent path, a partial row, a partial column.
#
#   uv run --with ortools --with lzstring \
#       examples/numbered-rooms-lines/generate.py [seed_count]
#
# lzstring is not used here; framebuild.py pulls in the link codec.
#
# Writes gen.json next to this script. Rebuild the link afterwards:
#   uv run --with lzstring examples/numbered-rooms-lines/build_link.py
#
# Why every ring cell still owns a line: a ring cell belongs to no region and
# no row/column cage, so a ring cell with no line is a free digit and the board
# has 6 solutions per such cell. The nineteen untouched lines stay straight, as
# in examples/numbered-rooms; the five drawn lines are what this example is
# for. examples/_shared/framebuild.py cannot build the board -- it draws one
# straight line per row and column and takes no line geometry.
#
# The rule modelled here must stay the rule NumberedRoomsLinesComponent
# enforces (CODING_STANDARDS.md, "The rule has one home"): for a line
# cells[0..m-1] with clue digit C, k = value(cells[0]) and value(cells[k-1]) = C.

import json
import pathlib
import random
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from framebuild import make_grid, unique

N = 6
BOX = (2, 3)  # box height, box width

# The five drawn lines, by the ring key of their clue cell. A ring key names
# the clue's cell on the frame: "T3"/"B3" sit above/below interior column 3,
# "L2"/"R2" left/right of interior row 2 (the keys framebuild.py uses). Cells
# are interior (row, column), nearest the clue first.
DRAWN = {
    # main diagonal, R1C1 down to R6C6. Past the first box no two cells share
    # a house, so the app cannot prove the digits distinct: distinct = false.
    "T0": [(0, 0), (1, 1), (2, 2), (3, 3), (4, 4), (5, 5)],
    # anti-diagonal, R1C6 down to R6C1, also not a house
    "T5": [(0, 5), (1, 4), (2, 3), (3, 2), (4, 1), (5, 0)],
    # bent path: three cells right along row 3, then down column 3
    "L2": [(2, 0), (2, 1), (2, 2), (3, 2), (4, 2)],
    # the first three cells of row 1: one house, so the app does prove
    # the digits distinct
    "L0": [(0, 0), (0, 1), (0, 2)],
    # rows 6, 5 and 4 of column 4, read upwards: one house as well
    "B3": [(5, 3), (4, 3), (3, 3)],
}


def make_lines():
    """Every ring key's line: a straight row or column, unless DRAWN overrides it."""
    lines = {}
    for i in range(N):
        lines[f"L{i}"] = [(i, c) for c in range(N)]
        lines[f"R{i}"] = [(i, c) for c in range(N - 1, -1, -1)]
        lines[f"T{i}"] = [(r, i) for r in range(N)]
        lines[f"B{i}"] = [(r, i) for r in range(N - 1, -1, -1)]
    lines.update(DRAWN)
    return lines


def clue_of(grid, cells):
    """The Numbered Rooms clue for one line, or None when the index runs off it.

    A three-cell line needs its first digit in 1..3, which most grids fail.
    """
    k = grid[cells[0][0]][cells[0][1]]
    if not 1 <= k <= len(cells):
        return None
    r, c = cells[k - 1]
    return grid[r][c]


def post_clue(m, x, cells, digit, n, tag):
    """Post one line's clue relation on the CP-SAT model: with k the digit in
    cells[0], cells[k - 1] holds `digit`. The shape framebuild.unique calls,
    and the rule NumberedRoomsLinesComponent enforces."""
    picked = []
    for k in range(1, len(cells) + 1):
        b = m.NewBoolVar(f"{tag}k{k}")
        m.Add(x[cells[0]] == k).OnlyEnforceIf(b)
        m.Add(x[cells[0]] != k).OnlyEnforceIf(b.Not())
        m.Add(x[cells[k - 1]] == digit).OnlyEnforceIf(b)
        picked.append(b)
    m.AddExactlyOne(picked)


def solved_uniquely(lines, clue, active, givens):
    """True when the interior has exactly one solution.

    A hidden clue cell is a free digit that its own line's rule fills in, so a
    line outside `active` constrains the interior not at all and is left out.
    The ring follows the interior: every ring cell owns a line, so its digit is
    a function of the solved grid. The four corners own no line and ship as
    pinned fillers, so the whole board is unique exactly when the interior is.
    """
    return unique(post_clue, lines, clue, active, givens, N, *BOX)


def carve(rng, lines, grid, clue):
    """With every clue shown, drop interior givens while the solution stays unique."""
    active = set(lines)
    givens = {(r, c): grid[r][c] for r in range(N) for c in range(N)}
    order = [(r, c) for r in range(N) for c in range(N)]
    rng.shuffle(order)
    for cell in order:
        v = givens.pop(cell)
        if not solved_uniquely(lines, clue, active, givens):
            givens[cell] = v
    return givens


def hide(rng, lines, clue, givens):
    """Drop shown clues while the solution stays unique; the rest go interactive."""
    active = set(lines)
    # sorted before the shuffle: set iteration order is randomized per
    # process, and the order steers which clues survive
    order = sorted(active)
    rng.shuffle(order)
    for key in order:
        active.discard(key)
        if not solved_uniquely(lines, clue, active, givens):
            active.add(key)
    return active


def generate(seeds):
    lines = make_lines()
    best = None
    for seed in seeds:
        rng = random.Random(seed)
        grid = make_grid(rng, N, *BOX)
        clue = {key: clue_of(grid, cells) for key, cells in lines.items()}
        if any(v is None for v in clue.values()):
            print(f"  seed {seed}: skipped, an index runs off a drawn line")
            continue
        givens = carve(rng, lines, grid, clue)
        active = hide(random.Random(seed * 7), lines, clue, givens)
        print(f"  seed {seed}: givens = {len(givens)}, clues shown = {len(active)}")
        if best is None or (len(givens), len(active)) < (len(best[2]), len(best[3])):
            best = (seed, grid, givens, active, clue)
    seed, grid, givens, active, clue = best
    assert solved_uniquely(lines, clue, active, givens) is True
    print(
        f"CHOSEN seed {seed}: givens = {len(givens)}, clues shown = {len(active)}, "
        f"clues interactive = {len(lines) - len(active)}"
    )
    return seed, grid, givens, active, clue, lines


if __name__ == "__main__":
    count = int(sys.argv[1]) if len(sys.argv) > 1 else 20
    seed, grid, givens, active, clue, lines = generate(range(101, 101 + count))
    out = pathlib.Path(__file__).parent / "gen.json"
    with out.open("w") as f:
        json.dump(
            {
                "seed": seed,
                "n": N,
                "box": list(BOX),
                "grid": grid,
                "lines": {k: [list(c) for c in lines[k]] for k in sorted(lines)},
                "drawn": sorted(DRAWN),
                "clue": {k: clue[k] for k in sorted(clue)},
                "active": sorted(active),
                "givens": {f"{r},{c}": v for (r, c), v in sorted(givens.items())},
            },
            f,
            indent=1,
        )
    print(f"wrote {out}")
