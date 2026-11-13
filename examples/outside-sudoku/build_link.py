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
from lanes import rebuild_all
from link_swap import swap_main
from manifest import load_manifest

HERE = pathlib.Path(__file__).parent
MANIFEST = load_manifest(HERE)
CONSTRAINT_NAME = MANIFEST.constraint_name


def refresh(_args, _parser):
    """Re-encode every board from its recorded seed, then its twin from it.

    The twins come last: a twin is its board's clues filled, so one built
    before the board is re-encoded would carry the old embedded code."""
    rebuild_all(SPEC)
    build_clued.build()
    print("refreshed the four boards and the four _clued twins built from them")


if __name__ == "__main__":
    swap_main(HERE, refresh=refresh)
