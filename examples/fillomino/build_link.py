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
