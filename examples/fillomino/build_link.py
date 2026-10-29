#   uv run examples/fillomino/build_link.py [--puzzle FILE] [--out FILE]
#   uv run examples/fillomino/build_link.py --component FILE --out FILE [--board LINK]

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from bareboard import BareBoard
from manifest import load_manifest

MANIFEST = load_manifest(pathlib.Path(__file__).parent)
CONSTRAINT_NAME = MANIFEST.constraint_name
TIMED_COMPONENT = MANIFEST.timed_component
# Fillomino is not sudoku, so the rules text carries no RULES_PREFIX.
RULE = (
    "Fillomino: Place a digit from 1-{hi} in every cell. Orthogonally "
    "connected cells with the same digit are regions; the number of cells in "
    "a region has to equal its digit. Two regions of the same size may not "
    "touch orthogonally."
)


def digit_range(spec, n):
    """No cap means the longer side, as in generate.Board.of; `n` is the width.
    A board that is not square ships its range, so the app offers the digits
    the rules text names and the proof ran on. A square board with no cap
    ships none and the app offers its default 1-9, which is the shipped 9x9's
    range."""
    cap = spec.get("cap")
    height = len(spec["grid"])
    if cap is None and n == height:
        return 1, n, {}
    hi = max(n, height) if cap is None else cap
    return 1, hi, {"minDigit": 1, "maxDigit": hi}


BOARD = BareBoard(
    pathlib.Path(__file__).parent, CONSTRAINT_NAME, TIMED_COMPONENT, RULE, digit_range
)
build, check = BOARD.build, BOARD.check

if __name__ == "__main__":
    BOARD.main()
