# Build the SudokuMaker puzzle link for the ISOFILL example from source.
#
# There is no template: a custom square board with no houses is small enough to
# build from scratch (the board fields come from the scaffold check in #50).
# The side comes from the grid's row count and the lowest digit from the
# optional "minDigit" key (default 0): 10x10 with 0-9, or 9x9 with 1-9.
# The grid and clue set come from gen.json; the code comes from main.js and
# IsofillComponent.js, so a component fix flows into the link on the next run.
#
#   uv run --with lzstring examples/isofill/build_link.py
#   uv run --with lzstring examples/isofill/build_link.py \
#       --component /path/IsofillComponent.js --out /tmp/candidate.txt
#
# Writes PUZZLE_LINK.txt next to this script; --component / --out swap in a
# candidate component file and write elsewhere; --puzzle builds another
# instance, e.g. gen_44g.json. --board names a committed link instead: the
# candidate component's code is swapped into that link and nothing else
# changes, which is how `just time isofill --board PUZZLE_LINK_30g.txt` times
# a fixture other than the default board.

import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from link_codec import decode_puzzle, encode_link
from link_swap import check_and_write, swap_component_code
from minify import minify_js

HERE = pathlib.Path(__file__).parent
CONSTRAINT_NAME = "ISOFILL"
TIMED_COMPONENT = "IsofillComponent"
RULE = (
    "Normal sudoku rules apply on the inner grid. "
    "ISOFILL: Divide the grid into {n} regions, each with {n} orthogonally "
    "connected cells. Every cell in a region should contain the same digit. "
    "All of the digits {lo}-{hi} must appear in the grid."
)


def build(component_path, puzzle_path):
    spec = json.loads(pathlib.Path(puzzle_path).read_text())
    clues = {tuple(p) for p in spec["clues"]}
    N = len(spec["grid"])
    lo = spec.get("minDigit", 0)
    # a cell holds a value only when it is a clue: a non-given value ships as an
    # entered digit and the recipient opens a solved board
    cells = [
        {"value": int(spec["grid"][r][c]), "given": True} if (r, c) in clues else {}
        for r in range(N)
        for c in range(N)
    ]
    doc = {
        "formatVersion": "1.6.0",
        "puzzle": {
            "name": CONSTRAINT_NAME,
            "author": "",
            "type": "custom",
            "width": N,
            "height": N,
            "minDigit": lo,
            "comment": RULE.format(n=N, lo=lo, hi=lo + N - 1),
            "cells": cells,
            "constraints": [
                # the built-in "Given digits" constraint every frame carries;
                # without it the app lists no givens (found live, 2026-08-27)
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
                                "name": "IsofillComponent",
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
    N = p["width"]
    assert (p["type"], p["height"]) == ("custom", N)
    assert p["minDigit"] + N - 1 <= 9, "digits must fit the app's 0-9 range"
    assert len(p["cells"]) == N * N and not any("houses" in k for k in p)
    assert sum(1 for c in p["cells"] if c.get("given")) == n_clues
    assert p["constraints"][0] == {"type": 0}, "given-digits constraint missing"
    d = p["constraints"][1]["definition"]
    assert d["input"] == [], "a global constraint has no groups"
    assert [c["name"] for c in d["components"]] == ["IsofillComponent"]


def build_on_board(component_path, out_path, board_path):
    """Swap the component's code into a committed link, changing nothing else.

    This is how `just time isofill --board <link>` reaches a fixture other
    than the default board: the grid and clues stay exactly as committed.
    """
    base = decode_puzzle(pathlib.Path(board_path).read_text().strip())
    code = minify_js(pathlib.Path(component_path).read_text())
    doc = swap_component_code(base, CONSTRAINT_NAME, TIMED_COMPONENT, code)
    return check_and_write(base, doc, CONSTRAINT_NAME, out_path)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--component", default=HERE / "IsofillComponent.js")
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
