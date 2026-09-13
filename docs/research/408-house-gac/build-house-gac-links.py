# Writes two links to try in the app: the shipped Skyscrapers frame board
# (examples/skyscraper/PUZZLE_LINK.txt) with every interior row, column and box
# filtered by `HouseGacComponent`, and the same with `TerseHouseGacComponent`.
# Nothing else about the board changes. Not shipped links -- #421 decides that.
# Run from the repo root: uv run --with lzstring docs/research/408-house-gac/build-house-gac-links.py (#408)
import sys

sys.path.insert(0, "examples/_shared")
sys.path.insert(0, "docs/research/408-house-gac")
from house_gac_links import BASE_LINK, FORMS, HERE, with_filter  # noqa: E402
from link_codec import decode_puzzle, encode_link  # noqa: E402

base = decode_puzzle(BASE_LINK.read_text().strip())
by_name = {component.stem: component for component in FORMS}
for name, out in [("HouseGacComponent", "PUZZLE_LINK_house_gac.txt"), ("TerseHouseGacComponent", "PUZZLE_LINK_terse.txt")]:
    link = encode_link(with_filter(base, by_name[name]))
    (HERE / out).write_text(link + "\n")
    print(f"{HERE / out}: {len(link)} characters")
