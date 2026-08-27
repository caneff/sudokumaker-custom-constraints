# Build the SudokuMaker puzzle link for the ISOFILL example from source.
#
# There is no template: a custom 10x10 board with no houses is small enough to
# build from scratch (the board fields come from the scaffold check in #50).
# The grid and clue set come from puzzle.json; the code comes from main.js and
# IsofillComponent.js, so a component fix flows into the link on the next run.
#
#   uv run --with lzstring examples/isofill/build_link.py
#   uv run --with lzstring examples/isofill/build_link.py \
#       --component /path/IsofillComponent.js --out /tmp/candidate.txt
#
# Writes PUZZLE_LINK.txt next to this script; --component / --out swap in a
# candidate component file and write elsewhere; --puzzle builds another
# instance, e.g. puzzle-44.json.

import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from link_codec import decode_puzzle, encode_link
from minify import minify_js

HERE = pathlib.Path(__file__).parent
N = 10
RULE = (
    "ISOFILL: Divide the grid into 10 regions, each with 10 orthogonally "
    "connected cells. Every cell in a region should contain the same digit. "
    "All of the digits 0-9 must appear in the grid."
)


def build(component_path, puzzle_path):
    spec = json.loads(pathlib.Path(puzzle_path).read_text())
    clues = {tuple(p) for p in spec["clues"]}
<<<<<<< HEAD
    # a cell holds a value only when it is a clue: a non-given value ships as an
    # entered digit and the recipient opens a solved board
    cells = [
        {"value": int(spec["grid"][r][c]), "given": True} if (r, c) in clues else {}
        for r in range(N)
        for c in range(N)
    ]
=======
    cells = []
    for r in range(N):
        for c in range(N):
            # a cell holds a value only when it is a given; anything else
            # ships as an entered digit and the recipient opens a solved board
            cell = {"value": int(spec["grid"][r][c]), "given": True} if (r, c) in clues else {}
            cells.append(cell)
>>>>>>> 6539b7c (isofill: link stores values only in given cells — 65 empty cells, not 65 entered digits)
    doc = {
        "formatVersion": "1.6.0",
        "puzzle": {
            "name": "ISOFILL",
            "author": "",
            "type": "custom",
            "width": N,
            "height": N,
            "minDigit": 0,
            "comment": RULE,
            "cells": cells,
            "constraints": [
                {
                    "name": "ISOFILL",
                    "type": 1000,
                    "definition": {
                        "name": "ISOFILL",
                        "input": [],
                        "backend": {
                            "type": "code",
                            "code": minify_js((HERE / "main.js").read_text()),
                        },
                        "components": [
                            {
                                "type": "code",
                                "name": "IsofillComponent",
                                "code": minify_js(
                                    pathlib.Path(component_path).read_text()
                                ),
                            }
                        ],
                    },
                    "input": {},
                    "style": {},
                }
            ],
        },
    }
    return encode_link(doc), doc, len(clues)


def check(link, doc, n_clues):
    back = decode_puzzle(link)
    assert back == doc, "link does not decode back to the built document"
    p = back["puzzle"]
    assert (p["type"], p["width"], p["height"], p["minDigit"]) == ("custom", N, N, 0)
    assert len(p["cells"]) == N * N and not any("houses" in k for k in p)
    assert sum(1 for c in p["cells"] if c.get("given")) == n_clues
    d = p["constraints"][0]["definition"]
    assert d["input"] == [], "a global constraint has no groups"
    assert [c["name"] for c in d["components"]] == ["IsofillComponent"]


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--component", default=HERE / "IsofillComponent.js")
    p.add_argument("--out", default=HERE / "PUZZLE_LINK.txt")
    p.add_argument("--puzzle", default=HERE / "puzzle.json")
    args = p.parse_args()
    link, doc, n_clues = build(args.component, args.puzzle)
    check(link, doc, n_clues)
    pathlib.Path(args.out).write_text(link + "\n")
    print(f"wrote {args.out} ({len(link)} chars, {n_clues} givens)")
