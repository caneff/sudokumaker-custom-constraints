"""Tests for the offline hunt's Python seam (#317): reading a committed link
back into the clue set the scorer reads.

Run: uv run --with lzstring examples/fillomino/hunt_offline.test.py
"""

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import hunt_link

HERE = pathlib.Path(__file__).parent

# ---- A link reads back as exactly the clue set its gen JSON records ----
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

# ---- A wide-cap fixture reports the cap the link declares, not the side ----
wide = hunt_link.clues(
    (HERE / "timing-fixture-9x9-cap12-seed10-rung25.txt").read_text()
)
assert (wide["side"], wide["cap"]) == (9, 12), wide

print("hunt_offline.test.py: the link seam passes")
