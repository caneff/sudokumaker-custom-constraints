"""The fillomino pipeline, end to end, nothing stubbed: CP-SAT proves the
shipped clue set (`gen.json`) unique, the shipped component solves it offline
from `PUZZLE_LINK.txt` through `hunt.mjs board`, and the link decodes with
exactly gen.json's givens and every other cell empty.

Each step is covered elsewhere on its own; what only this test covers is that
the three agree on ONE board -- the proof, the component and the link cannot
drift apart quietly.
"""

import json
import os
import pathlib
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

import generate
from link_codec import decode_puzzle

SPEC = json.loads((HERE / "gen.json").read_text())
SIDE = len(SPEC["grid"])
CAP = SPEC.get("cap", SIDE)
CLUES = [tuple(p) for p in SPEC["clues"]]

BOARD = generate.Board.of(SIDE, CAP)

assert generate.unique(BOARD, {p: int(SPEC["grid"][p[0]][p[1]]) for p in CLUES}) is True

# Run from outside the repo and without the VIRTUAL_ENV this test's own
# `uv run` exports, the way a user launches it, so hunt.mjs's Python half has
# to find the project environment from its own path.
with tempfile.TemporaryDirectory() as tmp:
    out = pathlib.Path(tmp) / "solved.json"
    r = subprocess.run(
        ["node", str(HERE / "hunt.mjs"), "board", str(HERE / "PUZZLE_LINK.txt"), out],
        capture_output=True,
        text=True,
        cwd=tmp,
        env={k: v for k, v in os.environ.items() if k != "VIRTUAL_ENV"},
    )
    assert r.returncode == 0, r.stderr
    assert "\tunique\t" in r.stdout, r.stdout
    solved = json.loads(out.read_text())

assert solved["grid"] == SPEC["grid"], "the component solved to a different grid"
assert sorted(map(tuple, solved["clues"])) == sorted(CLUES), (
    "the link's givens are not gen.json's clue set"
)

puzzle = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())["puzzle"]
assert (puzzle["width"], puzzle["height"]) == (SIDE, SIDE)
for i, cell in enumerate(puzzle["cells"]):
    r_, c_ = divmod(i, SIDE)
    if (r_, c_) in CLUES:
        assert cell == {"value": int(SPEC["grid"][r_][c_]), "given": True}, (r_, c_)
    else:
        assert cell == {}, f"non-given cell {r_},{c_} ships {cell}"

print("pipeline.test.py: proof -> component -> link all agree")
