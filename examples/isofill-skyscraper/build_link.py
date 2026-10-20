# Build a same-board comparison link (docs/real-app-timing.md): the committed
# board with one component's code swapped for a candidate file, and nothing
# else changed. The board itself is build_size.py's.
#
#   uv run examples/isofill-skyscraper/build_link.py --component FILE --out FILE [--board LINK]

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from link_swap import swap_main

if __name__ == "__main__":
    swap_main(pathlib.Path(__file__).parent)
