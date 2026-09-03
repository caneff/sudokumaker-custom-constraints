# Build the SudokuMaker puzzle link for the fillomino BASELINE (#281).
#
# The baseline is the community catalog's fillomino constraint (row 55, by
# SudokuFan). This script rebuilds its sample board as a link this repo
# generates, so the board and the component can be varied independently: the
# board stays fixed while `--component` swaps in a candidate.
#
# Shaped after examples/isofill/build_link.py -- a bare square board with no
# houses, built from scratch. It is NOT an example: see README.md here for why
# this lives under docs/research/ instead of examples/.
#
#   uv run --with lzstring docs/research/fillomino-baseline/build_link.py
#   just time ../docs/research/fillomino-baseline
#
# Writes PUZZLE_LINK.txt next to this script; --component / --out swap in a
# candidate component file and write elsewhere; --board names a committed link
# to swap the component into, which is what `just time --board` needs.

import argparse
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "examples" / "_shared"))
from link_codec import decode_puzzle, encode_link  # noqa: E402
from link_swap import check_and_write, swap_component_code  # noqa: E402
from minify import minify_js  # noqa: E402

HERE = pathlib.Path(__file__).parent
CONSTRAINT_NAME = "Fillomino"
TIMED_COMPONENT = "FillominoComponent"
# Fillomino is not sudoku, so the rules text carries no RULES_PREFIX -- the
# same exception isofill takes (docs/example-layout.md, #271).
RULE = (
    "Fillomino: Place a digit from 1-{hi} in every cell. Orthogonally "
    "connected cells with the same digit are regions; the number of cells in "
    "a region has to equal its digit."
)


def build(component_path, puzzle_path, cap=None):
    """`cap`, when given, ships explicit minDigit/maxDigit (1..cap) on the
    puzzle doc so a region can run past the board side (#293 confirmed the
    app accepts this) -- the fixture set (#307) needs a 9x9 with digits
    1-12. Left at the default None, the doc carries no such keys and this
    reproduces the baseline's own 6x6 board byte-for-byte, unchanged."""
    spec = json.loads(pathlib.Path(puzzle_path).read_text())
    n = spec["size"]
    hi = cap if cap is not None else n
    givens = {(r, c): v for r, c, v in spec["givens"]}
    # a cell holds a value only when it is a given: a non-given value ships as
    # an entered digit and the recipient opens a board with digits typed in
    cells = [
        {"value": givens[(r, c)], "given": True} if (r, c) in givens else {}
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
            **({"minDigit": 1, "maxDigit": hi} if cap is not None else {}),
            "comment": RULE.format(hi=hi),
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
    return encode_link(doc), doc, len(givens)


def check(link, doc, n_givens):
    back = decode_puzzle(link)
    assert back == doc, "link does not decode back to the built document"
    p = back["puzzle"]
    n = p["width"]
    assert (p["type"], p["height"]) == ("custom", n)
    assert len(p["cells"]) == n * n and not any("houses" in k for k in p)
    # every non-given cell must be empty, or the board ships entered digits
    assert all(c.get("given") or c == {} for c in p["cells"])
    assert sum(1 for c in p["cells"] if c.get("given")) == n_givens
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
    p.add_argument("--cap", type=int, help="digit cap; ships minDigit/maxDigit")
    args = p.parse_args()
    if args.board:
        link = build_on_board(args.component, args.out, args.board)
        print(f"wrote {args.out} ({len(link)} chars, from {args.board})")
    else:
        link, doc, n_givens = build(args.component, args.puzzle, cap=args.cap)
        check(link, doc, n_givens)
        pathlib.Path(args.out).write_text(link + "\n")
        print(f"wrote {args.out} ({len(link)} chars, {n_givens} givens)")
