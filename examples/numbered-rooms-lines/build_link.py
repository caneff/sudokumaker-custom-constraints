# Build the SudokuMaker puzzle link for the Numbered Rooms Lines example from
# source: the board from gen.json, the code from main.js and
# NumberedRoomsLinesComponent.js, so a component fix flows into the link on the
# next run.
#
#   uv run --with lzstring examples/numbered-rooms-lines/build_link.py
#   uv run --with lzstring examples/numbered-rooms-lines/build_link.py \
#       --component /path/NumberedRoomsLinesComponent.js --out /tmp/candidate.txt
#
# Writes PUZZLE_LINK.txt next to this script; --component / --out swap in a
# candidate component file and write elsewhere (the shape `just time` drives).
#
# The board is a 6x6 sudoku inside a one-cell clue ring, 8x8 in all. Each of
# the twenty-four ring cells owns a line; five of those lines are drawn rather
# than straight. Regenerate the board with generate.py, which also holds the
# drawn geometry and the CP-SAT uniqueness proof.

import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from frame import cosmetics, ring_cell
from link_codec import decode_puzzle, encode_link
from minify import minify_js

HERE = pathlib.Path(__file__).parent
CONSTRAINT_NAME = "Numbered Rooms Lines"
TIMED_COMPONENT = "NumberedRoomsLinesComponent"

# Every generated link's rules text opens with this sentence (project rule).
RULES_PREFIX = "Normal sudoku rules apply on the inner grid. "
RULE = (
    "Numbered Rooms Lines: each outside clue sits at the end of a drawn line. "
    "Read the line inward from the clue. The digit in its first cell is an "
    "index k; the k-th cell of the line holds the clue's own digit. Most lines "
    "run straight down a row or column, but five bend, run diagonally, or stop "
    "short. A clue cell left empty is part of the puzzle: work it out."
)


