# Rebuild an already-generated puzzle with ChinStrap's ORIGINAL wrapper code
# instead of the improved components, so the two can be compared on the same
# grid, givens, and clues. No solving: it reuses gen_<n>.json and re-encodes.
#
#   uv run --with ortools --with lzstring examples/skyscraper/build_original.py 9
#
# Writes PUZZLE_LINK_<n>x<n>_original.txt next to this script and checks that the
# only difference from PUZZLE_LINK_<n>x<n>.txt is the custom constraint's code.

import copy
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
import build_size
import link_codec
from framebuild import build_doc, make_lines
from minify import minify_js

HERE = pathlib.Path(__file__).parent
ORIG = HERE / "original"


def load_gen(n):
    g = json.loads((HERE / f"gen_{n}.json").read_text())
    bh, bw = g["box"]
    grid = g["grid"]
    lines = make_lines(n)
    clue = {(k[0], int(k[1:])): v for k, v in g["clue"].items()}
    active = {(k[0], int(k[1:])) for k in g["active"]}
    givens = {
        (int(r), int(c)): v for k, v in g["givens"].items() for r, c in [k.split(",")]
    }
    return bh, bw, grid, clue, givens, active, lines


def swap_to_original(doc):
    doc = copy.deepcopy(doc)
    sk = next(
        c
        for c in doc["puzzle"]["constraints"]
        if c.get("definition", {}).get("name") == "Skyscraper Lines"
    )
    sk["definition"]["backend"]["code"] = minify_js((ORIG / "main.js").read_text())
    sk["definition"]["components"] = [
        {
            "type": "code",
            "name": "CustomSkyscraperLineComponent",
            "code": minify_js((ORIG / "CustomSkyscraperLineComponent.js").read_text()),
        }
    ]
    return doc


def constraint_code(doc):
    sk = next(
        c
        for c in doc["puzzle"]["constraints"]
        if c.get("definition", {}).get("name") == "Skyscraper Lines"
    )
    return {
        "backend": sk["definition"]["backend"]["code"],
        "components": sk["definition"]["components"],
    }


def blanked(doc):
    # doc with the Skyscraper Lines code fields emptied, for an apples-to-apples diff
    d = copy.deepcopy(doc)
    sk = next(
        c
        for c in d["puzzle"]["constraints"]
        if c.get("definition", {}).get("name") == "Skyscraper Lines"
    )
    sk["definition"]["backend"]["code"] = ""
    sk["definition"]["components"] = []
    return d


if __name__ == "__main__":
    n = int(sys.argv[1])
    bh, bw, grid, clue, givens, active, lines = load_gen(n)
    improved = build_doc(build_size.SPEC, n, bh, bw, grid, clue, givens, active, lines)
    original = swap_to_original(improved)

    # the two puzzles must be identical everywhere except the constraint code
    assert blanked(improved) == blanked(original), (
        "frames differ beyond the constraint code"
    )
    assert constraint_code(improved) != constraint_code(original), (
        "code was not swapped"
    )
    assert original["puzzle"]["cells"] == improved["puzzle"]["cells"], "cells differ"

    link = link_codec.encode_link(original)
    back = link_codec.decode_puzzle(link)
    assert back == original, "link does not decode back to the built document"

    (HERE / f"PUZZLE_LINK_{n}x{n}_original.txt").write_text(link + "\n")
    print(
        f"wrote PUZZLE_LINK_{n}x{n}_original.txt ({len(link)} chars) "
        f"— same puzzle as PUZZLE_LINK_{n}x{n}.txt, original wrapper code"
    )
