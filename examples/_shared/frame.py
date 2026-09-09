# Cosmetic layers for the interactive-outside frame, shared by every size.
#
# The board is (n+2) wide: an n x n sudoku with a one-cell clue ring around it.
# Cell (r, c) covers grid coordinates x in [c, c+1], y in [r, r+1].
#
# Three layers, drawn in this order:
#   White Lines      paint over every ring cell so the ring reads as a margin.
#   Outside Outlines box exactly the given clue cells; not the corner fillers.
#   Grid Outer Border the black square around the interior, drawn on top.

import itertools

# A ring key names one clue cell of the frame: "T3"/"B3" sit above/below
# interior column 3, "L2"/"R2" left/right of interior row 2.
SIDES = {
    "L": lambda i, W: (i + 1, 0),
    "R": lambda i, W: (i + 1, W - 1),
    "T": lambda i, W: (0, i + 1),
    "B": lambda i, W: (W - 1, i + 1),
}


def ring_cell(key, W):
    """The frame (row, column) of a ring key's clue cell, on a W-wide board."""
    return SIDES[key[0]](int(key[1:]), W)


def rect(x, y):
    return [
        {"x": x, "y": y},
        {"x": x + 1, "y": y},
        {"x": x + 1, "y": y + 1},
        {"x": x, "y": y + 1},
        {"x": x, "y": y},
    ]


# ---- drawing the same picture with fewer points ---------------------------
#
# A layer built a cell at a time draws each shared edge twice and spends five
# points on every unit square, and the link carries every one of those points
# as JSON. `merge` re-draws the same ink: it reduces a layer to the set of unit
# segments it covers, then walks that set back out as long polylines. What a
# viewer sees is the union of the segments, so redrawing that union any other
# way is invisible on screen -- which is what makes this free. It cuts the three
# layers to well under half their points; the measured sizes are in
# docs/research/skyscraper-builtin-constraint-baseline.md (#385).


class UndescribableInk(ValueError):
    """`segments` was handed a step it cannot name: one that leaves the
    integer lattice, runs off the axes, or covers no ground at all. Ink like
    that is drawable and legal in a link -- SudokuMaker takes any points it is
    given -- it is only this file's segment vocabulary that has no word for
    it. A caller that merely wants to compare two layers should catch this and
    fall back to comparing them as authored; `merge` lets it out, because
    redrawing ink it cannot name would change the picture."""


def segments(lines):
    """The set of unit segments a list of polylines covers -- the ink it lays
    on the page, with no trace of how the polylines carried it. Every point
    this file draws is on the integer lattice and every step is axis-aligned,
    so a segment is named by its two endpoints, lower one first. A step that
    is neither raises `UndescribableInk`."""
    segs = set()
    for pts in lines:
        for a, b in itertools.pairwise(pts):
            a, b = (a["x"], a["y"]), (b["x"], b["y"])
            if not all(isinstance(v, int) and not isinstance(v, bool) for v in a + b):
                raise UndescribableInk(f"off the integer lattice: {a} -> {b}")
            if (a[0] == b[0]) == (a[1] == b[1]):
                raise UndescribableInk(f"not a one-axis run: {a} -> {b}")
            axis = 1 if a[0] == b[0] else 0
            lo, hi = sorted((a[axis], b[axis]))
            for k in range(lo, hi):
                p = (a[0], k) if axis else (k, a[1])
                q = (a[0], k + 1) if axis else (k + 1, a[1])
                segs.add((p, q))
    return segs


def _step_on(v, prev, choices):
    """The next vertex of a trail at `v`, having arrived from `prev`. Carrying
    straight on where the ink does keeps a long run in one polyline, so the
    collinear points inside it collapse away; `min` breaks every other tie so
    a rebuild of a committed link is byte-identical."""
    if prev is not None:
        ahead = (2 * v[0] - prev[0], 2 * v[1] - prev[1])
        if ahead in choices:
            return ahead
    return min(choices)


