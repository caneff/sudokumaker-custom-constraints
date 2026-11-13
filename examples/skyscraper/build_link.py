# Build a same-board comparison link (docs/real-app-timing.md): a committed
# board with one component's code swapped for a candidate file, and nothing
# else changed. PUZZLE_LINK_6x6.txt and the local boards are reached with --board.
#
#   uv run examples/skyscraper/build_link.py --component FILE --out FILE [--board LINK]
#   uv run examples/skyscraper/build_link.py --refresh
#
# --refresh re-encodes every committed board against the tree, no search
# (lanes.rebuild_all).

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from build_size import SPEC
from lanes import rebuild_all
from link_swap import swap_main

if __name__ == "__main__":
    swap_main(pathlib.Path(__file__).parent, refresh=lambda *_: rebuild_all(SPEC))
