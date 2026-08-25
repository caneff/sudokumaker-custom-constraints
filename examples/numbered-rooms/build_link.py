# Rebuild the SudokuMaker puzzle link with the optimized Numbered Rooms
# component. Decodes the original link (numbered_rooms.url), swaps the "Custom
# Numbered Rooms" constraint's backend for main.js and its single component for
# NumberedRoomsComponent.js (minified), carves the interior down to the givens
# the components need to solve by logic (min_givens.json, from recovery-probe.mjs),
# and re-encodes.
#
#   node examples/numbered-rooms/recovery-probe.mjs      # first: writes min_givens.json
#   uv run --with lzstring examples/numbered-rooms/build_link.py
#
# Writes PUZZLE_LINK.txt next to this script.

import json
import pathlib
import sys
import urllib.parse

from lzstring import LZString

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
from minify import minify_js

ORIGINAL = HERE / "numbered_rooms.url"


def build():
    url = ORIGINAL.read_text().strip()
    payload = url.split("puzzle=")[-1]
    doc = json.loads(
        LZString.decompressFromEncodedURIComponent(urllib.parse.unquote(payload))
    )

    # Carve the interior: keep only the givens the components cannot solve without
    # (min_givens.json), then drop the "given" flag on the rest. A cell with no
    # "given" flag is how this doc already represents a hidden, solver-filled cell
    # (its value stays as the solution), so a carved cell matches those exactly.
    kept = set(json.loads((HERE / "min_givens.json").read_text())["kept"])
    givens = json.loads((HERE / "gen_9.json").read_text())["givens"]
    for i in givens:
        if i not in kept:
            doc["puzzle"]["cells"][i].pop("given", None)

    for c in doc["puzzle"]["constraints"]:
        d = c.get("definition", {})
        if d.get("name") == "Custom Numbered Rooms":
            d["backend"]["code"] = minify_js((HERE / "main.js").read_text())
            d["components"] = [
                {
                    "type": "code",
                    "name": name,
                    "code": minify_js((HERE / f"{name}.js").read_text()),
                }
                for name in ("NumberedRoomsComponent", "NumberedRoomsPairComponent")
            ]
            break
    else:
        raise SystemExit("template is missing the 'Custom Numbered Rooms' constraint")
    link = "https://sudokumaker.app/?puzzle=" + LZString.compressToEncodedURIComponent(
        json.dumps(doc)
    )
    return link, doc, kept


def check(link, doc, kept):
    back = json.loads(
        LZString.decompressFromEncodedURIComponent(
            urllib.parse.unquote(link.split("puzzle=")[-1])
        )
    )
    assert back == doc, "link does not decode back to the built document"
    nr = next(
        c
        for c in doc["puzzle"]["constraints"]
        if c.get("definition", {}).get("name") == "Custom Numbered Rooms"
    )
    comps = nr["definition"]["components"]
    assert [x["name"] for x in comps] == [
        "NumberedRoomsComponent",
        "NumberedRoomsPairComponent",
    ], comps
    assert "NumberedRoomsComponent" in nr["definition"]["backend"]["code"]
    assert "NumberedRoomsPairComponent" in nr["definition"]["backend"]["code"]
    # The shipped interior givens are exactly the carved set.
    cells = doc["puzzle"]["cells"]
    givens = json.loads((HERE / "gen_9.json").read_text())["givens"]
    shipped = {
        i for i in givens if isinstance(cells[i], dict) and cells[i].get("given")
    }
    assert shipped == kept, (sorted(shipped), sorted(kept))


if __name__ == "__main__":
    link, doc, kept = build()
    check(link, doc, kept)
    (HERE / "PUZZLE_LINK.txt").write_text(link + "\n")
    print(
        f"wrote PUZZLE_LINK.txt ({len(link)} chars); shipped {len(kept)} interior givens {sorted(kept)}"
    )
