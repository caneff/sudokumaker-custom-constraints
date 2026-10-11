"""The hybrid grid's picture (#791), read back by pixel.

The grid is the decision log's one 4x4 grid with `c1:turn` and `r2c4`
circled (§ Hybrid), drawn in the docstring of `GRID` below with its regions
worked out by hand. No solver runs; under a second.

    uv run finders/ubahn/test_ubahn_hybrid_render.py
"""

import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import hybrid
import hybrid_render
import network

ok = True


def check(name, cond):
    global ok
    status = "ok" if cond else "FAIL"
    if not cond:
        ok = False
    print(f"{status}: {name}")


# The board, number cells and all (cross, branch, straight, turn from the
# outside in):
#
#              0  1  0  0
#              1  1  4  0
#              0  1  0  2
#              2  1  0  2
#  0  1  1  2  ┌─────┬──┐
#  0  3  1  0  ├──┬──┤  │
#  1  1  1  1  └──┼──┤  │
#  0  1  0  2     └──┴──┘
#
# Its two bananas: column 2's four number cells with c1:branch (5 cells), and
# the 20 cells around r1c1. r1c2, a straight on its own, is a chocolate of 1.
GRID = network.from_drawing(["┌─┬┐", "├┬┤│", "└┼┤│", " └┴┘"])
GIVEN = [hybrid.parse_cell(name) for name in ("c1:turn", "r2c4")]


def cell(name):
    return hybrid.parse_cell(name)


def fill(picture, name):
    """The colour a cell is filled with: a pixel just inside its corner,
    clear of its number, its ring and the network through its centre."""
    x0, y0, _, _ = picture.box(cell(name))
    return picture.image.getpixel((x0 + 8, y0 + 8))


picture = hybrid_render.Picture(GRID, 4, 4, GIVEN)

check(
    "a chocolate cell is filled with the chocolate colour, grid cell and "
    "number cell alike",
    fill(picture, "r1c2") == hybrid_render.CHOCOLATE
    and fill(picture, "c3:branch") == hybrid_render.CHOCOLATE,
)
check(
    "a banana cell's fill is not the chocolate's",
    fill(picture, "r1c1") != hybrid_render.CHOCOLATE
    and fill(picture, "c2:turn") != hybrid_render.CHOCOLATE,
)
check(
    "two cells of one banana share a tint, grid cell and number cell alike",
    fill(picture, "r1c1") == fill(picture, "r3:turn")
    and fill(picture, "c2:turn") == fill(picture, "c1:branch"),
)
check(
    "two separate bananas have different tints",
    fill(picture, "r1c1") != fill(picture, "c2:turn"),
)
check(
    "the corner above and left of the strips is off the board: background",
    picture.image.getpixel((hybrid_render.MARGIN + 8, hybrid_render.MARGIN + 8))
    == hybrid_render.BACKGROUND,
)


def count(picture, name, colour):
    """How many of a cell's pixels are this colour."""
    x0, y0, x1, y1 = picture.box(cell(name))
    return sum(
        picture.image.getpixel((x, y)) == colour
        for x in range(x0, x1)
        for y in range(y0, y1)
    )


def centre(picture, name):
    x0, y0, x1, y1 = picture.box(cell(name))
    return (x0 + x1) // 2, (y0 + y1) // 2


# The valid circles, by hand from the board above: c1:turn (2) shares a
# chocolate of 2 with c1:straight (0); r1:turn (2) one of 2 with r2:turn (0);
# r2c4 and r3c4, both straights (2), are a chocolate of 2. No other cell's
# value is its region's size: the bananas hold 5 and 20 cells, and no number
# reaches either.
VALID = ["c1:turn", "r1:turn", "r2c4", "r3c4"]
check(
    "the rule reader's valid circles are the four worked out by hand",
    sorted(map(hybrid.cell_name, hybrid.valid_circles(picture.board))) == VALID,
)
ringed = sorted(
    hybrid.cell_name(c)
    for c in picture.board
    if count(picture, hybrid.cell_name(c), hybrid_render.VALID_RING)
    + count(picture, hybrid.cell_name(c), hybrid_render.GIVEN_RING)
)
check(
    f"a ring is drawn on those four cells and on no other ({ringed})", ringed == VALID
)
check(
    "a valid circle that is no condition has a whole ring in the valid colour",
    all(
        count(picture, name, hybrid_render.VALID_RING) > 200
        and not count(picture, name, hybrid_render.GIVEN_RING)
        for name in ("r1:turn", "r3c4")
    ),
)
check(
    "a circle that is a condition has its ring in the given colour instead",
    all(
        count(picture, name, hybrid_render.GIVEN_RING) > 200
        and not count(picture, name, hybrid_render.VALID_RING)
        for name in ("c1:turn", "r2c4")
    ),
)
check(
    "with no condition, the same four rings are all in the valid colour",
    all(
        count(hybrid_render.Picture(GRID, 4, 4), name, hybrid_render.VALID_RING) > 200
        for name in VALID
    ),
)

# The network. r1c1 is a turn with arms east and south, so its outer corner
# is up and to the left of its centre: the notch two butt-ended lines leave.
x, y = centre(picture, "r1c1")
check(
    "a pixel at the outer corner of a turn is the network's colour",
    picture.image.getpixel((x - 3, y - 3)) == hybrid_render.NETWORK,
)
x2, _ = centre(picture, "r1c2")
check(
    "the network runs along an edge that is on, r1c1 to r1c2",
    picture.image.getpixel(((x + x2) // 2, y)) == hybrid_render.NETWORK,
)
_, y2 = centre(picture, "r2c2")
check(
    "and not along one that is off, r1c2 to r2c2",
    picture.image.getpixel((x2, (y + y2) // 2)) != hybrid_render.NETWORK,
)
check(
    "a blank cell, r4c1, has no network in it",
    not count(picture, "r4c1", hybrid_render.NETWORK),
)

sys.exit(0 if ok else 1)
