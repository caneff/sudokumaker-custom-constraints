# The fillomino board: a houseless n x n built by _shared/bareboard.py from
# gen.json, main.js and FillominoComponent.js -- the isofill shape. Digits run
# 1..side unless the puzzle spec has a `cap` key, which ships an explicit
# minDigit/maxDigit (1..cap) so a region can run past the board side (#293).
#
#   uv run examples/fillomino/build_link.py [--puzzle FILE] [--out FILE]
#   uv run examples/fillomino/build_link.py --component FILE --out FILE [--board LINK]
#
# No --component rebuilds PUZZLE_LINK.txt (or --out) from --puzzle; --component
# swaps a candidate into PUZZLE_LINK.txt or --board, which `just time --board`
# needs.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from bareboard import BareBoard

CONSTRAINT_NAME = "Fillomino"
TIMED_COMPONENT = "FillominoComponent"
# Fillomino is not sudoku, so the rules text carries no RULES_PREFIX -- the
# same exception isofill takes (docs/example-layout.md, #271, #305).
RULE = (
    "Fillomino: Place a digit from 1-{hi} in every cell. Orthogonally "
    "connected cells with the same digit are regions; the number of cells in "
    "a region has to equal its digit. Two regions of the same size may not "
    "touch orthogonally."
)


def digit_range(spec, n):
    cap = spec.get("cap")
    if cap is None:
        return 1, n, {}
    return 1, cap, {"minDigit": 1, "maxDigit": cap}


BOARD = BareBoard(
    pathlib.Path(__file__).parent, CONSTRAINT_NAME, TIMED_COMPONENT, RULE, digit_range
)
build, check = BOARD.build, BOARD.check

if __name__ == "__main__":
    BOARD.main()