def build(component_path, puzzle_path):
    spec = json.loads(pathlib.Path(puzzle_path).read_text())
    n = spec["n"]
    bh, bw = spec["box"]
    grid = spec["grid"]
    lines = spec["lines"]
    active = set(spec["active"])
    givens = {tuple(int(p) for p in k.split(",")): v for k, v in spec["givens"].items()}
    W = n + 2

    def idx(r, c):
        return r * W + c

    def inner(r, c):
        """Interior (row, column) as a frame cell index."""
        return idx(r + 1, c + 1)

    # A cell holds a value only when it is a given. The solution and every
    # hidden clue stay out of the document: a non-given value ships as an
    # entered digit, and the recipient opens a board already filled in.
    cells = [{} for _ in range(W * W)]

    # The four corners belong to no line, no region and no cage, so nothing
    # would pin them and the board would have one solution per corner digit. A
    # filler given costs the solver nothing and keeps the board unique. They
    # are why the link carries more givens than gen.json lists.
    for r, c in [(0, 0), (0, W - 1), (W - 1, 0), (W - 1, W - 1)]:
        cells[idx(r, c)] = {"given": True, "value": 1}

    for (r, c), v in givens.items():
        assert grid[r][c] == v, f"given at {r},{c} disagrees with the grid"
        cells[inner(r, c)] = {"value": v, "given": True}

    # A shown clue is a given; an interactive (hidden) clue is an empty cell
    # that the solver fills from its own line.
    for key in lines:
        if key in active:
            r, c = ring_cell(key, W)
            cells[idx(r, c)] = {"value": spec["clue"][key], "given": True}

    # Regions: the interior boxes. Ring cells belong to none.
    regions = [-1] * (W * W)
    for r in range(n):
        for c in range(n):
            regions[inner(r, c)] = (r // bh) * (n // bw) + (c // bw)

    # Transparent cages give the interior its row and column houses; the ring
    # is left out of them on purpose.
    row_cages = [
        {"cells": [inner(r, c) for c in range(n)], "value": 0} for r in range(n)
    ]
    col_cages = [
        {"cells": [inner(r, c) for r in range(n)], "value": 0} for c in range(n)
    ]
    cage_style = {"text": {"color": "#000000"}, "cage": {"color": "#00000000"}}

    # Group = clue cell, then the line read inward. main.js reads exactly this
    # order, so the drawn order in gen.json is the order that ships.
    groups = [
        {
            "cells": [idx(*ring_cell(key, W)), *(inner(r, c) for r, c in lines[key])],
            "value": "",
        }
        for key in sorted(lines)
    ]

    postproc_code = (
        "function postprocessJSON(json) {\n"
        "    json.metadata.norowcol = true;\n"
        '    json.cages.forEach(cage => cage.hidden ? cage.type = "rowcol" : null)\n'
        "}\n"
    )

    constraints = [
        {"type": 1, "regions": regions},
        {"name": "Rows", "type": 301, "cages": row_cages, "style": cage_style},
        {"name": "Columns", "type": 301, "cages": col_cages, "style": cage_style},
        # the built-in "Given digits" constraint every frame board carries
        {"type": 0},
        {
            # Last in the list on purpose: main.js asks
            # puzzle.getCellsSeeEachOther whether a line's cells are one house,
            # and the app counts only constraints defined ABOVE this one.
            "name": CONSTRAINT_NAME,
            "type": 1000,
            "definition": {
                "name": CONSTRAINT_NAME,
                "input": [
                    {"id": "groups", "label": "Groups", "params": {"type": "raw"}}
                ],
                "backend": {
                    "type": "code",
                    "code": minify_js((HERE / "main.js").read_text()),
                },
                "components": [
                    {
                        "type": "code",
                        "name": TIMED_COMPONENT,
                        "code": minify_js(pathlib.Path(component_path).read_text()),
                    }
                ],
            },
            "input": {"groups": groups},
            "style": {},
        },
        {
            "type": 1000,
            "definition": {
                "name": "JSON Postproc",
                "input": [],
                "backend": {"type": "code", "code": postproc_code},
                "components": [],
            },
            "input": {},
            "style": {},
        },
        *cosmetics(W, cells),
    ]

    doc = {
        "formatVersion": "1.6.0",
        "puzzle": {
            "name": f"Numbered Rooms Lines {n}x{n}",
            "author": "",
            "comment": RULES_PREFIX + RULE,
            "type": "custom",
            # minDigit/maxDigit pin the digit range to n; the app otherwise
            # defaults a custom puzzle to 0..9 whatever the grid size.
            "width": W,
            "height": W,
            "minDigit": 1,
            "maxDigit": n,
            "cells": cells,
            "constraints": constraints,
            "export": {"sudokuPad": {"useIncompleteGridAsSolution": True}},
        },
    }
    return encode_link(doc), doc, spec


def check(link, doc, spec):
    back = decode_puzzle(link)
    assert back == doc, "link does not decode back to the built document"
    p = back["puzzle"]
    n = spec["n"]
    assert p["comment"].startswith(RULES_PREFIX), "rules text must open with the prefix"
    assert (p["type"], p["width"], p["height"]) == ("custom", n + 2, n + 2)
    assert (p["minDigit"], p["maxDigit"]) == (1, n), "digits must be 1..n, not 0..9"
    # a cell holds a value only when it is a given -- never the solution, never
    # a hidden clue (examples/_shared/check_links.py gates every shipped link)
    assert not [c for c in p["cells"] if "value" in c and not c.get("given")]
    assert sum(1 for c in p["cells"] if c.get("given")) == (
        4 + len(spec["active"]) + len(spec["givens"])
    ), "givens are the four corner fillers, the shown clues, and the interior"
    names = [c.get("name") for c in p["constraints"]]
    # main.js asks the app whether a line is one house, and the app counts only
    # constraints defined above this one, so the houses must come first
    assert names.index(CONSTRAINT_NAME) > max(
        names.index("Rows"), names.index("Columns")
    ), "the lines constraint must sit after the row and column houses"
    lc = p["constraints"][names.index(CONSTRAINT_NAME)]
    assert len(lc["input"]["groups"]) == 4 * n, f"expected {4 * n} groups"
    assert lc["definition"]["backend"]["code"] == minify_js(
        (HERE / "main.js").read_text()
    )
    assert [c["name"] for c in lc["definition"]["components"]] == [TIMED_COMPONENT]


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--component", default=HERE / f"{TIMED_COMPONENT}.js")
    ap.add_argument("--out", default=HERE / "PUZZLE_LINK.txt")
    ap.add_argument("--puzzle", default=HERE / "gen.json")
    args = ap.parse_args()
    link, doc, spec = build(args.component, args.puzzle)
    check(link, doc, spec)
    pathlib.Path(args.out).write_text(link + "\n")
    print(f"wrote {args.out} ({len(link)} chars)")
