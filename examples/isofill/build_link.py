# The ISOFILL board: a houseless n x n built by _shared/bareboard.py from
# gen.json, main.js and IsofillComponent.js. The side comes from the grid's row
# count and the lowest digit from the optional "minDigit" key (default 0):
# 10x10 with 0-9, or 9x9 with 1-9.
#
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

CONSTRAINT_NAME = "ISOFILL"
TIMED_COMPONENT = "IsofillComponent"
RULE = (
    "ISOFILL: Divide the grid into {n} regions, each with {n} orthogonally "
    "connected cells. Every cell in a region should contain the same digit. "
    "All of the digits {lo}-{hi} must appear in the grid."
)


def digit_range(spec, n):
    lo = spec.get("minDigit", 0)
    return lo, lo + n - 1, {"minDigit": lo}


BOARD = BareBoard(
    pathlib.Path(__file__).parent, CONSTRAINT_NAME, TIMED_COMPONENT, RULE, digit_range
)
build, check = BOARD.build, BOARD.check

if __name__ == "__main__":
    BOARD.main()
