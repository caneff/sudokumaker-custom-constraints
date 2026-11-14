# Build a same-board comparison link (docs/real-app-timing.md): a committed
# board with one component's code swapped for a candidate file, and nothing
# else changed. PUZZLE_LINK.txt runs the global lane, so its backend is main-global.js.
#
# `--refresh` re-encodes the four boards against the tree
# (`build_size.py --rebuild`), then rebuilds their `_clued` twins from them.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
import build_clued
from build_size import SPEC
from lanes import link_main
from manifest import load_manifest

HERE = pathlib.Path(__file__).parent
MANIFEST = load_manifest(HERE)
CONSTRAINT_NAME = MANIFEST.constraint_name


if __name__ == "__main__":
    # The twins come last: a twin is its board's clues filled, so one built
    # before the board is re-encoded would carry the old embedded code.
    link_main(SPEC, build_clued.build)
