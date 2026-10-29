"""Read a committed puzzle link back into the clue set the offline scorer
reads.

A link records which cells are GIVEN and what digit each given holds -- not
the solution grid, which the share checklist keeps out of the blob. That is
all the scorer needs: it solves from the givens.

    uv run --with lzstring examples/fillomino/hunt_link.py \
        examples/fillomino/timing-fixture-9x9-cap12-seed10-rung25.txt

Prints {"width": w, "height": h, "cap": d, "givens": {"<cell index>": digit, ...}}, cell
index row-major, the same numbering main.js registers.
"""

import json
import pathlib
import sys

from sudoku_kit.link_codec import decode_puzzle


def clues(link_text):
    p = decode_puzzle(link_text.strip())["puzzle"]
    width, height = p["width"], p["height"]
    return {
        "width": width,
        "height": height,
        "cap": p.get("maxDigit", max(width, height)),
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
