import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import hunt_link

HERE = pathlib.Path(__file__).parent

spec = json.loads((HERE / "gen.json").read_text())
board = hunt_link.clues((HERE / "PUZZLE_LINK.txt").read_text())
height, width = len(spec["grid"]), len(spec["grid"][0])
want = {
    str(r * width + c): int(spec["grid"][r][c])
    for r, c in (tuple(p) for p in spec["clues"])
}
assert (board["width"], board["height"]) == (width, height), board
assert board["cap"] == spec.get("cap", max(width, height)), board["cap"]
assert board["givens"] == want, board["givens"]

wide = hunt_link.clues(
    (HERE / "timing-fixture-9x9-cap12-seed10-rung25.txt").read_text()
)
assert (wide["width"], wide["height"], wide["cap"]) == (9, 9, 12), wide

print("hunt_offline.test.py: the link seam passes")
