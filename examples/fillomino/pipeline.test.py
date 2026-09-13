"""The fillomino pipeline, end to end (#303 review).

One test drives the chain from the shipped board to the shipped link, with
nothing stubbed:

  1. CP-SAT proves the SHIPPED clue set (`gen.json`) has exactly one solution.
  2. The SHIPPED component solves that clue set offline, read back out of
     `PUZZLE_LINK.txt` -- `hunt.mjs board`, whose only propagator is
     `FillominoComponent.js`. It must reach `unique` and land on gen.json's
     grid.
  3. The link decodes with every non-given cell empty, and its givens are
     exactly gen.json's.

Every step above is covered somewhere on its own; what only this test covers is
that the three agree on ONE board -- the proof, the component and the link
cannot drift apart quietly.

The generator arm -- a sampled 9x9 grid is the only one matching all 81 of its
own cells -- used to run here too. It never touched the shipped board, and
`generate.self_check()` makes the same assertion on the same 9x9 shape, run by
generate.test.py, so it left this test in #411.

Costs about 17 s: one proof and a 151k-node offline solve.

    uv run examples/fillomino/pipeline.test.py
"""

import json
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

# ---- 1. the shipped clue set has exactly one solution ----
assert generate.unique(BOARD, {p: int(SPEC["grid"][p[0]][p[1]]) for p in CLUES}) is True

# ---- 2. the shipped component closes the shipped clue set, offline ----
# `hunt.mjs board` reads the LINK (not gen.json), solves from its givens with
# FillominoComponent.js as the only propagator, and refuses to write anything
# unless the verdict is `unique`.
with tempfile.TemporaryDirectory() as tmp:
    out = pathlib.Path(tmp) / "solved.json"
    r = subprocess.run(
        ["node", str(HERE / "hunt.mjs"), "board", str(HERE / "PUZZLE_LINK.txt"), out],
        capture_output=True,
        text=True,
    )
    assert r.returncode == 0, r.stderr
    assert "\tunique\t" in r.stdout, r.stdout
    solved = json.loads(out.read_text())

assert solved["grid"] == SPEC["grid"], "the component solved to a different grid"
assert sorted(map(tuple, solved["clues"])) == sorted(CLUES), (
    "the link's givens are not gen.json's clue set"
)

# ---- 3. the link opens clean ----
puzzle = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())["puzzle"]
assert (puzzle["width"], puzzle["height"]) == (SIDE, SIDE)
for i, cell in enumerate(puzzle["cells"]):
    r_, c_ = divmod(i, SIDE)
    if (r_, c_) in CLUES:
        assert cell == {"value": int(SPEC["grid"][r_][c_]), "given": True}, (r_, c_)
    else:
        assert cell == {}, f"non-given cell {r_},{c_} ships {cell}"

print("pipeline.test.py: proof -> component -> link all agree")
