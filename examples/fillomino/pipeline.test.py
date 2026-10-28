"""The fillomino pipeline, end to end, nothing stubbed: CP-SAT proves a clue set
unique, the shipped component solves it offline from its link through
`hunt.mjs board`, and the link decodes with exactly the gen's givens and every
other cell empty.

It runs on two boards: the shipped one (`gen.json`, `PUZZLE_LINK.txt`) and a
rectangular one (`gen_15g.json`, `PUZZLE_LINK_15g.txt`, seven wide and five
high).

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
from sudoku_kit.link_codec import decode_puzzle


def run(spec, link_text, tmp):
    height, width = len(spec["grid"]), len(spec["grid"][0])
    cap = spec.get("cap", max(width, height))
    clues = [tuple(p) for p in spec["clues"]]
    board = generate.Board.of(width, height, cap=cap)

    assert generate.unique(board, board.givens(spec)) is True

    # Run from outside the repo and without the VIRTUAL_ENV this test's own
    # `uv run` exports, the way a user launches it, so hunt.mjs's Python half
    # has to find the project environment from its own path.
    link_path = pathlib.Path(tmp) / "link.txt"
    link_path.write_text(link_text + "\n")
    out = pathlib.Path(tmp) / "solved.json"
    r = subprocess.run(
        ["node", str(HERE / "hunt.mjs"), "board", str(link_path), str(out)],
        capture_output=True,
        text=True,
        cwd=tmp,
        env={k: v for k, v in os.environ.items() if k != "VIRTUAL_ENV"},
    )
    assert r.returncode == 0, r.stderr
    assert "\tunique\t" in r.stdout, r.stdout
    solved = json.loads(out.read_text())

    assert solved["grid"] == spec["grid"], "the component solved to a different grid"
    assert sorted(map(tuple, solved["clues"])) == sorted(clues), (
        "the link's givens are not the gen's clue set"
    )

    puzzle = decode_puzzle(link_text.strip())["puzzle"]
    assert (puzzle["width"], puzzle["height"]) == (width, height)
    # The app offers minDigit..maxDigit (default 1..9): the range the proof ran on.
    assert (puzzle.get("minDigit", 1), puzzle.get("maxDigit", 9)) == (1, cap), (
        f"the app offers digits other than the proof's 1-{cap}"
    )
    assert len(puzzle["cells"]) == width * height
    for i, cell in enumerate(puzzle["cells"]):
        r_, c_ = divmod(i, width)
        if (r_, c_) in clues:
            assert cell == {"value": spec["grid"][r_][c_], "given": True}, (r_, c_)
        else:
            assert cell == {}, f"non-given cell {r_},{c_} ships {cell}"


with tempfile.TemporaryDirectory() as tmp:
    shipped = json.loads((HERE / "gen.json").read_text())
    run(shipped, (HERE / "PUZZLE_LINK.txt").read_text().strip(), tmp)

    rect = json.loads((HERE / "gen_15g.json").read_text())
    assert len(rect["grid"]) != len(rect["grid"][0]), "gen_15g.json must not be square"
    run(rect, (HERE / "PUZZLE_LINK_15g.txt").read_text().strip(), tmp)

print("pipeline.test.py: proof -> component -> link all agree, square and rectangular")
