import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import hunt_link

HERE = pathlib.Path(__file__).parent

spec = json.loads((HERE / "gen.json").read_text())
board = hunt_link.clues((HERE / "PUZZLE_LINK.txt").read_text())
side = len(spec["grid"])
want = {
    str(r * side + c): int(spec["grid"][r][c])
    for r, c in (tuple(p) for p in spec["clues"])
}
assert board["side"] == side, board["side"]
assert board["cap"] == spec.get("cap", side), board["cap"]
assert board["givens"] == want, board["givens"]

wide = hunt_link.clues(
    (HERE / "timing-fixture-9x9-cap12-seed10-rung25.txt").read_text()
)
assert (wide["side"], wide["cap"]) == (9, 12), wide

print("hunt_offline.test.py: the link seam passes")
