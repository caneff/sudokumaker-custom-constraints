# Build a same-board comparison link (docs/real-app-timing.md): a committed
# board with one component's code swapped for a candidate file, and nothing
# else changed. PUZZLE_LINK_6x6.txt and the local boards are reached with --board.
#
#   uv run examples/skyscraper/build_link.py --component FILE --out FILE [--board LINK]

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from link_swap import swap_main

if __name__ == "__main__":
    swap_main(pathlib.Path(__file__).parent)
