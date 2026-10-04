# Build a same-board comparison link (docs/real-app-timing.md): a committed
# board with one component's code swapped for a candidate file, and nothing
# else changed. PUZZLE_LINK.txt runs the global lane, so its backend is main-global.js.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from link_swap import swap_main
from manifest import load_manifest

MANIFEST = load_manifest(pathlib.Path(__file__).parent)
CONSTRAINT_NAME = MANIFEST.constraint_name

if __name__ == "__main__":
    swap_main(pathlib.Path(__file__).parent)