def _trails(segs):
    """Walk `segs` into polylines, each segment used exactly once.

    Open runs come out first, started from a vertex where an odd number of
    segments meet -- such a vertex has to be an end of some polyline, and
    starting anywhere else would cut a run in half. What is left over meets
    evenly everywhere and closes back on itself.

    Where the walk starts decides the point lists, not just their length: move
    it and every committed link re-encodes with the same ink and the same point
    count, but different bytes. One example pins that down:
    `test_rebuild_reproduces_every_shipped_link_byte_for_byte`
    (examples/outside-sudoku/build_size.test.py) rebuilds outside-sudoku's four
    links and demands the exact committed bytes. No other example's links are
    pinned that way -- their rebuild guards compare ink
    (`link_swap.frame_and_comment_only`), which a moved start vertex passes.
    """
    adj = {}
    for a, b in segs:
        adj.setdefault(a, set()).add(b)
        adj.setdefault(b, set()).add(a)
    trails = []
    while True:
        live = sorted(v for v, nbrs in adj.items() if nbrs)
        if not live:
            return trails
        odd = [v for v in live if len(adj[v]) % 2]
        v, prev = (odd[0] if odd else live[0]), None
        trail = [v]
        while adj[v]:
            nxt = _step_on(v, prev, adj[v])
            adj[v].discard(nxt)
            adj[nxt].discard(v)
            trail.append(nxt)
            prev, v = v, nxt
        trails.append(trail)


def _drop_straight_through(trail):
    """The same trail with every point that is not a turn removed. Steps are
    axis-aligned units, so a point turns exactly when its two neighbours share
    neither coordinate; the trail's own two ends are kept whatever they are."""
    turns = [
        trail[i]
        for i in range(1, len(trail) - 1)
        if trail[i - 1][0] != trail[i + 1][0] and trail[i - 1][1] != trail[i + 1][1]
    ]
    return [trail[0], *turns, trail[-1]]


def merge(lines):
    """`lines` redrawn with fewer points and the same ink on the page."""
    return [
        [{"x": x, "y": y} for x, y in _drop_straight_through(trail)]
        for trail in _trails(segments(lines))
    ]


def cosmetics(W, cells):
    idx = lambda r, c: r * W + c
    ring_cells = (
        [(0, c) for c in range(W)]
        + [(W - 1, c) for c in range(W)]
        + [(r, 0) for r in range(1, W - 1)]
        + [(r, W - 1) for r in range(1, W - 1)]
    )
    white = [rect(c, r) for (r, c) in ring_cells]
    # box a given clue cell, but not the corner fillers (a corner sits on both
    # edges and belongs to no line, so its "1" is solver support, not a clue)
    corner = lambda r, c: r in (0, W - 1) and c in (0, W - 1)
    outlines = [
        rect(c, r)
        for (r, c) in ring_cells
        if cells[idx(r, c)].get("given") and not corner(r, c)
    ]
    border = [
        [{"x": x, "y": 1} for x in range(1, W)]
        + [{"x": W - 1, "y": y} for y in range(2, W)]
        + [{"x": x, "y": W - 1} for x in range(W - 2, 0, -1)]
        + [{"x": 1, "y": y} for y in range(W - 2, 0, -1)]
    ]
    return [
        {
            "name": "White Lines (to hide outside cell borders)",
            "type": 2000,
            "lines": merge(white),
            "style": {"thickness": 0.05, "color": "#ffffffff"},
        },
        {
            "name": "Outside Cell Outlines",
            "type": 2000,
            "lines": merge(outlines),
            "style": {"thickness": 0.03, "color": "#d7d7d7ff"},
        },
        {
            "name": "Grid Outer Border",
            "type": 2000,
            "lines": merge(border),
            "style": {"thickness": 0.07, "color": "#000000ff"},
        },
    ]
