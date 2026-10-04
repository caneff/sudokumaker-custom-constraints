# The steps every board builder in this example shares, so each builder keeps
# only its rule: the solution-grid draw, the carve loop, search, the givens a
# gen implies, and the document skeleton. A builder passes its rule in as a
# `model(groups, givens) -> (m, x)` and a `make_groups(rng, grid)`; nothing
# here knows what a group means.

import random

from cpsat import SOLVED, solve_unique, solver, sudoku_model

N = 9


def box(r, c):
    return (r // 3) * 3 + c // 3


def count_solutions(model, groups, givens, limit=60):
    """1 for a unique board, 2 for "at least two", 0 for none -- TimeoutError
    when the search reaches `limit` without a verdict."""
    m, x = model(groups, givens)
    first, unique = solve_unique(m, x, limit)
    if first is None:
        return 0
    return 1 if unique else 2


def givens_of(gen):
    """The board's given cells, as {(row, col): digit}.

    `carve_order` is every cell the search proved removable, in the order it
    removed them, and `carved` is how many of that prefix this board uses.
    Depth is that one number: uniqueness is monotone in the givens, so any
    prefix of a carve order that ended unique is unique too, and a shallower
    board is a rebuild rather than another search. (required-digits-gac's
    sparse gen.json is the exception to "the order it removed them": its
    order is the dropped cells row-major, and its one depth is the deepest.)
    """
    dropped = {tuple(p) for p in gen["carve_order"][: gen["carved"]]}
    return {
        (r, c): gen["grid"][r][c]
        for r in range(N)
        for c in range(N)
        if (r, c) not in dropped
    }


def draw_grid(rng, seed):
    """Not reproducible from the seed: the grid is written to a gen, and
    proved from there."""
    m, x = sudoku_model(N, (3, 3))
    for cell in x:
        m.AddHint(x[cell], rng.randrange(1, N + 1))
    sv = solver(30, reproducible=False, seed=seed, randomize=True)
    assert sv.Solve(m) in SOLVED
    return [[sv.Value(x[r, c]) for c in range(N)] for r in range(N)]


def carve(rng, grid, unique):
    """The cells of `grid` removable one after another, in the order removed.

    Starts from every cell given and tries the cells in `rng`'s order. A cell
    goes when `unique(givens)` is true for the board without it. A check that
    raises TimeoutError has no verdict, so the given stays: nothing is lost,
    and "no verdict" is never read as "unique"."""
    givens = {(r, c): grid[r][c] for r in range(N) for c in range(N)}
    order = list(givens)
    rng.shuffle(order)
    carve_order = []
    for cell in order:
        trial = {k: v for k, v in givens.items() if k != cell}
        try:
            removable = unique(trial)
        except TimeoutError:
            removable = False
        if removable:
            givens = trial
            carve_order.append(cell)
    return carve_order


def search(seed, make_groups, model, limit=60):
    rng = random.Random(seed)
    grid = draw_grid(rng, seed)
    groups = make_groups(rng, grid)
    order = carve(rng, grid, lambda g: count_solutions(model, groups, g, limit) == 1)
    return {
        "grid": grid,
        "groups": groups,
        "carve_order": [list(p) for p in order],
        "carved": len(order),
    }


def board_doc(name, comment, gen, constraints):
    """A 9x9 sudoku document: the gen's givens, rows and columns (type 0), the
    boxes (type 1), then the builder's own `constraints`."""
    givens = givens_of(gen)
    cells = [
        {"value": gen["grid"][r][c], "given": True} if (r, c) in givens else {}
        for r in range(N)
        for c in range(N)
    ]
    return {
        "formatVersion": "1.6.0",
        "puzzle": {
            "name": name,
            "author": "",
            "type": "sudoku",
            "width": N,
            "height": N,
            "comment": comment,
            "cells": cells,
            "constraints": [
                {"type": 0},
                {"type": 1, "regions": [box(r, c) for r in range(N) for c in range(N)]},
                *constraints,
            ],
        },
    }
