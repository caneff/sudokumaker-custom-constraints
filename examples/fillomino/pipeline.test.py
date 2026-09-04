"""The fillomino pipeline, end to end (#303 review).

One test drives the whole chain the example claims, with nothing stubbed:

  1. `generate.py sample` draws a fresh full grid, and CP-SAT proves that grid
     is the only one matching all 81 of its own cells -- the generator arm.
  2. CP-SAT proves the SHIPPED clue set (`gen.json`) has exactly one solution.
  3. The SHIPPED component solves that clue set offline, read back out of
     `PUZZLE_LINK.txt` -- `hunt.mjs board`, whose only propagator is
     `FillominoComponent.js`. It must reach `unique` and land on gen.json's
     grid.
  4. The link decodes with every non-given cell empty, and its givens are
     exactly gen.json's.

Every step above is covered somewhere on its own; what only this test covers is
that the four agree on ONE board -- the generator, the proof, the component and
the link cannot drift apart quietly.

Costs about 30 s: a CP-SAT sample, two proofs, and a 151k-node offline solve.

    uv run --with lzstring --with ortools examples/fillomino/pipeline.test.py
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

# ---- 1. the generator arm: a sampled grid is a fillomino grid ----
# The shipped instance's own call (README, "The board"). CP-SAT's portfolio is
# not reproducible run to run, so the grid is not asserted equal to gen.json's;
# what is asserted is that whatever it draws is a valid grid -- `unique` raises
# ValueError when no grid matches its givens.
generate.set_board(SIDE, CAP)
sampled = generate.sample(3, side=SIDE, cap=CAP)
assert generate.unique({p: sampled[p[0]][p[1]] for p in generate.CELLS}) is True

# ---- 2. the shipped clue set has exactly one solution ----
generate.set_board(SIDE, CAP)
assert generate.unique({p: int(SPEC["grid"][p[0]][p[1]]) for p in CLUES}) is True

# ---- 3. the shipped component closes the shipped clue set, offline ----
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

# ---- 4. the link opens clean ----
puzzle = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())["puzzle"]
assert (puzzle["width"], puzzle["height"]) == (SIDE, SIDE)
for i, cell in enumerate(puzzle["cells"]):
    r_, c_ = divmod(i, SIDE)
    if (r_, c_) in CLUES:
        assert cell == {"value": int(SPEC["grid"][r_][c_]), "given": True}, (r_, c_)
    else:
        assert cell == {}, f"non-given cell {r_},{c_} ships {cell}"

print("pipeline.test.py: sample -> proof -> component -> link all agree")
