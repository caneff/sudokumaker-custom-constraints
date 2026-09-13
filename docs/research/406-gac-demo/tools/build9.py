"""Rebuild the GAC demo pair on a plain 9x9 board.

The first pair was cut from the Skyscrapers 11x11 document with the skyscraper
constraint deleted, so it carried an empty clue ring for no reason. This
builder keeps the same 25 givens, read from the committed without-GAC link, and
writes both links on a bare 9x9: boxes as regions, the Rows & Columns backend,
and for the `_with_gac` link the matching-based `AllDiffGacComponent` on every
row, column and box. Uniqueness is proved with CP-SAT here and the solution is
printed so the AutoStep readout can be checked against it.

    uv run docs/research/406-gac-demo/tools/build9.py docs/research/406-gac-demo
"""

import sys
from pathlib import Path

from ortools.sat.python import cp_model

root = Path(__file__).resolve().parent
repo = root.parents[3]
sys.path.insert(0, str(repo / "examples" / "_shared"))
from cpsat import SOLVED, has_second_solution, solver
from link_codec import decode_puzzle, encode_link

out = Path(sys.argv[1])
old = decode_puzzle((out / "PUZZLE_LINK_without_gac.txt").read_text().strip())
old_w = old["puzzle"]["width"]
inset = (old_w - 9) // 2
givens = {}
for i, cell in enumerate(old["puzzle"]["cells"]):
    r, c = divmod(i, old_w)
    if inset <= r < inset + 9 and inset <= c < inset + 9 and cell.get("given"):
        givens[(r - inset, c - inset)] = int(cell["value"])
print("givens carried over:", len(givens))


def prove_unique(givens):
    m = cp_model.CpModel()
    x = {(r, c): m.NewIntVar(1, 9, f"x{r}{c}") for r in range(9) for c in range(9)}
    for (r, c), v in givens.items():
        m.Add(x[r, c] == v)
    for i in range(9):
        m.AddAllDifferent([x[i, c] for c in range(9)])
        m.AddAllDifferent([x[r, i] for r in range(9)])
    for br in range(3):
        for bc in range(3):
            m.AddAllDifferent(
                [x[br * 3 + i, bc * 3 + j] for i in range(3) for j in range(3)]
            )
    s = solver(60)
    assert s.Solve(m) in SOLVED
    first = {k: s.Value(v) for k, v in x.items()}
    assert not has_second_solution(m, x, first, 60)
    return first


sol = prove_unique(givens)
print("unique; solution rows:")
for r in range(9):
    print("  " + "".join(str(sol[r, c]) for c in range(9)))


def make9(gac, title):
    d = {
        "formatVersion": old["formatVersion"],
        "puzzle": {
            "name": title,
            "author": "sudokumaker-custom-constraints",
            "type": "custom",
            "width": 9,
            "height": 9,
            "cells": [
                {"given": True, "value": givens[r, c]} if (r, c) in givens else {}
                for r in range(9)
                for c in range(9)
            ],
            "constraints": [
                {
                    "type": 1,
                    "regions": [
                        (r // 3) * 3 + (c // 3) for r in range(9) for c in range(9)
                    ],
                },
                {
                    "type": 1000,
                    "input": {},
                    "style": {},
                    "definition": {
                        "name": "Rows & Columns",
                        "input": [],
                        "backend": {
                            "type": "code",
                            "code": (root / "rowcol9-main.js").read_text(),
                        },
                        "components": [],
                    },
                },
                {"type": 0},
            ],
            "export": {"sudokuPad": {"useIncompleteGridAsSolution": True}},
            "comment": (
                "Normal sudoku rules apply. Press the AutoStep button (the "
                "run-to-fixpoint logical solver) and compare the two links: the "
                "only difference is the extra constraint."
            ),
        },
    }
    if gac:
        nm = "GAC all-different (Regin) on every row, column and box"
        d["puzzle"]["constraints"].append(
            {
                "name": nm,
                "type": 1000,
                "input": {},
                "style": {},
                "definition": {
                    "name": nm,
                    "input": [],
                    "backend": {
                        "type": "code",
                        "code": (root / "gac9-main.js").read_text(),
                    },
                    "components": [
                        {
                            "type": "code",
                            "name": "AllDiffGacComponent",
                            "code": (root / "AllDiffGacComponent.js").read_text(),
                        }
                    ],
                },
            }
        )
    link = encode_link(d)
    assert decode_puzzle(link) == d
    return link


(out / "PUZZLE_LINK_without_gac.txt").write_text(
    make9(False, "GAC demo - without the component") + "\n"
)
(out / "PUZZLE_LINK_with_gac.txt").write_text(
    make9(True, "GAC demo - with the component") + "\n"
)
print("wrote both 9x9 links")
