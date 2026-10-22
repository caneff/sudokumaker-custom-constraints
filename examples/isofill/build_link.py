#   uv run examples/isofill/build_link.py [--puzzle gen_44g.json] [--out FILE]
#   uv run examples/isofill/build_link.py --component FILE --out FILE [--board LINK]
#
# No --component rebuilds PUZZLE_LINK.txt (or --out) from --puzzle; --component
# swaps a candidate into PUZZLE_LINK.txt or --board, the way `just time isofill
# --board PUZZLE_LINK_30g.txt` times a fixture other than the default board.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from bareboard import BareBoard
from manifest import load_manifest

MANIFEST = load_manifest(pathlib.Path(__file__).parent)
CONSTRAINT_NAME = MANIFEST.constraint_name
TIMED_COMPONENT = MANIFEST.timed_component
RULE = (
    "ISOFILL: Divide the grid into {count} regions, each with {size} orthogonally "
    "connected cells. Every cell in a region should contain the same digit. "
    "All of the digits {lo}-{hi} must appear in the grid."
)


def digit_range(spec, n):
    """`n` is the width; a gen JSON names `digits` when the digit count is not
    the width (a rectangle). The app's top digit is 9, so a range ending below
    it ships `maxDigit`."""
    lo = spec.get("minDigit", 0)
    hi = lo + spec.get("digits", n) - 1
    return lo, hi, {"minDigit": lo, **({"maxDigit": hi} if hi != 9 else {})}


BOARD = BareBoard(
    pathlib.Path(__file__).parent, CONSTRAINT_NAME, TIMED_COMPONENT, RULE, digit_range
)
build, check = BOARD.build, BOARD.check

if __name__ == "__main__":
    BOARD.main()
