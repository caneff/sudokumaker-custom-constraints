# Generate a random Numbered Rooms fixture for the sweep (sweep.mjs). Numbered
# Rooms has no puzzle generator of its own — derive_fixture.py only decodes the
# one hand-made puzzle — so this builds a fresh, valid board from scratch: solve
# a random NxN sudoku with OR-Tools, then read each clue off the rule
# (clue = line[line[0] - 1]). Every board is a real, solvable Numbered Rooms
# puzzle; the sweep uses several to show the ours-vs-original node gap is
# board-specific, not a fixed win.
#
#   uv run --with ortools examples/numbered-rooms/gen_size.py 3   # seed 3 -> gen_9_s3.json
#
# The grid is (n+2)x(n+2): an interior nxn (rows/cols 1..n, cell index r*W + c)
# inside a one-cell frame that holds the 4*n outside clue cells. The schema
# matches gen_9.json (n, W, box, groups, boxes, solution, givens) so sweep.mjs
# reuses the recovery-probe geometry. Boards ship with zero givens: the sweep
# searches from the clues alone, the honest stress test.

import json
import pathlib
import random
import sys

from ortools.sat.python import cp_model

HERE = pathlib.Path(__file__).parent
N = 9
BH, BW = 3, 3
W = N + 2


def solve_random(seed):
    # A random linear objective picks one varied solution out of the many an
    # empty sudoku allows; the seed makes it reproducible.
    random.seed(seed)
    m = cp_model.CpModel()
    x = {(r, c): m.NewIntVar(1, N, f"x{r}_{c}") for r in range(N) for c in range(N)}
    for r in range(N):
        m.AddAllDifferent([x[r, c] for c in range(N)])
    for c in range(N):
        m.AddAllDifferent([x[r, c] for r in range(N)])
    for br in range(0, N, BH):
        for bc in range(0, N, BW):
            m.AddAllDifferent(
                [x[br + dr, bc + dc] for dr in range(BH) for dc in range(BW)]
            )
    m.Maximize(sum(random.randint(0, 9) * x[r, c] for r in range(N) for c in range(N)))
    s = cp_model.CpSolver()
    if s.Solve(m) not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        raise SystemExit("no sudoku solution")
    return {(r, c): s.Value(x[r, c]) for r in range(N) for c in range(N)}


def interior(r, c):
    return (r + 1) * W + (c + 1)  # 0-based interior cell -> framed index


def line_cells(side, i):
    # Nearest-clue-first, matching the hand-made groups' order.
    if side == "L":
        return [interior(i, c) for c in range(N)]
    if side == "R":
        return [interior(i, c) for c in range(N - 1, -1, -1)]
    if side == "T":
        return [interior(r, i) for r in range(N)]
    return [interior(r, i) for r in range(N - 1, -1, -1)]  # B


def clue_cell(side, i):
    if side == "L":
        return (i + 1) * W + 0
    if side == "R":
        return (i + 1) * W + (W - 1)
    if side == "T":
        return 0 * W + (i + 1)
    return (W - 1) * W + (i + 1)  # B


def build(seed):
    grid = solve_random(seed)

    def gval(framed):
        r, c = divmod(framed, W)
        return grid[(r - 1, c - 1)]

    solution = {}
    for r in range(N):
        for c in range(N):
            solution[str(interior(r, c))] = grid[(r, c)]

    groups = []
    for i in range(N):
        for side in ("L", "R", "T", "B"):
            line = line_cells(side, i)
            k = gval(line[0])
            cc = clue_cell(side, i)
            solution[str(cc)] = gval(line[k - 1])  # the Numbered Rooms rule
            groups.append({"cells": [cc, *line]})

    boxes = [
        sorted(interior(br + dr, bc + dc) for dr in range(BH) for dc in range(BW))
        for br in range(0, N, BH)
        for bc in range(0, N, BW)
    ]

    return {
        "n": N,
        "W": W,
        "box": [BH, BW],
        "groups": groups,
        "boxes": boxes,
        "solution": solution,
        "givens": [],
    }


def check(gen):
    sol = gen["solution"]

    def perm(idxs):
        return sorted(sol[str(i)] for i in idxs) == list(range(1, N + 1))

    for r in range(N):
        assert perm([interior(r, c) for c in range(N)]), f"row {r} not a permutation"
    for c in range(N):
        assert perm([interior(r, c) for r in range(N)]), f"col {c} not a permutation"
    for b in gen["boxes"]:
        assert perm(b), f"box {b} not a permutation"
    for g in gen["groups"]:
        clue = sol[str(g["cells"][0])]
        line = g["cells"][1:]
        k = sol[str(line[0])]
        assert 1 <= k <= len(line) and sol[str(line[k - 1])] == clue, f"rule broken {g}"


if __name__ == "__main__":
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    gen = build(seed)
    check(gen)
    out = HERE / f"gen_9_s{seed}.json"
    out.write_text(json.dumps(gen) + "\n")
    print(
        f"wrote {out.name}: n={N}, box {BH}x{BW}, {len(gen['groups'])} clues, 0 givens"
    )
