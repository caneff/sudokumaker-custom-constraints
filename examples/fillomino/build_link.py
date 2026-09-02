# Build the SudokuMaker puzzle link for the fillomino example from source.
#
# A custom square board with no houses, built from scratch -- the isofill
# shape. The side comes from the grid's row count; digits run 1..side, so a
# 6x6 board plays digits 1-6. The grid and clue set come from gen.json; the
# code comes from main.js and FillominoComponent.js, so a component fix flows
# into the link on the next run.
#
#   uv run --with lzstring examples/fillomino/build_link.py
#   uv run --with lzstring examples/fillomino/build_link.py \
#       --component /path/FillominoComponent.js --out /tmp/candidate.txt
#
# Writes PUZZLE_LINK.txt next to this script; --component / --out swap in a
# candidate component file and write elsewhere; --board names a committed link
# to swap the component into, which is what `just time --board` needs.

import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from link_codec import decode_puzzle, encode_link
from link_swap import check_and_write, swap_component_code
from minify import minify_js

HERE = pathlib.Path(__file__).parent
CONSTRAINT_NAME = "Fillomino"
TIMED_COMPONENT = "FillominoComponent"
# Fillomino is not sudoku, so the rules text carries no RULES_PREFIX -- the
# same exception isofill takes (docs/example-layout.md, #271, #305).
RULE = (
    "Fillomino: Place a digit from 1-{hi} in every cell. Orthogonally "
    "connected cells with the same digit are regions; the number of cells in "
    "a region has to equal its digit."
)


def build(component_path, puzzle_path):
    spec = json.loads(pathlib.Path(puzzle_path).read_text())
    clues = {tuple(p) for p in spec["clues"]}
    n = len(spec["grid"])
    # a cell holds a value only when it is a clue: a non-given value ships as
    # an entered digit and the recipient opens a board with digits typed in
    cells = [
        {"value": int(spec["grid"][r][c]), "given": True} if (r, c) in clues else {}
        for r in range(n)
        for c in range(n)
    ]
    doc = {
        "formatVersion": "1.6.0",
        "puzzle": {
            "name": CONSTRAINT_NAME,
            "author": "",
            "type": "custom",
            "width": n,
            "height": n,
            "comment": RULE.format(hi=n),
            "cells": cells,
            "constraints": [
                # the built-in "Given digits" constraint every frame carries;
                # without it the app lists no givens (isofill/build_link.py)
                {"type": 0},
                {
                    "name": CONSTRAINT_NAME,
                    "type": 1000,
                    "definition": {
                        "name": CONSTRAINT_NAME,
                        "input": [],
                        "backend": {
                            "type": "code",
                            "code": minify_js((HERE / "main.js").read_text()),
                        },
                        "components": [
                            {
                                "type": "code",
                                "name": TIMED_COMPONENT,
                                "code": minify_js(
                                    pathlib.Path(component_path).read_text()
                                ),
                            }
                        ],
                    },
                    "input": {},
                    "style": {},
                },
            ],
        },
    }
    return encode_link(doc), doc, len(clues)


def check(link, doc, n_clues):
    back = decode_puzzle(link)
    assert back == doc, "link does not decode back to the built document"
    p = back["puzzle"]
    n = p["width"]
    assert (p["type"], p["height"]) == ("custom", n)
    assert n <= 9, "digits 1..side must fit the app's 0-9 range"
    assert len(p["cells"]) == n * n and not any("houses" in k for k in p)
    # every non-given cell must be empty, or the board ships entered digits
    assert all(c.get("given") or c == {} for c in p["cells"])
    assert sum(1 for c in p["cells"] if c.get("given")) == n_clues
    assert p["constraints"][0] == {"type": 0}, "given-digits constraint missing"
    d = p["constraints"][1]["definition"]
    assert d["input"] == [], "a global constraint has no groups"
    assert [c["name"] for c in d["components"]] == [TIMED_COMPONENT]


def build_on_board(component_path, out_path, board_path):
    """Swap the component's code into a committed link, changing nothing else."""
    base = decode_puzzle(pathlib.Path(board_path).read_text().strip())
    code = minify_js(pathlib.Path(component_path).read_text())
    doc = swap_component_code(base, CONSTRAINT_NAME, TIMED_COMPONENT, code)
    return check_and_write(base, doc, CONSTRAINT_NAME, out_path)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--component", default=HERE / f"{TIMED_COMPONENT}.js")
    p.add_argument("--out", default=HERE / "PUZZLE_LINK.txt")
    p.add_argument("--puzzle", default=HERE / "gen.json")
    p.add_argument("--board", help="committed link to swap the component into")
    args = p.parse_args()
    if args.board:
        link = build_on_board(args.component, args.out, args.board)
        print(f"wrote {args.out} ({len(link)} chars, from {args.board})")
    else:
        link, doc, n_clues = build(args.component, args.puzzle)
        check(link, doc, n_clues)
        pathlib.Path(args.out).write_text(link + "\n")
        print(f"wrote {args.out} ({len(link)} chars, {n_clues} givens)")
