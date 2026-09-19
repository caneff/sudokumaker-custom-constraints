# Two jobs in one script.
#
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
from link_swap import find_constraint, swap_main
from minify import minify_file

HERE = pathlib.Path(__file__).parent
COMPONENTS = ["RunningStartComponent.js", "RunningStartPairComponent.js"]
CONSTRAINT_NAME = "Running Start"
TIMED_COMPONENT = "RunningStartComponent"


def build_from_template():
    """Rebuild the whole link from gen.json, main-global.js, and both
    component files -- the source of truth for PUZZLE_LINK.txt. The shipped
    board draws no groups: main-global.js builds all 4n frame lines itself
    (#235), so the constraint's input is emptied here too."""
    doc = json.loads((HERE / "gen.json").read_text())
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
        if c.get("type") == 1000 and d.get("name") == CONSTRAINT_NAME:
            d["backend"]["code"] = minify_file(HERE / "main-global.js")
            d["components"] = [
                {
                    "type": "code",
                    "name": f[:-3],
                    "code": minify_file(HERE / f),
                }
                for f in COMPONENTS
            ]
            d["input"] = []
            c["input"] = {}
            break
    else:
        raise SystemExit(f"template is missing the {CONSTRAINT_NAME!r} constraint")
    # replace the template's hand-drawn cosmetics with generated ones, so the
    # outlines box exactly the given outside cells (same rule as the 4x4/6x6)
    cons = doc["puzzle"]["constraints"]
    cons[:] = [c for c in cons if c.get("type") != 2000]
    # The shared house-GAC filter, on this board only (real-app timing clears
    # the two-row bar here: 0.71x cold, ~0x after-logical --
    # docs/research/421-frame-link-timing.md, #421). This is the GLOBAL 9x9's
    # own template, not framebuild's Spec (running-start's local/4x4/6x6
    # lanes are framebuild-native and unaffected -- their timing was not
    # measured, so they do not carry it).
    cons[:] = [
        c
        for c in cons
        if c.get("definition", {}).get("name") != HOUSE_GAC_BACKEND_TITLE
    ]
    cons.append(house_gac_constraint(9))
    cons.extend(cosmetics(doc["puzzle"]["width"], doc["puzzle"]["cells"]))
    # pin the digit range to 9 (the app defaults a custom puzzle to 0..9) and
    # match the rule wording used by the 4x4/6x6 builder
    doc["puzzle"]["minDigit"] = 1
    doc["puzzle"]["maxDigit"] = 9
    # The rule text has one home: build_size.rule_text, which the 4x4, the 6x6
    # and the local board also use. Read it here rather than restate it, so a
    # wording change (the tie sentence, say) reaches every link at once.
    doc["puzzle"]["comment"] = RULES_PREFIX + rule_text(9)
    # The frame's shared backends live in _shared, not in this template, so
    # they are refreshed from the tree the way the example's own code is.
    refresh_frame_backends(doc)
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
    assert rs["definition"]["backend"]["code"] == minify_file(HERE / "main-global.js")
    assert rs["input"] == {}, "the global board reads no drawn groups"
    for title, code in frame_backend_code():
        embedded = find_constraint(doc, title)["definition"]["backend"]["code"]
        assert embedded == code, f"{title} is not the copy in the tree"


def rebuild(_args, _parser):
    """No --component: rebuild PUZZLE_LINK.txt from source."""
    link, doc = build_from_template()
    check(link, doc)
    (HERE / "PUZZLE_LINK.txt").write_text(link + "\n")
    print(f"wrote PUZZLE_LINK.txt ({len(link)} chars)")


if __name__ == "__main__":
    swap_main(HERE, rebuild=rebuild)
