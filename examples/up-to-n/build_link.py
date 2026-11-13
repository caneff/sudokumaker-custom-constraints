# Build a same-board comparison link for `just time` (docs/real-app-timing.md):
# the committed PUZZLE_LINK.txt, or --board, with UpToNComponent's code swapped
# for a candidate file and nothing else changed.
#
#   uv run examples/up-to-n/build_link.py --component FILE --out FILE [--board LINK]
#   uv run examples/up-to-n/build_link.py --refresh
#
# --refresh re-encodes every committed board against the tree, no search
# (lanes.rebuild_all).

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from build_size import SPEC
from lanes import link_main

if __name__ == "__main__":
    link_main(SPEC)
