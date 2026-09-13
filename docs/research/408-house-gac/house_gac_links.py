# Puts one house GAC filter onto the shipped Skyscrapers frame board, as one
# more custom constraint: `examples/_shared/house-gac.js` as its backend (with
# the constructor name swapped for a non-shipped form) and the form's component
# file as its one component. Shared by `link-delta-house-gac.py`, which only
# measures, and `build-house-gac-links.py`, which writes links to try (#408).
import json
import pathlib
import sys

sys.path.insert(0, "examples/_shared")
from minify import minify_js, minify_file  # noqa: E402

HERE = pathlib.Path("docs/research/408-house-gac")
BASE_LINK = pathlib.Path("examples/skyscraper/PUZZLE_LINK.txt")
BACKEND = pathlib.Path("examples/_shared/house-gac.js")

# Every form of the rule, by the constructor name it ships under.
FORMS = {
    "HouseGacComponent": pathlib.Path("examples/_shared/HouseGacComponent.js"),
    "TerseHouseGacComponent": HERE / "TerseHouseGacComponent.js",
    "IncrementalHouseGacComponent": HERE / "IncrementalHouseGacComponent.js",
    "ReadableHouseGacComponent": HERE / "ReadableHouseGacComponent.js",
}


def with_filter(doc, backend, component):
    """A copy of `doc` with one more constraint: `backend` (default: house-gac.js
    registering `component`'s name) and `component`."""
    name = pathlib.Path(component).stem
    if backend is None:
        code = minify_js(BACKEND.read_text().replace("HouseGacComponent", name))
    else:
        code = minify_file(pathlib.Path(backend))
    out = json.loads(json.dumps(doc))
    out["puzzle"]["constraints"].append({
        "type": 1000,
        "definition": {
            "name": "House GAC",
            "input": [],
            "backend": {"type": "code", "code": code},
            "components": [{"type": "code", "name": name, "code": minify_file(pathlib.Path(component))}],
        },
        "input": {},
        "style": {},
    })
    return out
