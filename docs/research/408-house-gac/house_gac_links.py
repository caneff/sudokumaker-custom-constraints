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

# Every form of the rule. A component's constructor name is its file stem.
FORMS = [
    pathlib.Path("examples/_shared/HouseGacComponent.js"),
    HERE / "TerseHouseGacComponent.js",
    HERE / "IncrementalHouseGacComponent.js",
    HERE / "ReadableHouseGacComponent.js",
]


def with_filter(doc, component, backend=None, keep_comments=False):
    """A copy of `doc` with one more constraint carrying `component`, registered
    by `backend`, or by house-gac.js with its constructor renamed to `component`'s
    stem when no backend is given.

    `keep_comments=True` embeds both files' code with every comment kept
    (only blank lines dropped) instead of the usual full strip -- the
    annotated-link path (#433)."""
    name = pathlib.Path(component).stem
    if backend is None:
        code = minify_js(
            BACKEND.read_text().replace("HouseGacComponent", name),
            keep_comments=keep_comments,
        )
    else:
        code = minify_file(pathlib.Path(backend), keep_comments=keep_comments)
    out = json.loads(json.dumps(doc))
    out["puzzle"]["constraints"].append({
        "type": 1000,
        "definition": {
            "name": "House GAC",
            "input": [],
            "backend": {"type": "code", "code": code},
            "components": [{
                "type": "code",
                "name": name,
                "code": minify_file(pathlib.Path(component), keep_comments=keep_comments),
            }],
        },
        "input": {},
        "style": {},
    })
    return out
