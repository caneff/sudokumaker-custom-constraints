"""Read a committed puzzle link back into the clue set the offline scorer
reads (#317).

A link records which cells are GIVEN and what digit each given holds -- not
the solution grid, which the share checklist keeps out of the blob. That is
all the scorer needs: it solves from the givens.

    uv run --with lzstring examples/fillomino/hunt_link.py \
        examples/fillomino/timing-fixture-9x9-cap12-seed10-rung25.txt

Prints {"side": n, "cap": d, "givens": {"<cell index>": digit, ...}}, cell
index row-major, the same numbering main.js registers.
"""

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from link_codec import decode_puzzle


def clues(link_text):
    """The {"side", "cap", "givens"} board a link describes."""
    p = decode_puzzle(link_text.strip())["puzzle"]
    side = p["width"]
    return {
        "side": side,
        "cap": p.get("maxDigit", side),
        "givens": {
            str(i): int(cell["value"])
            for i, cell in enumerate(p["cells"])
            if cell.get("given")
        },
    }


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(f"usage: {sys.argv[0]} <link_file>")
    print(json.dumps(clues(pathlib.Path(sys.argv[1]).read_text())))
