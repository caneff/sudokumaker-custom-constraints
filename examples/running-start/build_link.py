# No args: rebuild PUZZLE_LINK.txt from scratch from the current source files.
# The grid, clue ring, given flags, regions, cages, and cosmetic lines never
# change for this example; they live in gen.json (a document decoded once
# from a known-good link, with EVERY code field emptied -- this example's own
# and the shared frame backends' alike, so the record cannot drift from the
# tree). Only the embedded code changes when you edit main-global.js or a
# component, so this path injects the current files and re-encodes.
#
#   uv run --with lzstring examples/running-start/build_link.py
#
# Writes PUZZLE_LINK.txt next to this script.
#
# --component/--out: build a same-board comparison link (the contract in
# docs/real-app-timing.md; _shared/link_swap.swap_main): the committed
# PUZZLE_LINK.txt, or --board, with one component's code swapped for a
# candidate file and nothing else changed. `just time running-start --board
# PUZZLE_LINK_local.txt` reaches the local bent-path board this way.
#
#   uv run examples/running-start/build_link.py \
#     --component RunningStartComponent.js --out FILE [--board LINK]

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from build_size import rule_text
from frame import cosmetics
from framebuild import (
    HOUSE_GAC_BACKEND_TITLE,
    RULES_PREFIX,
    frame_backend_code,
    house_gac_constraint,
    refresh_frame_backends,
)
from link_codec import decode_puzzle, encode_link
from link_swap import swap_main
from manifest import load_manifest
from minify import minify_file
from sm_document import find_constraint

HERE = pathlib.Path(__file__).parent
COMPONENTS = ["RunningStartComponent.js", "RunningStartPairComponent.js"]
MANIFEST = load_manifest(HERE)
CONSTRAINT_NAME = MANIFEST.constraint_name


def build_from_template():
    """The shipped board draws no groups: main-global.js builds all 4n frame
    lines itself, so the constraint's input is emptied too."""
    doc = json.loads((HERE / "gen.json").read_text())
    # The template was decoded from a finished board: a value on a non-given
    # cell would ship as an entered digit, and the recipient would open a
    # filled-in board.
    for cell in doc["puzzle"]["cells"]:
        if not cell.get("given"):
            cell.pop("value", None)
    doc["puzzle"]["author"] = ""
    lc = find_constraint(doc, CONSTRAINT_NAME)
    d = lc["definition"]
    d["backend"]["code"] = minify_file(HERE / "main-global.js")
    d["components"] = [
        {"type": "code", "name": f[:-3], "code": minify_file(HERE / f)}
        for f in COMPONENTS
    ]
    d["input"] = []
    lc["input"] = {}
    # Generated cosmetics (type 2000), so the outlines box exactly the given
    # outside cells.
    cons = doc["puzzle"]["constraints"]
    cons[:] = [c for c in cons if c.get("type") != 2000]
    # The shared house-GAC filter, on this 9x9 global board only: real-app
    # timing clears the two-row bar here (0.71x cold, ~0x after-logical;
    # docs/research/421-frame-link-timing.md). The local, 4x4 and 6x6 lanes are
    # framebuild-native and were not timed, so they do not carry it.
    cons[:] = [
        c
        for c in cons
        if c.get("definition", {}).get("name") != HOUSE_GAC_BACKEND_TITLE
    ]
    cons.append(house_gac_constraint(9))
    cons.extend(cosmetics(doc["puzzle"]["width"], doc["puzzle"]["cells"]))
    doc["puzzle"]["minDigit"] = 1
    doc["puzzle"]["maxDigit"] = 9
    doc["puzzle"]["comment"] = RULES_PREFIX + rule_text(9)
    refresh_frame_backends(doc)
    return encode_link(doc), doc


def check(link, doc):
    back = decode_puzzle(link)
    assert back == doc, "link does not decode back to the built document"
    rs = find_constraint(doc, CONSTRAINT_NAME)
    names = [comp["name"] for comp in rs["definition"]["components"]]
    assert names == [f[:-3] for f in COMPONENTS], f"components wrong: {names}"
    assert rs["definition"]["backend"]["code"] == minify_file(HERE / "main-global.js")
    assert rs["input"] == {}, "the global board reads no drawn groups"
    for title, code in frame_backend_code():
        embedded = find_constraint(doc, title)["definition"]["backend"]["code"]
        assert embedded == code, f"{title} is not the copy in the tree"


def rebuild(_args, _parser):
    link, doc = build_from_template()
    check(link, doc)
    (HERE / "PUZZLE_LINK.txt").write_text(link + "\n")
    print(f"wrote PUZZLE_LINK.txt ({len(link)} chars)")


if __name__ == "__main__":
    swap_main(HERE, rebuild=rebuild)
