# A plain 9x9 sudoku grid string in, a SudokuMaker puzzle link out: a custom
# 9x9 whose boxes are a region constraint and whose rows and columns are the
# shared whole-grid backend (grid-rowcol.js), no other rule. The board shape is
# docs/research/406-gac-demo/tools/build_hard.py's hard classic; that builder
# carries its own row/column backend (rowcol9-main.js) instead.
#
#   uv run examples/_shared/grid_to_link.py <grid_string> [<link_file>]

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from framebuild import NO_RING_RULES_PREFIX
from no_ring import grid_backend_constraint
from sudoku_kit.link_codec import encode_link

N = 9
BOX = 3
BLANKS = ".0"


def check_grid(grid):
    """`grid` as a plain 81-character string, blanks `.` or `0`. Raises
    ValueError on any other length or character."""
    if len(grid) != N * N:
        raise ValueError(f"a grid is {N * N} characters, got {len(grid)}")
    bad = sorted({ch for ch in grid if ch not in BLANKS + "123456789"})
    if bad:
        raise ValueError(f"a grid holds digits and . or 0, got {bad}")
    return grid


def grid_to_doc(grid):
    """The puzzle document for `grid`: its non-blank characters are givens."""
    check_grid(grid)
    cells = [{} if ch in BLANKS else {"given": True, "value": int(ch)} for ch in grid]
    regions = [(r // BOX) * BOX + c // BOX for r in range(N) for c in range(N)]
    return {
        "formatVersion": "1.6.0",
        "puzzle": {
            "name": "Hard classic",
            "author": "",
            "comment": NO_RING_RULES_PREFIX.strip(),
            "type": "custom",
            "width": N,
            "height": N,
            "cells": cells,
            "constraints": [
                {"type": 1, "regions": regions},
                grid_backend_constraint(),
                {"type": 0},
            ],
            "export": {"sudokuPad": {"useIncompleteGridAsSolution": True}},
        },
    }


def grid_to_link(grid):
    """The SudokuMaker link for `grid`."""
    return encode_link(grid_to_doc(grid))


if __name__ == "__main__":
    if len(sys.argv) not in (2, 3):
        sys.exit("usage: grid_to_link.py <grid_string> [<link_file>]")
    link = grid_to_link(sys.argv[1])
    if len(sys.argv) > 2:
        pathlib.Path(sys.argv[2]).write_text(link + "\n")
    else:
        print(f"{len(link)} chars; pass a link_file to write it", file=sys.stderr)
