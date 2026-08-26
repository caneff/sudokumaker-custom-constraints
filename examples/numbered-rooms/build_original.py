# Rebuild the shipped Numbered Rooms puzzle (PUZZLE_LINK.txt) with ChinStrap's
# ORIGINAL wrapper code instead of the improved components, so the two can be
# timed on the same grid, givens, and clues. Only the constraint code differs.
#
#   uv run --with lzstring examples/numbered-rooms/build_original.py
#
# Writes PUZZLE_LINK_original.txt next to this script and checks that the only
# difference from PUZZLE_LINK.txt is the "Custom Numbered Rooms" constraint code.
# PUZZLE_LINK.txt is the source of truth; this mirrors skyscraper/build_original.py.

import copy
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from link_codec import decode_puzzle, encode_link
from minify import minify_js

HERE = pathlib.Path(__file__).parent
NAME = "Custom Numbered Rooms"


def nr_constraint(doc):
    return next(
        c
        for c in doc["puzzle"]["constraints"]
        if c.get("definition", {}).get("name") == NAME
    )


def swap_to_original(doc):
    doc = copy.deepcopy(doc)
    d = nr_constraint(doc)["definition"]
    d["backend"]["code"] = minify_js((HERE / "ORIGINAL_backend.js").read_text())
    d["components"] = [
        {
            "type": "code",
            "name": "CustomIndexComponent",
            "code": minify_js((HERE / "ORIGINAL_CustomIndexComponent.js").read_text()),
        }
    ]
    return doc


def blanked(doc):
    # doc with the constraint code fields emptied, for an apples-to-apples diff
    d = copy.deepcopy(doc)
    defn = nr_constraint(d)["definition"]
    defn["backend"]["code"] = ""
    defn["components"] = []
    return d


if __name__ == "__main__":
    ours = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
    original = swap_to_original(ours)

    assert blanked(ours) == blanked(original), (
        "frames differ beyond the constraint code"
    )
    assert nr_constraint(original)["definition"]["backend"]["code"], (
        "original code empty"
    )

    link = encode_link(original)
    assert decode_puzzle(link) == original, "link does not round-trip"
    (HERE / "PUZZLE_LINK_original.txt").write_text(link)
    print(f"wrote PUZZLE_LINK_original.txt ({len(json.dumps(original))} bytes of doc)")
