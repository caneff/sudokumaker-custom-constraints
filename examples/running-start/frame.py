# Cosmetic layers for the interactive-outside frame, shared by every size.
#
# The board is (n+2) wide: an n x n sudoku with a one-cell clue ring around it.
# Cell (r, c) covers grid coordinates x in [c, c+1], y in [r, r+1].
#
# Three layers, drawn in this order:
#   White Lines      paint over every ring cell so the ring reads as a margin.
#   Outside Outlines box exactly the given clue cells; not the corner fillers.
#   Grid Outer Border the black square around the interior, drawn on top.


def rect(x, y):
    return [{"x": x, "y": y}, {"x": x + 1, "y": y}, {"x": x + 1, "y": y + 1},
            {"x": x, "y": y + 1}, {"x": x, "y": y}]


def cosmetics(W, cells):
    idx = lambda r, c: r * W + c
    ring_cells = ([(0, c) for c in range(W)] + [(W - 1, c) for c in range(W)]
                  + [(r, 0) for r in range(1, W - 1)] + [(r, W - 1) for r in range(1, W - 1)])
    white = [rect(c, r) for (r, c) in ring_cells]
    # box a given clue cell, but not the corner fillers (a corner sits on both
    # edges and belongs to no line, so its "1" is solver support, not a clue)
    corner = lambda r, c: r in (0, W - 1) and c in (0, W - 1)
    outlines = [rect(c, r) for (r, c) in ring_cells
                if cells[idx(r, c)].get("given") and not corner(r, c)]
    border = [[{"x": x, "y": 1} for x in range(1, W)]
              + [{"x": W - 1, "y": y} for y in range(2, W)]
              + [{"x": x, "y": W - 1} for x in range(W - 2, 0, -1)]
              + [{"x": 1, "y": y} for y in range(W - 2, 0, -1)]]
    return [
        {"name": "White Lines (to hide outside cell borders)", "type": 2000,
         "lines": white, "style": {"thickness": 0.05, "color": "#ffffffff"}},
        {"name": "Outside Cell Outlines", "type": 2000,
         "lines": outlines, "style": {"thickness": 0.03, "color": "#d7d7d7ff"}},
        {"name": "Grid Outer Border", "type": 2000,
         "lines": border, "style": {"thickness": 0.07, "color": "#000000ff"}},
    ]
