# Build a same-board comparison link for `just time` (docs/real-app-timing.md):
# the committed PUZZLE_LINK.txt, or --board, with UpToNComponent's code swapped
# for a candidate file and nothing else changed. The rule's Python half and the
# board builder are build_size.py's.
#
#   uv run examples/up-to-n/build_link.py --component FILE --out FILE [--board LINK]

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from link_swap import swap_main

TIMED_COMPONENT = "UpToNComponent"

if __name__ == "__main__":
    swap_main(pathlib.Path(__file__).parent)
