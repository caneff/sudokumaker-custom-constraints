# Build the Dutch Flatmates link: a ringless 9x9 -- the board's givens from
# gen.json, the whole-grid rows-and-columns backend, and the one whole-grid
# flatmate constraint (main.js + DutchFlatmatesComponent.js).
#
#   uv run examples/dutch-flatmates/build_link.py [--puzzle gen.json] [--out FILE]
#   uv run examples/dutch-flatmates/build_link.py --component FILE --out FILE [--board LINK]
#   uv run examples/dutch-flatmates/build_link.py --puzzle examples/dutch-flatmates/gen_0g.json \
#       --keep-comments --out examples/dutch-flatmates/PUZZLE_LINK_0g_annotated.txt
#
# No --component rebuilds PUZZLE_LINK.txt (or --out) from --puzzle, re-proving
# the board unique first; --component swaps a candidate into PUZZLE_LINK.txt or
# --board, the way `just time dutch-flatmates` times a candidate against the
# committed link (link_swap.swap_main).
#
# --keep-comments builds the annotated link (#693): same board, but the code
# embedded in it keeps every comment, so a puzzle setter can read it in the
# app's code box (the build house-gac's annotated link uses, #433). The code
# loses its `/* eslint-disable */` line, which is for this repo's linter.
#
# framebuild cannot host this board: its only ringless path (`no_ring_doc`)
# reads drawn groups and a clue function from a `Spec`, and a flatmate board has
# neither. The document is written out here, in the shape `no_ring_doc`
# produces, and takes its two shared parts -- the whole-grid rows-and-columns
# backend and the rules opening -- from framebuild.
#
# A gen JSON with a "circles" list is Flinty's Counting Circles board
# (gen_0g.json): the same document plus the app's built-in Counting Circles and
# NoFiveComponent over the circle cells, and, when its "diagonals" key is set,
# both diagonals. Its builtin
# constraint shapes (types 10, 11, 306) are the ones the app's own bundle
# writes; the app solving the board to a unique verdict is what vouches for
# them.

import argparse
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from flatmate_model import Extras, N, prove_recorded
from framebuild import NO_RING_RULES_PREFIX, grid_backend_constraint
from link_codec import decode_puzzle, encode_link
from link_swap import swap_main
from minify import minify_js

CONSTRAINT_NAME = "Dutch Flatmates"
TIMED_COMPONENT = "DutchFlatmatesComponent"
RULE = (
    "Dutch Flatmates: every 5 needs a flatmate, a 1 directly above it or a 9 "
    "directly below it. A 5 in the top row needs the 9 below it, and a 5 in the "
    "bottom row needs the 1 above it."
)

NO_FIVE_NAME = "No 5 in circles"
NO_FIVE_COMPONENT = "NoFiveComponent"
LINE_STYLE = {"color": "#34bbe6ff", "thickness": 0.02}
CIRCLE_STYLE = {
    "size": 0.75,
    "fill": "#ffffffff",
    "stroke": {"thickness": 0.02, "color": "#000000ff"},
}
DIAGONALS_RULE = "Digits may not repeat along the two main diagonals."
CIRCLES_RULES = (
    "Counting Circles: a digit in a circle is the number of circles containing "
    "that digit.\n\n"
    "No 5 in a circle: 5s live in Dutch Flats, not in circles.\n\n"
    "Puzzle by {author} ({source})."
)


def embedded_code(path, keep_comments=False):
    """`path`'s code as it goes into a link: comments stripped, or, for the
    annotated link, kept, minus the lint directive (a repo-only line)."""
    path = pathlib.Path(path)
    text = path.read_text()
    if keep_comments:
        text = "".join(
            line
            for line in text.splitlines(keepends=True)
            if not line.startswith("/* eslint-disable")
        )
    return minify_js(text, base_dir=path.parent, keep_comments=keep_comments)


def circles_comment(extras, spec):
    """The rules text of a Counting Circles board: the ringless opening, then
    each rule the `extras` ship, in the order the board lists them."""
    parts = [NO_RING_RULES_PREFIX + (DIAGONALS_RULE if extras.diagonals else RULE)]
    if extras.diagonals:
        parts.append(RULE)
    parts.append(CIRCLES_RULES.format(**spec))
    return "\n\n".join(parts)


def read_board(puzzle_path):
    """(grid, givens) from a gen JSON: `grid` the solved rows as strings,
    `givens` {(row, column): digit}."""
    spec = json.loads(pathlib.Path(puzzle_path).read_text())
    givens = {(r, c): int(spec["grid"][r][c]) for r, c in spec["clues"]}
    return spec["grid"], givens


def read_extras(puzzle_path):
    """The `Extras` a gen JSON asks for, plus its raw spec: no "circles" key is
    the plain flatmate board."""
    spec = json.loads(pathlib.Path(puzzle_path).read_text())
    return Extras(tuple(spec.get("circles", ())), spec.get("diagonals", False)), spec


