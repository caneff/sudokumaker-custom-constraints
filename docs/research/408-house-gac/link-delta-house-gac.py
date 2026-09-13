# Bytes each all-different filter adds to a real link: its backend plus its
# component, minified as a builder ships them, appended as one more constraint
# to examples/skyscraper/PUZZLE_LINK.txt and re-encoded with the link codec.
# Run from the repo root: uv run --with lzstring docs/research/408-house-gac/link-delta-house-gac.py (#408)
import pathlib
import sys

sys.path.insert(0, "examples/_shared")
sys.path.insert(0, "docs/research/408-house-gac")
from house_gac_links import BASE_LINK, FORMS, with_filter  # noqa: E402
from link_codec import decode_puzzle, encode_link  # noqa: E402
from lzstring import LZString  # noqa: E402
from minify import minify_file  # noqa: E402

TOOLS = pathlib.Path("docs/research/406-gac-demo/tools")
base = decode_puzzle(BASE_LINK.read_text().strip())
n0 = len(encode_link(base))
print("base link", n0)
print(
    "AllDiffGacComponent + alldiff-main (matching)",
    len(encode_link(with_filter(base, TOOLS / "alldiff-main.js", TOOLS / "AllDiffGacComponent.js"))) - n0,
)
for name, component in FORMS.items():
    print(f"{name} + house-gac", len(encode_link(with_filter(base, None, component))) - n0)
for f in [TOOLS / "AllDiffGacComponent.js", *FORMS.values()]:
    code = minify_file(f)
    print(f"alone: {f.name} minified {len(code)}, compressed {len(LZString.compressToEncodedURIComponent(code))}")
