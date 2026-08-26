# Generate a random INTERACTABLE Numbered Rooms puzzle for the sweep (sweep.mjs).
# A real Numbered Rooms puzzle shows only SOME of its outside clues and a few
# interior givens; the solver deduces the rest, including the blank clues. That
# is the shape that separates ours from the original wrapper — the wrapper is
# inert on a blank clue, so it must GUESS every one. (An all-clues-shown board,
# by contrast, never makes the wrapper guess and only exercises the pair
# coupling.)
#
#   uv run --with ortools examples/numbered-rooms/gen_puzzle.py 3   # seed 3 -> gen_9_s3.json
#
# Build: solve a random 9x9 sudoku with OR-Tools, read every clue off the rule
# (clue = line[line[0] - 1]), then carve to a playable puzzle — show a handful of
# clues, add interior givens until the interior is uniquely solvable, then drop
# every redundant given and clue. Uniqueness is checked by the verify.py OR-Tools
# oracle (an independent model, not the component code). The fixture adds
# `shownClues` (the clue cells that are given; the rest are blank) to the
# gen_9.json schema; sweep.mjs seeds blank clues as unknown and branches them.

import json
import pathlib
import random
import sys

import verify  # sibling module: build_model / solutions uniqueness oracle
from ortools.sat.python import cp_model

HERE = pathlib.Path(__file__).parent
N = 9
BH, BW = 3, 3
W = N + 2
TARGET_CLUES = 14  # how many clues to show before adding givens; carved back after


def solve_random(seed):
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


def build_full(seed):
    grid = solve_random(seed)

    def gval(framed):
        r, c = divmod(framed, W)
        return grid[(r - 1, c - 1)]

    solution = {str(interior(r, c)): grid[(r, c)] for r in range(N) for c in range(N)}
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


def carve(gen, seed):
    """Pick shown clues + interior givens for a uniquely solvable interior, then
    drop every redundant one. Returns (shown_group_indices, givens)."""
    interior_cells = [r * W + c for r in range(1, N + 1) for c in range(1, N + 1)]
    all_clues = list(range(len(gen["groups"])))
    rng = random.Random(1000 + seed)  # separate stream from the sudoku solve

    def unique(active, givens):
        count, _ = verify.solutions(gen, N, interior_cells, active, set(givens))
        return count == 1

    shown = sorted(rng.sample(all_clues, TARGET_CLUES))
    givens = []
    pool = interior_cells[:]
    rng.shuffle(pool)
    for i in pool:
        if unique(shown, givens):
            break
        givens.append(i)
    if not unique(shown, givens):
        raise SystemExit(f"seed {seed}: no unique interior even with all givens")
    for i in list(givens):  # drop redundant givens
        if unique(shown, [g for g in givens if g != i]):
            givens.remove(i)
    for c in list(shown):  # drop redundant clues
        if unique([s for s in shown if s != c], givens):
            shown.remove(c)
    return shown, givens


def check(gen, shown, givens):
    sol = gen["solution"]
    interior_cells = [r * W + c for r in range(1, N + 1) for c in range(1, N + 1)]

    def perm(idxs):
        return sorted(sol[str(i)] for i in idxs) == list(range(1, N + 1))

    for r in range(1, N + 1):
        assert perm([r * W + c for c in range(1, N + 1)]), f"row {r} not a permutation"
    for c in range(1, N + 1):
        assert perm([r * W + c for r in range(1, N + 1)]), f"col {c} not a permutation"
    for b in gen["boxes"]:
        assert perm(b), f"box {b} not a permutation"
    for g in gen["groups"]:
        clue = sol[str(g["cells"][0])]
        line = g["cells"][1:]
        k = sol[str(line[0])]
        assert 1 <= k <= len(line) and sol[str(line[k - 1])] == clue, f"rule broken {g}"
    count, _ = verify.solutions(gen, N, interior_cells, shown, set(givens))
    assert count == 1, f"interior not unique: {count} completions"


if __name__ == "__main__":
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    gen = build_full(seed)
    shown, givens = carve(gen, seed)
    gen["shownClues"] = sorted(gen["groups"][c]["cells"][0] for c in shown)
    gen["givens"] = sorted(givens)
    check(gen, shown, givens)
    out = HERE / f"gen_9_s{seed}.json"
    out.write_text(json.dumps(gen) + "\n")
    blank = len(gen["groups"]) - len(shown)
    print(
        f"wrote {out.name}: {len(shown)} shown clues, {blank} blank, {len(givens)} givens, unique"
    )