def circles_constraints(circles, keep_comments=False):
    """The constraints Counting Circles adds after the flatmate one: the circles
    and the no-5 rule over the circle cells."""
    no_five = f"puzzle.addConstraintComponent(new {NO_FIVE_COMPONENT}('no 5 in a circle', {json.dumps(list(circles))}))"
    return [
        {"type": 306, "cells": list(circles), "style": CIRCLE_STYLE},
        {
            "name": NO_FIVE_NAME,
            "type": 1000,
            "definition": {
                "name": NO_FIVE_NAME,
                "input": [],
                "backend": {"type": "code", "code": no_five},
                "components": [
                    {
                        "type": "code",
                        "name": NO_FIVE_COMPONENT,
                        "code": embedded_code(
                            HERE / f"{NO_FIVE_COMPONENT}.js", keep_comments
                        ),
                    }
                ],
            },
            "input": {},
            "style": {},
        },
    ]


def build(
    component_path=HERE / f"{TIMED_COMPONENT}.js",
    puzzle_path=HERE / "gen.json",
    keep_comments=False,
):
    """Build the board in `puzzle_path` with `component_path`'s code, after
    proving it has exactly the solution the gen JSON records. `keep_comments`
    builds the annotated link: the embedded code keeps its comments. Returns
    (link, doc, number of givens)."""
    grid, givens = read_board(puzzle_path)
    extras, spec = read_extras(puzzle_path)
    prove_recorded(givens, grid, extras)
    # a cell holds a value only when it is a given: a non-given value ships as
    # an entered digit and the recipient opens a solved board
    cells = [
        {"value": givens[r, c], "given": True} if (r, c) in givens else {}
        for r in range(N)
        for c in range(N)
    ]
    regions = [(r // 3) * 3 + c // 3 for r in range(N) for c in range(N)]
    doc = {
        "formatVersion": "1.6.0",
        "puzzle": {
            "name": CONSTRAINT_NAME,
            "author": "",
            "comment": circles_comment(extras, spec)
            if extras.circles
            else NO_RING_RULES_PREFIX + RULE,
            "type": "custom",
            "width": N,
            "height": N,
            # pinned: the grid backend reads helpers.digits, and the app's
            # default range for a custom puzzle is not the document's to rely on
            "minDigit": 1,
            "maxDigit": N,
            "cells": cells,
            "constraints": [
                {"type": 1, "regions": regions},
                # the built-in "Given digits" constraint every frame carries;
                # without it the app lists no givens
                {"type": 0},
                grid_backend_constraint(),
                {
                    "name": CONSTRAINT_NAME,
                    "type": 1000,
                    "definition": {
                        "name": CONSTRAINT_NAME,
                        "input": [],
                        "backend": {
                            "type": "code",
                            "code": embedded_code(HERE / "main.js", keep_comments),
                        },
                        "components": [
                            {
                                "type": "code",
                                "name": TIMED_COMPONENT,
                                "code": embedded_code(component_path, keep_comments),
                            }
                        ],
                    },
                    "input": {},
                    "style": {},
                },
                # one `Extras` field per rule, for the proof and the document alike
                *(
                    [{"type": t, "style": LINE_STYLE} for t in (10, 11)]
                    if extras.diagonals
                    else []
                ),
                *(
                    circles_constraints(extras.circles, keep_comments)
                    if extras.circles
                    else []
                ),
            ],
            "export": {"sudokuPad": {"useIncompleteGridAsSolution": True}},
        },
    }
    return encode_link(doc), doc, len(givens)


def check(link, doc, n_givens):
    back = decode_puzzle(link)
    assert back == doc, "link does not decode back to the built document"
    p = back["puzzle"]
    assert (p["type"], p["width"], p["height"]) == ("custom", N, N)
    assert p["comment"].startswith(NO_RING_RULES_PREFIX)
    assert "Dutch Flatmates" in p["comment"]
    assert len(p["cells"]) == N * N
    # every non-given cell must be empty, or the board ships entered digits
    assert all(c.get("given") or c == {} for c in p["cells"])
    assert sum(1 for c in p["cells"] if c.get("given")) == n_givens
    mine = [
        c["definition"]
        for c in p["constraints"]
        if c.get("definition", {}).get("name") == CONSTRAINT_NAME
    ]
    assert len(mine) == 1, "expected exactly one Dutch Flatmates constraint"
    assert mine[0]["input"] == [], "a whole-grid constraint has no groups"
    assert [c["name"] for c in mine[0]["components"]] == [TIMED_COMPONENT]


def rebuild(args, _parser):
    """No --component: rebuild the link from source, to --out or
    PUZZLE_LINK.txt."""
    out = args.out or HERE / "PUZZLE_LINK.txt"
    link, doc, n_givens = build(
        puzzle_path=args.puzzle, keep_comments=args.keep_comments
    )
    check(link, doc, n_givens)
    pathlib.Path(out).write_text(link + "\n")
    print(f"wrote {out} ({len(link)} chars, {n_givens} givens)")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--puzzle", default=HERE / "gen.json")
    p.add_argument(
        "--keep-comments",
        action="store_true",
        help="build the annotated link: embedded code keeps every comment (#693)",
    )
    swap_main(HERE, p, rebuild)
