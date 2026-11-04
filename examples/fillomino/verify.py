"""The shipped board's proof, by hand: `just verify-fillomino`.

CP-SAT proves `gen.json`'s clue set unique, and `PUZZLE_LINK.txt` decodes with
exactly those givens and every other cell empty. The proof takes minutes on a
board this size, so the gate does not run it (`pipeline.test.py` runs the same
`prove` on the 7x5 board); run it after every change to `gen.json` or its link,
and record the run in the README before sharing. See `docs/share-checklist.md`
§ 1.

    uv run examples/fillomino/verify.py
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


def prove(spec, link_text, tmp, offline_solve=True):
    height, width = len(spec["grid"]), len(spec["grid"][0])
    cap = spec.get("cap", max(width, height))
    clues = [tuple(p) for p in spec["clues"]]
    board = generate.Board.of(width, height, cap=cap)

    assert generate.unique(board, board.givens(spec)) is True

    if offline_solve:
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

        assert solved["grid"] == spec["grid"], (
            "the component solved to a different grid"
        )
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


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        prove(
            json.loads((HERE / "gen.json").read_text()),
            (HERE / "PUZZLE_LINK.txt").read_text().strip(),
            tmp,
            offline_solve=False,
        )
    print("verify.py: gen.json is unique and PUZZLE_LINK.txt carries exactly its givens")
