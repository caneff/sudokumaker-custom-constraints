"""The grid-drawing base's public function: image size, sampled pixels (#490).

uv run finders/hunt/test_render.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from render import GridCanvas

ok = True


def check(name, cond):
    global ok
    status = "ok" if cond else "FAIL"
    if not cond:
        ok = False
    print(f"{status}: {name}")


# --- image size, for a given grid size and cell size ---

canvas = GridCanvas(4, 4, cell=20, margin=10)
check(
    "a 4x4 board at cell=20, margin=10 is 100x100",
    canvas.image.size == (100, 100),
)

canvas_rect = GridCanvas(3, 5, cell=10, margin=4)
check(
    "a non-square (3 rows, 5 cols) board sizes width and height independently",
    canvas_rect.image.size == (5 * 10 + 2 * 4, 3 * 10 + 2 * 4),
)

canvas_default_bg = GridCanvas(2, 2, cell=10, margin=0)
check(
    "an undrawn cell is white by default",
    canvas_default_bg.image.getpixel((5, 5)) == (255, 255, 255),
)

# --- shaded and plain cells, sampled at the cell's own centre pixel ---

canvas_shaded = GridCanvas(3, 3, cell=30, margin=0, background="white")
canvas_shaded.shade_cell(1, 1, (200, 0, 0))
check(
    "a shaded cell's centre pixel is that colour",
    canvas_shaded.image.getpixel((45, 45)) == (200, 0, 0),
)
check(
    "an untouched cell's centre pixel is still the background colour",
    canvas_shaded.image.getpixel((15, 15)) == (255, 255, 255),
)

canvas_row_col = GridCanvas(2, 4, cell=10, margin=5, background="white")
canvas_row_col.shade_cell(1, 3, (0, 150, 0))
# Row 1, col 3 centre: margin + col*cell + cell/2, margin + row*cell + cell/2
check(
    "shade_cell targets (row, col), not (col, row)",
    canvas_row_col.image.getpixel((5 + 3 * 10 + 5, 5 + 1 * 10 + 5)) == (0, 150, 0),
)

# --- box_lines: thick on box boundaries, thin elsewhere, sampled by pixel ---

canvas_lines = GridCanvas(4, 4, cell=20, margin=0, background="white")
canvas_lines.box_lines(box_rows=2, box_cols=2, thin=1, thick=5, color="black")
# The horizontal line at y=0 (a box boundary, i=0) is thick -> pixel at
# (10, 2) (3rd row down from a 1px-thin line) is still on the thick line.
check(
    "a box-boundary line is thick enough to cover a pixel a thin line would miss",
    canvas_lines.image.getpixel((10, 2)) == (0, 0, 0),
)
# The vertical line at x=20 (i=1, not a box multiple of 2) is thin -> a
# pixel 2px away from it is background, not line.
check(
    "a non-boundary line is thin: a pixel just past it is background",
    canvas_lines.image.getpixel((22, 10)) == (255, 255, 255),
)

sys.exit(0 if ok else 1)
