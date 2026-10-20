# The squishdoku rules as a CP-SAT model, for the proofs and the puzzle
# generator. Two boards share them:
#
#   SQUISH    7x7, digits 1-9; nine 3x3 boxes at rows and columns 0-2, 2-4, 4-6
#             overlap on lines 2 and 4. Rows and columns hold no repeats.
#   EMBEDDED  the same 7x7 on r2c2-r8c8 of a 9x9 Latin square (rows and columns
#             hold 1-9, no 3x3 boxes of its own).
#
# Cells are numbered row-major, `r * width + c`.

import itertools
import json
import pathlib
import random
import subprocess
from dataclasses import dataclass

from ortools.sat.python import cp_model
from sudoku_kit.cpsat import has_second_solution, solver

HERE = pathlib.Path(__file__).parent
REGISTERED_HOUSES = HERE / "registered-houses.mjs"

DIGITS = range(1, 10)


@dataclass(frozen=True)
class Board:
    width: int
    # The top-left row (and column) of each of the three box bands.
    box_starts: tuple[int, ...]

    @property
    def cells(self):
        return self.width * self.width

    def boxes(self):
        return [
            [(r + dr) * self.width + c + dc for dr in range(3) for dc in range(3)]
            for r in self.box_starts
            for c in self.box_starts
        ]

    def lines(self):
        w = self.width
        rows = [[r * w + c for c in range(w)] for r in range(w)]
        cols = [[r * w + c for r in range(w)] for c in range(w)]
        return rows + cols

    def groups(self):
        return self.boxes() + self.lines()


SQUISH = Board(7, (0, 2, 4))
EMBEDDED = Board(9, (1, 3, 5))


def model(board):
    """(m, x): the board's rules with digits 1-9 in every cell."""
    m = cp_model.CpModel()
    x = [m.NewIntVar(1, 9, f"x{i}") for i in range(board.cells)]
    for group in board.groups():
        m.AddAllDifferent([x[i] for i in group])
    return m, x


def registered_houses(backend):
    """The houses a backend file registers, `[{"name", "cells"}, ...]`, read
    by running it under Node with HouseComponent recorded. Raises when the
    backend registers anything but HouseComponents."""
    out = subprocess.run(
        ["node", str(REGISTERED_HOUSES), str(backend)],
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return json.loads(out)


def can_repeat(board, i, j):
    """Can cells i and j hold the same digit under the board's rules?"""
    m, x = model(board)
    m.Add(x[i] == x[j])
    return solver(60).Solve(m) in (cp_model.OPTIMAL, cp_model.FEASIBLE)


def unforced_pairs(board, cells):
    """The pairs of `cells` that can hold the same digit under the board's
    rules: empty when `cells` is a house the rules force. A pair already
    sharing a row, column or box is forced by the model itself and skipped."""
    groups = board.groups()
    return [
        (i, j)
        for i, j in itertools.combinations(cells, 2)
        if not any(i in g and j in g for g in groups) and can_repeat(board, i, j)
    ]


def generate(board, seed):
    """(grid, givens) of a unique puzzle: a random solution, then givens
    removed in random order while the solution stays the only one. `givens`
    is `{cell: digit}`; the removal is greedy, so the result is minimal."""
    rng = random.Random(seed)
    m, x = model(board)
    s = solver(60, reproducible=False, seed=seed, randomize=True)
    assert s.Solve(m) in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    grid = {i: s.Value(v) for i, v in enumerate(x)}
    givens = dict(grid)
    for cell in rng.sample(range(board.cells), board.cells):
        trial = {a: b for a, b in givens.items() if a != cell}
        m, x = model(board)
        for a, b in trial.items():
            m.Add(x[a] == b)
        if not has_second_solution(m, dict(enumerate(x)), grid, 60):
            givens = trial
    return grid, givens


def has_one_solution(board, givens):
    """Does the board, with `givens` ({cell: digit}) posted, have exactly one
    solution? Raises TimeoutError when CP-SAT reaches no verdict."""
    m, x = model(board)
    for cell, digit in givens.items():
        m.Add(x[cell] == digit)
    s = solver(60)
    status = s.Solve(m)
    if status == cp_model.UNKNOWN:
        raise TimeoutError("CP-SAT hit the 60s limit; no verdict")
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return False
    first = {i: s.Value(v) for i, v in enumerate(x)}
    return not has_second_solution(m, dict(enumerate(x)), first, 60)
