# Rebuild the SudokuMaker puzzle link from the current source files.
#
# The grid, clue ring, given flags, line groups, regions, cages, and cosmetic
# lines never change for this example; they live in puzzle_template.json (a
# document decoded once from a known-good link, with the code fields emptied).
# Only the embedded code changes when you edit main.js or a component, so this
# script injects the current files and re-encodes.
#
#   uv run --with lzstring examples/running-start/build_link.py
#
# Writes PUZZLE_LINK.txt next to this script.

import json, pathlib
from lzstring import LZString
from minify import minify_js
from frame import cosmetics

HERE = pathlib.Path(__file__).parent
COMPONENTS = ["RunningStartComponent.js", "RunningStartPairComponent.js"]


def build():
    doc = json.loads((HERE / "puzzle_template.json").read_text())
    for c in doc["puzzle"]["constraints"]:
        d = c.get("definition", {})
        if c.get("type") == 1000 and d.get("name") == "Running Start Lines":
            d["backend"]["code"] = minify_js((HERE / "main.js").read_text())
            d["components"] = [
                {"type": "code", "name": f[:-3], "code": minify_js((HERE / f).read_text())}
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
    payload = LZString.compressToEncodedURIComponent(json.dumps(doc))
    return "https://sudokumaker.app/?puzzle=" + payload, doc


def check(link, doc):
    # round-trips, and the injected code is really in there
    import urllib.parse
    back = json.loads(LZString.decompressFromEncodedURIComponent(
        urllib.parse.unquote(link.split("puzzle=")[-1])))
    assert back == doc, "link does not decode back to the built document"
    rs = next(c for c in doc["puzzle"]["constraints"]
              if c.get("definition", {}).get("name") == "Running Start Lines")
    names = [comp["name"] for comp in rs["definition"]["components"]]
    assert names == [f[:-3] for f in COMPONENTS], f"components wrong: {names}"
    assert rs["definition"]["backend"]["code"] == minify_js((HERE / "main.js").read_text())
    assert len(rs["input"]["groups"]) == 36, "expected 36 line groups"


if __name__ == "__main__":
    link, doc = build()
    check(link, doc)
    (HERE / "PUZZLE_LINK.txt").write_text(link + "\n")
    print(f"wrote PUZZLE_LINK.txt ({len(link)} chars)")
