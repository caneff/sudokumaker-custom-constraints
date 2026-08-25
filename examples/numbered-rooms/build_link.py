# Rebuild the SudokuMaker puzzle link with the optimized Numbered Rooms
# component. Decodes the original link (numbered_rooms.url), swaps the "Custom
# Numbered Rooms" constraint's backend for main.js and its single component for
# NumberedRoomsComponent.js (minified), and re-encodes.
#
#   uv run --with lzstring examples/numbered-rooms/build_link.py
#
# Writes PUZZLE_LINK.txt next to this script.

import json, pathlib, sys, urllib.parse
from lzstring import LZString

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
from minify import minify_js

ORIGINAL = HERE / "numbered_rooms.url"


def build():
    url = ORIGINAL.read_text().strip()
    payload = url.split("puzzle=")[-1]
    doc = json.loads(LZString.decompressFromEncodedURIComponent(urllib.parse.unquote(payload)))
    for c in doc["puzzle"]["constraints"]:
        d = c.get("definition", {})
        if d.get("name") == "Custom Numbered Rooms":
            d["backend"]["code"] = minify_js((HERE / "main.js").read_text())
            d["components"] = [
                {"type": "code", "name": name,
                 "code": minify_js((HERE / f"{name}.js").read_text())}
                for name in ("NumberedRoomsComponent", "NumberedRoomsPairComponent")
            ]
            break
    else:
        raise SystemExit("template is missing the 'Custom Numbered Rooms' constraint")
    link = "https://sudokumaker.app/?puzzle=" + LZString.compressToEncodedURIComponent(json.dumps(doc))
    return link, doc


def check(link, doc):
    back = json.loads(LZString.decompressFromEncodedURIComponent(
        urllib.parse.unquote(link.split("puzzle=")[-1])))
    assert back == doc, "link does not decode back to the built document"
    nr = next(c for c in doc["puzzle"]["constraints"]
              if c.get("definition", {}).get("name") == "Custom Numbered Rooms")
    comps = nr["definition"]["components"]
    assert [x["name"] for x in comps] == ["NumberedRoomsComponent", "NumberedRoomsPairComponent"], comps
    assert "NumberedRoomsComponent" in nr["definition"]["backend"]["code"]
    assert "NumberedRoomsPairComponent" in nr["definition"]["backend"]["code"]


if __name__ == "__main__":
    link, doc = build()
    check(link, doc)
    (HERE / "PUZZLE_LINK.txt").write_text(link + "\n")
    print(f"wrote PUZZLE_LINK.txt ({len(link)} chars)")
