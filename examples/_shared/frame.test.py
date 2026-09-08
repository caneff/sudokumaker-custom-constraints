# frame.cosmetics: the three decoration layers every frame board ships, and
# the merge that draws them with fewer points (#385).
#
# The picture is the contract, not the polylines: these layers hide the ring's
# cell borders, box the shown clue cells, and draw the interior's outer border,
# and a solver must see exactly the same board after the merge. So each case
# states the picture the old code drew -- one closed unit square per cell --
# right here, independently of frame.py, and asserts the merged layer draws
# the same set of unit segments with fewer points.
#
#   uv run examples/_shared/frame.test.py

import itertools
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from frame import cosmetics, ring_cell

# The board widths every example ships: 4x4, 6x6, 9x9 and 10x10 interiors,
# each inside a one-cell clue ring, so W = n + 2.
WIDTHS = (6, 8, 11, 12)


def _unit_segments(lines):
    """Every unit-length segment a list of polylines draws, as an unordered
    set. Two layers show the same picture exactly when these sets are equal:
    a polyline's own point list says nothing a viewer can see, but the ink it
    lays down does."""
    segs = set()
    for pts in lines:
        for a, b in itertools.pairwise(pts):
            a, b = (a["x"], a["y"]), (b["x"], b["y"])
            assert (a[0] == b[0]) != (a[1] == b[1]), f"not one axis: {a} -> {b}"
            if a[0] == b[0]:
                lo, hi = sorted((a[1], b[1]))
                segs |= {((a[0], y), (a[0], y + 1)) for y in range(lo, hi)}
            else:
                lo, hi = sorted((a[0], b[0]))
                segs |= {((x, a[1]), (x + 1, a[1])) for x in range(lo, hi)}
    return segs


def _points(lines):
    return sum(len(pts) for pts in lines)


# ---- the picture, restated independently of frame.py ----------------------


def _ring_cells(W):
    """Every cell of the one-cell clue ring around a (W-2) x (W-2) interior."""
    return (
        [(0, c) for c in range(W)]
        + [(W - 1, c) for c in range(W)]
        + [(r, 0) for r in range(1, W - 1)]
        + [(r, W - 1) for r in range(1, W - 1)]
    )


def _square(x0, y0, x1, y1):
    """A closed rectangle, the way the pre-merge code drew every one of them."""
    return [
        {"x": x0, "y": y0},
        {"x": x1, "y": y0},
        {"x": x1, "y": y1},
        {"x": x0, "y": y1},
        {"x": x0, "y": y0},
    ]


def _cells_with_given_ring(W, shown):
    """A board's cell list: the four corner fillers are always givens, and
    `shown` names the ring keys whose clue cell is a shown given."""
    cells = [{} for _ in range(W * W)]
    for r, c in [(0, 0), (0, W - 1), (W - 1, 0), (W - 1, W - 1)]:
        cells[r * W + c] = {"given": True, "value": 1}
    for key in shown:
        r, c = ring_cell(key, W)
        cells[r * W + c] = {"given": True, "value": 1}
    return cells


def _layer(W, cells, name):
    return next(layer for layer in cosmetics(W, cells) if layer["name"] == name)


# ---- the cases ------------------------------------------------------------


def test_white_lines_still_cover_every_ring_cell_border():
    for W in WIDTHS:
        cells = _cells_with_given_ring(W, [])
        want = _unit_segments([_square(c, r, c + 1, r + 1) for r, c in _ring_cells(W)])
        got = _layer(W, cells, "White Lines (to hide outside cell borders)")["lines"]
        assert _unit_segments(got) == want, f"W={W}: the white layer changed shape"


def test_white_lines_cost_far_fewer_points_than_a_square_per_cell():
    # The layer is 4W-4 closed squares at five points each before the merge.
    # Halving is the bar: below it the merge is not worth its own code.
    for W in WIDTHS:
        cells = _cells_with_given_ring(W, [])
        before = 5 * len(_ring_cells(W))
        after = _points(
            _layer(W, cells, "White Lines (to hide outside cell borders)")["lines"]
        )
        assert after * 2 <= before, f"W={W}: {after} points, want at most {before // 2}"


