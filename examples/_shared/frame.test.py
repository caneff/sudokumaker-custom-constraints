# frame.cosmetics: the three decoration layers every frame board ships, and
# the merge that draws them with fewer points (#385).
#
# The picture is the contract, not the polylines: these layers hide the ring's
# cell borders, box the shown clue cells, and draw the interior's outer border,
# and a solver must see exactly that board. So each case states the picture the
# layers must show -- one closed unit square per cell -- right here,
# independently of frame.py, and asserts the merged layer draws the same set of
# unit segments with fewer points.
#
#   uv run examples/_shared/frame.test.py

import itertools
import pathlib
import re
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
    """A closed rectangle: five points, the corners with the first repeated.
    One per cell is the picture these layers have to show."""
    return [
        {"x": x0, "y": y0},
        {"x": x1, "y": y0},
        {"x": x1, "y": y1},
        {"x": x0, "y": y1},
        {"x": x0, "y": y0},
    ]


def _cells_with_given_ring(W, shown):
    """A board's cell list: every corner is a given, and `shown` names the ring
    keys whose clue cell is a shown given.

    `framebuild` leaves the corners empty (#394), so this is a board it never
    builds -- deliberately, because the guard under test is what stops a
    corner given being drawn as a clue, and only a corner given exercises it.
    """
    cells = [{} for _ in range(W * W)]
    for r, c in [(0, 0), (0, W - 1), (W - 1, 0), (W - 1, W - 1)]:
        cells[r * W + c] = {"given": True, "value": 1}
    for key in shown:
        r, c = ring_cell(key, W)
        cells[r * W + c] = {"given": True, "value": 1}
    return cells


# The layers are told apart by draw order, the contract the picture depends on
# (white paint first, the black border on top), not by the display names the
# app shows, which a rewording must not break.
WHITE, OUTLINES, BORDER = 0, 1, 2


def _layer(W, cells, role):
    layers = cosmetics(W, cells)
    assert len(layers) == 3, f"want 3 cosmetic layers, got {len(layers)}"
    return layers[role]


# ---- the cases ------------------------------------------------------------


def test_white_lines_still_cover_every_ring_cell_border():
    for W in WIDTHS:
        cells = _cells_with_given_ring(W, [])
        want = _unit_segments([_square(c, r, c + 1, r + 1) for r, c in _ring_cells(W)])
        got = _layer(W, cells, WHITE)["lines"]
        assert _unit_segments(got) == want, f"W={W}: the white layer changed shape"


def test_white_lines_cost_far_fewer_points_than_a_square_per_cell():
    # The layer is 4W-4 closed squares at five points each before the merge.
    # Every shared edge is then drawn once and every straight run collapses to
    # its ends, which costs well under half the naive layer. The bar sits just
    # above what that walk achieves, so a merge that gave back even a twentieth
    # of its own saving turns this red.
    for W in WIDTHS:
        cells = _cells_with_given_ring(W, [])
        before = 5 * len(_ring_cells(W))
        after = _points(_layer(W, cells, WHITE)["lines"])
        assert 20 * after <= 9 * before, (
            f"W={W}: {after} points, want at most {9 * before // 20}"
        )


def test_outlines_box_the_shown_clue_cells_and_nothing_else():
    for W in WIDTHS:
        n = W - 2
        shown = ["T0", "T1", "L0", f"R{n - 1}", f"B{n - 1}"]
        cells = _cells_with_given_ring(W, shown)
        boxes = [ring_cell(k, W) for k in shown]
        want = _unit_segments([_square(c, r, c + 1, r + 1) for r, c in boxes])
        got = _layer(W, cells, OUTLINES)["lines"]
        assert _unit_segments(got) == want, f"W={W}: the boxed cells changed"


def test_outlines_never_box_a_corner():
    # A corner sits on both edges and belongs to no line, so a digit there is
    # never a clue and never gets a box. Fed four corner givens, a layer that
    # boxed givens blindly would draw four boxes here.
    for W in WIDTHS:
        cells = _cells_with_given_ring(W, [])
        got = _layer(W, cells, OUTLINES)["lines"]
        assert _unit_segments(got) == set(), f"W={W}: a corner got boxed"


def test_adjacent_boxed_cells_keep_the_border_between_them():
    # Two neighbouring clue cells each get their own box, so the edge they
    # share is drawn. Merging their outlines into one 1x2 box would erase it.
    W = 11
    shown = ["T3", "T4"]
    cells = _cells_with_given_ring(W, shown)
    boxes = [ring_cell(k, W) for k in shown]
    want = _unit_segments([_square(c, r, c + 1, r + 1) for r, c in boxes])
    got = _layer(W, cells, OUTLINES)["lines"]
    assert _unit_segments(got) == want
    assert ((4, 0), (4, 1)) in _unit_segments(got), "the shared edge went missing"


def test_the_outer_border_is_the_interior_square():
    for W in WIDTHS:
        cells = _cells_with_given_ring(W, [])
        want = _unit_segments([_square(1, 1, W - 1, W - 1)])
        layer = _layer(W, cells, BORDER)
        assert _unit_segments(layer["lines"]) == want, f"W={W}: the border moved"
        # One closed square needs five points, whatever the width: the border
        # has four turns and no other point survives the collapse.
        assert _points(layer["lines"]) == 5, f"W={W}: {_points(layer['lines'])} points"


def _luminance(color):
    """Grey level 0-255 of a `#rrggbbaa` colour, and its alpha."""
    assert re.fullmatch(r"#[0-9a-f]{8}", color), color
    r, g, b, a = (int(color[k : k + 2], 16) for k in (1, 3, 5, 7))
    return (r + g + b) / 3, a


def test_layers_stack_white_then_grey_outlines_then_black_border():
    # What a viewer sees: opaque paint that fades to black, so the ring's own
    # cell borders are hidden, the clue boxes read as soft grey and the
    # interior's border is the heaviest, darkest line.
    W = 11
    layers = cosmetics(W, _cells_with_given_ring(W, ["T3"]))
    assert len(layers) == 3
    assert len({layer["type"] for layer in layers}) == 1, "layers differ in type"
    names = [layer["name"] for layer in layers]
    assert all(names) and len(set(names)) == 3, f"layer names {names}"
    grey = [_luminance(layer["style"]["color"]) for layer in layers]
    assert all(a == 255 for _, a in grey), "a layer is see-through"
    white, outline, border = (g for g, _ in grey)
    assert white == 255 and border == 0, f"white {white}, border {border}"
    assert 0 < outline < 255, f"outline grey {outline} is not between them"
    thick = [layer["style"]["thickness"] for layer in layers]
    assert all(t > 0 for t in thick)
    assert thick[BORDER] == max(thick), "the outer border is not the heaviest line"


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
    test_outlines_never_box_a_corner()
    test_adjacent_boxed_cells_keep_the_border_between_them()
    test_the_outer_border_is_the_interior_square()
    test_layers_stack_white_then_grey_outlines_then_black_border()
    test_no_layer_draws_the_same_segment_twice()
    print("frame self-check OK")
