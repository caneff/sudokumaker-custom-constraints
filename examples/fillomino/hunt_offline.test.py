"""Tests for the offline hunt's Python seams (#317): reading a committed link
back into a clue set, and CP-SAT resampling a few freed cells.

Run: uv run --with lzstring --with ortools examples/fillomino/hunt_offline.test.py
"""

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import generate
import hunt_link
import hunt_resample

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

# ---- Resampling frees cells and returns a DIFFERENT valid grid ----
GRID3 = [[1, 2, 2], [2, 1, 3], [2, 3, 3]]
freed = [[1, 1], [1, 2], [2, 1], [2, 2]]
got = hunt_resample.resample(GRID3, freed, seed=7)
assert got is not None, "the freed corner has another filling"
assert got != GRID3, "a mutation that changes nothing is not a mutation"
for r in range(3):
    for c in range(3):
        if [r, c] not in freed:
            assert got[r][c] == GRID3[r][c], f"pinned cell {r},{c} moved"
generate.set_board(3)
assert generate.unique({(r, c): got[r][c] for r, c in generate.CELLS}) is True

# ---- Freeing nothing has nothing to resample ----
assert hunt_resample.resample(GRID3, [], seed=7) is None

# ---- A grid whose freed cells admit no other filling reports None ----
assert hunt_resample.resample(GRID3, [[0, 0]], seed=7) is None

print("hunt_offline.test.py: all seams pass")
