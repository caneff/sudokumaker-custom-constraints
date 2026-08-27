# Two jobs in one script.
#
# No args: rebuild PUZZLE_LINK.txt from scratch from the current source files.
# The grid, clue ring, given flags, line groups, regions, cages, and cosmetic
# lines never change for this example; they live in puzzle_template.json (a
# document decoded once from a known-good link, with the code fields emptied).
# Only the embedded code changes when you edit main.js or a component, so this
# path injects the current files and re-encodes.
#
#   uv run --with lzstring examples/running-start/build_link.py
#
# Writes PUZZLE_LINK.txt next to this script.
#
# --component/--out: build a same-board comparison link (the contract in
# docs/real-app-timing.md, shared with numbered-rooms/skyscraper/hit-counts):
# the committed PUZZLE_LINK.txt with one named component's code swapped for a
# candidate file. The board, givens, and every other constraint field stay
# exactly as shipped -- only the requested component's code changes.
#
#   uv run --with lzstring examples/running-start/build_link.py \
#     --component RunningStartComponent.js --out /tmp/candidate.txt
#
# --component names a file whose basename (minus .js) matches an existing
# component registered on PUZZLE_LINK.txt's "Running Start Lines" constraint
# (RunningStartComponent or RunningStartPairComponent); that component's code
# becomes the given file's, minified. The backend and the sibling component
# are untouched.

import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from frame import cosmetics
from link_codec import decode_puzzle, encode_link
from link_swap import check_and_write, swap_component_code
from minify import minify_js

HERE = pathlib.Path(__file__).parent
COMPONENTS = ["RunningStartComponent.js", "RunningStartPairComponent.js"]
CONSTRAINT_NAME = "Running Start Lines"


def build(component_path, out_path):
    """Swap one named component's code into the committed PUZZLE_LINK.txt and
    write the result to out_path. Same contract as numbered-rooms/skyscraper."""
    component_path = pathlib.Path(component_path)
    code = minify_js(component_path.read_text())
    base = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
    doc = swap_component_code(base, CONSTRAINT_NAME, component_path.stem, code)
    return check_and_write(base, doc, CONSTRAINT_NAME, out_path)


def build_from_template():
    """Rebuild the whole link from puzzle_template.json, main.js, and both
    component files -- the source of truth for PUZZLE_LINK.txt."""
    doc = json.loads((HERE / "puzzle_template.json").read_text())
    # the template was decoded from a finished board, so it carries the whole
    # solution and every hidden clue as non-given values. Same rule as
    # framebuild.build_doc: a cell holds a value only when it is a given —
    # anything else ships as an entered digit and the recipient opens a
    # filled-in board.
    for cell in doc["puzzle"]["cells"]:
        if not cell.get("given"):
            cell.pop("value", None)
    doc["puzzle"]["author"] = ""
    for c in doc["puzzle"]["constraints"]:
        d = c.get("definition", {})
        if c.get("type") == 1000 and d.get("name") == "Running Start Lines":
            d["backend"]["code"] = minify_js((HERE / "main.js").read_text())
            d["components"] = [
                {
                    "type": "code",
                    "name": f[:-3],
                    "code": minify_js((HERE / f).read_text()),
                }
                for f in COMPONENTS
            ]
            break
    else:
        raise SystemExit("template is missing the 'Running Start Lines' constraint")
    # trim the postproc helper's verbose comments out of the shared link too
    for c in doc["puzzle"]["constraints"]:
        d = c.get("definition", {})
        if d.get("name") == "JSON Postproc":
            d["backend"]["code"] = minify_js(d["backend"]["code"])
    # replace the template's hand-drawn cosmetics with generated ones, so the
    # outlines box exactly the given outside cells (same rule as the 4x4/6x6)
    cons = doc["puzzle"]["constraints"]
    cons[:] = [c for c in cons if c.get("type") != 2000]
    cons.extend(cosmetics(doc["puzzle"]["width"], doc["puzzle"]["cells"]))
    # pin the digit range to 9 (the app defaults a custom puzzle to 0..9) and
    # match the rule wording used by the 4x4/6x6 builder
    doc["puzzle"]["minDigit"] = 1
    doc["puzzle"]["maxDigit"] = 9
    doc["puzzle"]["comment"] = (
        "Running Start: Outside cells on clues must contain a digit, and that "
        "digit indicates the length of the first ascending sequence in that "
        "direction. For example, a row with 142356789 gives a left clue of 2 "
        "(1, 4) and a right clue of 1 (9)."
        "\n\nThe 1s in the corners only fill space for SudokuMaker's solver; "
        "delete them before publishing."
    )
    return encode_link(doc), doc


def check(link, doc):
    # round-trips, and the injected code is really in there
    back = decode_puzzle(link)
    assert back == doc, "link does not decode back to the built document"
    rs = next(
        c
        for c in doc["puzzle"]["constraints"]
        if c.get("definition", {}).get("name") == CONSTRAINT_NAME
    )
    names = [comp["name"] for comp in rs["definition"]["components"]]
    assert names == [f[:-3] for f in COMPONENTS], f"components wrong: {names}"
    assert rs["definition"]["backend"]["code"] == minify_js(
        (HERE / "main.js").read_text()
    )
    assert len(rs["input"]["groups"]) == 36, "expected 36 line groups"


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--component", help="swap this file into PUZZLE_LINK.txt")
    p.add_argument("--out", help="where to write the swapped-in link")
    args = p.parse_args()
    if args.component is None and args.out is None:
        # no args: rebuild PUZZLE_LINK.txt from source, the current default
        link, doc = build_from_template()
        check(link, doc)
        (HERE / "PUZZLE_LINK.txt").write_text(link + "\n")
        print(f"wrote PUZZLE_LINK.txt ({len(link)} chars)")
    elif args.component is None or args.out is None:
        p.error("--component and --out must be given together")
    else:
        build(args.component, args.out)
        print(f"wrote {args.out}")