def test_outlines_box_the_shown_clue_cells_and_nothing_else():
    for W in WIDTHS:
        n = W - 2
        shown = ["T0", "T1", "L0", f"R{n - 1}", f"B{n - 1}"]
        cells = _cells_with_given_ring(W, shown)
        boxes = [ring_cell(k, W) for k in shown]
        want = _unit_segments([_square(c, r, c + 1, r + 1) for r, c in boxes])
        got = _layer(W, cells, "Outside Cell Outlines")["lines"]
        assert _unit_segments(got) == want, f"W={W}: the boxed cells changed"


def test_outlines_never_box_a_corner_filler():
    # A corner sits on both edges, belongs to no line, and its "1" is solver
    # support rather than a clue. It is a given on every board, so a merge
    # that boxed givens blindly would draw four boxes here.
    for W in WIDTHS:
        cells = _cells_with_given_ring(W, [])
        got = _layer(W, cells, "Outside Cell Outlines")["lines"]
        assert _unit_segments(got) == set(), f"W={W}: a corner filler got boxed"


def test_adjacent_boxed_cells_keep_the_border_between_them():
    # Two neighbouring clue cells each get their own box, so the edge they
    # share is drawn. Merging their outlines into one 1x2 box would erase it.
    W = 11
    shown = ["T3", "T4"]
    cells = _cells_with_given_ring(W, shown)
    boxes = [ring_cell(k, W) for k in shown]
    want = _unit_segments([_square(c, r, c + 1, r + 1) for r, c in boxes])
    got = _layer(W, cells, "Outside Cell Outlines")["lines"]
    assert _unit_segments(got) == want
    assert ((4, 0), (4, 1)) in _unit_segments(got), "the shared edge went missing"


def test_the_outer_border_is_the_interior_square():
    for W in WIDTHS:
        cells = _cells_with_given_ring(W, [])
        want = _unit_segments([_square(1, 1, W - 1, W - 1)])
        layer = _layer(W, cells, "Grid Outer Border")
        assert _unit_segments(layer["lines"]) == want, f"W={W}: the border moved"
        # One closed square needs five points; the old code walked it a cell
        # at a time and spent 4W-7.
        assert _points(layer["lines"]) == 5, f"W={W}: {_points(layer['lines'])} points"


def test_every_layer_keeps_its_name_type_and_style():
    W = 11
    layers = cosmetics(W, _cells_with_given_ring(W, ["T3"]))
    assert [layer["name"] for layer in layers] == [
        "White Lines (to hide outside cell borders)",
        "Outside Cell Outlines",
        "Grid Outer Border",
    ]
    assert [layer["type"] for layer in layers] == [2000, 2000, 2000]
    assert [layer["style"] for layer in layers] == [
        {"thickness": 0.05, "color": "#ffffffff"},
        {"thickness": 0.03, "color": "#d7d7d7ff"},
        {"thickness": 0.07, "color": "#000000ff"},
    ]


def test_no_layer_draws_the_same_segment_twice():
    # The whole point of the merge is that a shared edge is drawn once. A walk
    # that doubled back would still cover the right union and still cost the
    # points the merge exists to save.
    for W in WIDTHS:
        n = W - 2
        cells = _cells_with_given_ring(W, [f"T{i}" for i in range(0, n, 2)])
        for layer in cosmetics(W, cells):
            drawn = sum(
                abs(b["x"] - a["x"]) + abs(b["y"] - a["y"])
                for pts in layer["lines"]
                for a, b in itertools.pairwise(pts)
            )
            distinct = len(_unit_segments(layer["lines"]))
            assert drawn == distinct, f"W={W} {layer['name']}: {drawn} for {distinct}"


if __name__ == "__main__":
    test_white_lines_still_cover_every_ring_cell_border()
    test_white_lines_cost_far_fewer_points_than_a_square_per_cell()
    test_outlines_box_the_shown_clue_cells_and_nothing_else()
    test_outlines_never_box_a_corner_filler()
    test_adjacent_boxed_cells_keep_the_border_between_them()
    test_the_outer_border_is_the_interior_square()
    test_every_layer_keeps_its_name_type_and_style()
    test_no_layer_draws_the_same_segment_twice()
    print("frame self-check OK")
