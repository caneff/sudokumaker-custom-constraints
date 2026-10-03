# board_kit.py: the steps every count/required-digits builder shares -- the
# solution-grid draw, the carve loop and its timeout policy, search, the
# givens a gen implies, the document skeleton -- and the rule that no builder
# imports another builder.
#
#   uv run examples/count-digits-gac/board_kit.test.py

import pathlib
import random
import re
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "_shared"))

from board_kit import (
    N,
    board_doc,
    box,
    carve,
    count_solutions,
    draw_grid,
    givens_of,
    search,
)
from cpsat import sudoku_model


def plain_model(groups, givens):
    m, x = sudoku_model(N, (3, 3))
    for (r, c), v in givens.items():
        m.Add(x[r, c] == v)
    return m, x


def check_draw_grid():
    grid = draw_grid(random.Random(1), 1)
    for i in range(N):
        assert sorted(grid[i]) == list(range(1, N + 1)), f"row {i}"
        assert sorted(row[i] for row in grid) == list(range(1, N + 1)), f"column {i}"
    for b in range(N):
        cells = [grid[r][c] for r in range(N) for c in range(N) if box(r, c) == b]
        assert sorted(cells) == list(range(1, N + 1)), f"box {b}"


def check_carve_policy():
    """A cell goes when the board stays unique without it; a cell whose check
    times out stays, the one way a carve can lie."""
    grid = [[(r * 3 + r // 3 + c) % N + 1 for c in range(N)] for r in range(N)]
    cells = [(r, c) for r in range(N) for c in range(N)]
    asked, gone = [], set()

    def unique(givens):
        missing = set(cells) - set(givens) - gone
        assert len(missing) == 1, "a cell no check cleared was carved"
        (cell,) = missing  # the cell this check is about
        asked.append(cell)
        if cell == (0, 0):
            raise TimeoutError("no verdict")
        if cell[0] == 1:  # row 1 is never removable
            return False
        gone.add(cell)
        return True

    order = carve(random.Random(7), grid, unique)
    first_run = list(order)
    gone.clear()
    assert (0, 0) not in order, "a timed-out cell was carved"
    assert not any(r == 1 for r, _ in order), "a cell the check refused was carved"
    assert sorted(asked) == sorted(cells), "every cell is tried exactly once"
    assert len(order) == len(set(order)) == N * N - N - 1
    assert carve(random.Random(7), grid, unique) == first_run, "carve order not seeded"


def check_carve_trial_is_the_running_board():
    """Each trial drops one more cell from the board the earlier ones left."""
    grid = [[1] * N for _ in range(N)]
    sizes = []

    def unique(givens):
        sizes.append(len(givens))
        return True

    carve(random.Random(0), grid, unique)
    assert sizes == list(range(N * N - 1, -1, -1))


def check_givens_of():
    gen = {
        "grid": [[1] * N for _ in range(N)],
        "carve_order": [[0, 0], [0, 1], [5, 5]],
        "carved": 2,
    }
    givens = givens_of(gen)
    assert (0, 0) not in givens and (0, 1) not in givens
    assert (5, 5) in givens and len(givens) == N * N - 2


def check_search():
    groups = [{"name": "group 1", "values": [1], "cells": [[0, 0]]}]
    gen = search(3, lambda rng, grid: groups, plain_model)
    assert gen["groups"] == groups
    assert gen["carved"] == len(gen["carve_order"]) > 0
    assert count_solutions(plain_model, gen["groups"], givens_of(gen)) == 1


def check_count_solutions():
    full = {
        (r, c): v
        for r, row in enumerate(draw_grid(random.Random(2), 2))
        for c, v in enumerate(row)
    }
    assert count_solutions(plain_model, [], full) == 1
    assert count_solutions(plain_model, [], {}) == 2


def check_board_doc():
    gen = {
        "grid": [[1] * N for _ in range(N)],
        "carve_order": [[r, c] for r in range(N) for c in range(N)],
        "carved": N * N - 1,
    }
    doc = board_doc("Name", "Rules.", gen, [{"type": 9}])
    p = doc["puzzle"]
    assert (p["name"], p["comment"], p["type"]) == ("Name", "Rules.", "sudoku")
    assert [c["type"] for c in p["constraints"]] == [0, 1, 9]
    assert p["constraints"][1]["regions"][0] == box(0, 0) == 0
    given = [i for i, cell in enumerate(p["cells"]) if cell.get("given")]
    assert given == [N * N - 1]


def check_no_builder_imports_a_builder():
    for path in sorted(HERE.glob("build_*.py")):
        if path.name.endswith(".test.py"):
            continue
        for line in path.read_text().splitlines():
            m = re.match(r"\s*(?:from|import)\s+(build_\w+)", line)
            assert not m, f"{path.name} imports the builder {m.group(1)}"


if __name__ == "__main__":
    check_draw_grid()
    check_carve_policy()
    check_carve_trial_is_the_running_board()
    check_givens_of()
    check_count_solutions()
    check_search()
    check_board_doc()
    check_no_builder_imports_a_builder()
    print("ok")
