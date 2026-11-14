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
    draw_groups,
    givens_of,
    search,
)
from sudoku_kit.cpsat import boxes, sudoku_model


def plain_model(groups, givens):
    m, x = sudoku_model(N, boxes(N, 3, 3))
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
    grid = [[(r * 3 + r // 3 + c) % N + 1 for c in range(N)] for r in range(N)]
    cells = [(r, c) for r in range(N) for c in range(N)]
    asked, gone = [], set()

    def unique(givens):
        missing = set(cells) - set(givens) - gone
        assert len(missing) == 1, "a cell no check cleared was carved"
        (cell,) = missing
        asked.append(cell)
        if cell == (0, 0):
            raise TimeoutError("no verdict")
        if cell[0] == 1:
            return False
        gone.add(cell)
        return True

    order = carve(random.Random(7), grid, unique)
    first_run = list(order)
    assert order != sorted(order), "carve order is row-major: the shuffle is gone"
    gone.clear()
    assert (0, 0) not in order, "a timed-out cell was carved"
    assert not any(r == 1 for r, _ in order), "a cell the check refused was carved"
    assert sorted(asked) == sorted(cells), "every cell is tried exactly once"
    assert len(order) == len(set(order)) == N * N - N - 1
    assert carve(random.Random(7), grid, unique) == first_run, "carve order not seeded"


def check_carve_trial_is_the_running_board():
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


def check_draw_groups():
    asked = []

    rng = random.Random(4)

    def draw_group(taken, index):
        asked.append(set(taken))
        cell = (rng.randrange(N), 0)
        return None if cell in taken or cell[0] == 0 else {"cells": [cell]}

    groups = draw_groups(3, draw_group, lambda g: set(g["cells"]), attempts=500)
    cells = [g["cells"][0] for g in groups]
    assert len(set(cells)) == 3 and all(r != 0 for r, _ in cells)
    assert asked[-1] == set(cells[:2]), "claimed cells not passed"
    # what `claimed` returns is what the next draw sees as taken
    seen = []
    draw_groups(
        2,
        lambda taken, index: seen.append(set(taken)) or {"n": index},
        lambda g: {("claimed", g["n"])},
        attempts=10,
    )
    assert seen == [set(), {("claimed", 0)}]
    try:
        draw_groups(2, lambda *a: None, lambda g: set(), 7)
    except RuntimeError as e:
        assert str(e) == "only drew 0 of 2 groups"
    else:
        raise AssertionError("an exhausted retry cap must raise")
    calls = []
    try:
        draw_groups(1, lambda *a: calls.append(1), lambda g: set(), 7)
    except RuntimeError:
        assert len(calls) == 7, "the cap is the attempt count"
    else:
        raise AssertionError("a draw that never succeeds must raise at the cap")


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
    # build_link.py is the example's `--refresh` command line (link_swap), not
    # a board builder: it calls build_required_digits' bodies by design.
    for path in sorted(HERE.glob("build_*.py")):
        if path.name.endswith(".test.py") or path.name == "build_link.py":
            continue
        for line in path.read_text().splitlines():
            m = re.match(r"\s*(?:from|import)\s+(build_\w+)", line)
            assert not m, f"{path.name} imports the builder {m.group(1)}"


if __name__ == "__main__":
    check_draw_grid()
    check_carve_policy()
    check_carve_trial_is_the_running_board()
    check_givens_of()
    check_draw_groups()
    check_count_solutions()
    check_search()
    check_board_doc()
    check_no_builder_imports_a_builder()
    print("ok")
