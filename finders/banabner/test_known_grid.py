"""The pinned Banabner grid is accepted by the model and the checker, and a
broken copy is rejected by both (#761).

    uv run finders/banabner/test_known_grid.py

The model accepts a grid when, with every variable pinned to it, it is
FEASIBLE. Broken copies: one digit changed (the ticket's own), which breaks
sudoku as well as a Banabner rule; and two digit swaps that keep sudoku, each
breaking only one Banabner rule, so the model's gap and table are each
witnessed on their own.
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import banabner_finder as bf
import banabner_model as bm
from ortools.sat.python import cp_model as cp

KNOWN = json.loads((HERE / "known_grid.json").read_text())
FAIL = []


def check(name, ok, detail=""):
    print(f"{'ok  ' if ok else 'FAIL'}  {name}{'  ' + detail if detail else ''}")
    if not ok:
        FAIL.append(name)


def model_accepts(candidate):
    model = bm.Model()
    model.pin(*bf.to_maps(candidate))
    status, _, _ = model.solve(30, 1)
    return status in (cp.OPTIMAL, cp.FEASIBLE)


def with_digit(candidate, r, c, digit):
    rows = list(candidate.grid)
    rows[r] = rows[r][:c] + str(digit) + rows[r][c + 1 :]
    return bf.Candidate(tuple(rows), candidate.shading)


def swapped(candidate, a, b):
    table = str.maketrans({str(a): str(b), str(b): str(a)})
    return bf.Candidate(
        tuple(row.translate(table) for row in candidate.grid), candidate.shading
    )


def main():
    # 4 L-trominoes, 16 non-rectangular tetrominoes, 61 non-I pentominoes.
    sizes = [len(s) for s in bm.BANANA_SHAPES]
    check(
        "the banana shapes are the fixed non-rectangular 3-5 polyominoes",
        [sizes.count(k) for k in (3, 4, 5)] == [4, 16, 61],
    )
    check(
        "the nabner tables hold 35 3-sets, 15 4-sets and {1,3,5,7,9}",
        [len(bm.NABNER_SETS[k]) for k in (3, 4, 5)] == [35, 15, 1]
        and bm.NABNER_SETS[5] == [(1, 3, 5, 7, 9)],
    )
    known = bf.Candidate(tuple(KNOWN["grid"]), tuple(KNOWN["shading"]))
    check("the checker accepts the known grid", bf.check(known) == [])
    check("the model accepts the known grid", model_accepts(known))

    # r1c1 is 8 in a banana with 2 and 6; a 7 there sits next to the 6.
    one = with_digit(known, 0, 0, 7)
    bad = bf.check(one)
    check(
        "the checker rejects the one-digit copy on rule 6",
        any(line.startswith("rule 6") for line in bad),
        bad[0] if bad else "accepted",
    )
    check("the model rejects the one-digit copy", not model_accepts(one))

    # Two swaps keep sudoku and break one Banabner rule each: 5 and 7 only the
    # Dutch Chocolate gap, 8 and 9 only nabner.
    for (a, b), rule in (((5, 7), "rule 5"), ((8, 9), "rule 6")):
        copy = swapped(known, a, b)
        rules = {line.split(":")[0] for line in bf.check(copy)}
        check(f"the checker rejects the {a}/{b} swap on {rule} only", rules == {rule})
        check(f"the model rejects the {a}/{b} swap", not model_accepts(copy))

    print(f"\n{len(FAIL)} failing" if FAIL else "\nall checks pass")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
