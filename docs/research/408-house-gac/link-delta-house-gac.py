# Bytes each all-different filter adds to a real link: its backend plus its
# component, minified as a builder ships them, appended as one more constraint
# to examples/skyscraper/PUZZLE_LINK.txt and re-encoded with the link codec.
# Run from the repo root: uv run --with lzstring docs/research/408-house-gac/link-delta-house-gac.py (#408)
import sys, json, pathlib, tempfile
sys.path.insert(0, "examples/_shared")
from minify import minify_file
from link_codec import decode_puzzle, encode_link
from lzstring import LZString
base = decode_puzzle(pathlib.Path("examples/skyscraper/PUZZLE_LINK.txt").read_text().strip())
n0 = len(encode_link(base))
def with_constraint(backend, comp):
    doc = json.loads(json.dumps(base))
    doc["puzzle"]["constraints"].append({"type": 1000, "definition": {"name": "House GAC", "input": [],
      "backend": {"type": "code", "code": minify_file(pathlib.Path(backend))},
      "components": [{"type": "code", "name": pathlib.Path(comp).stem, "code": minify_file(pathlib.Path(comp))}]},
      "input": {}, "style": {}})
    return len(encode_link(doc)) - n0
t = "docs/research/406-gac-demo/tools/"
print("base link", n0)
print("matching (AllDiffGacComponent + alldiff-main)", with_constraint(t + "alldiff-main.js", t + "AllDiffGacComponent.js"))
print("subsets  (HouseGacComponent + house-gac)", with_constraint("examples/_shared/house-gac.js", "examples/_shared/HouseGacComponent.js"))
# house-gac.js names HouseGacComponent; each other form ships under its own name.
for name in ["ReadableHouseGacComponent", "IncrementalHouseGacComponent", "NamedBitmaskHouseGacComponent"]:
    with tempfile.TemporaryDirectory() as tmp:
        backend = pathlib.Path(tmp) / "house-gac.js"
        backend.write_text(pathlib.Path("examples/_shared/house-gac.js").read_text().replace("HouseGacComponent", name))
        print(f"{name} + house-gac", with_constraint(str(backend), f"examples/_shared/{name}.js"))
for f in [t + "AllDiffGacComponent.js", "examples/_shared/HouseGacComponent.js", "examples/_shared/ReadableHouseGacComponent.js", "examples/_shared/IncrementalHouseGacComponent.js", "examples/_shared/NamedBitmaskHouseGacComponent.js"]:
    code = minify_file(pathlib.Path(f))
    print(f"alone: {pathlib.Path(f).name} minified {len(code)}, compressed {len(LZString.compressToEncodedURIComponent(code))}")
