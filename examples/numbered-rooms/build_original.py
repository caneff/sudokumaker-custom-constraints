# Rebuild the shipped Numbered Rooms puzzle (PUZZLE_LINK.txt) with ChinStrap's
# ORIGINAL wrapper code instead of the improved components, so the two can be
# timed on the same grid, givens, and clues. Only the constraint code differs.
#
#   uv run --with lzstring examples/numbered-rooms/build_original.py
#
# Writes PUZZLE_LINK_original.txt next to this script and checks that the only
# difference from PUZZLE_LINK.txt is the "Custom Numbered Rooms" constraint code.
# PUZZLE_LINK.txt is the source of truth; this mirrors skyscraper/build_original.py.
# The original wrapper renames its component and swaps the backend too, so it
# uses replace_constraint_code directly rather than build_link.py's
# same-name-only --component contract.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from link_codec import decode_puzzle
from link_swap import check_and_write, replace_constraint_code
from minify import minify_js

HERE = pathlib.Path(__file__).parent
CONSTRAINT_NAME = "Custom Numbered Rooms"

if __name__ == "__main__":
    ours = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())

    backend_code = minify_js((HERE / "original" / "main.js").read_text())
    component_code = minify_js(
        (HERE / "original" / "CustomIndexComponent.js").read_text()
    )
    assert backend_code and component_code, "original code empty"

    original = replace_constraint_code(
        ours,
        CONSTRAINT_NAME,
        backend_code=backend_code,
        components=[
            {"type": "code", "name": "CustomIndexComponent", "code": component_code}
        ],
    )

    link = check_and_write(
        ours, original, CONSTRAINT_NAME, HERE / "PUZZLE_LINK_original.txt"
    )
    print(f"wrote PUZZLE_LINK_original.txt ({len(link)} chars)")
