# The rule, stated once for both sides: the digit in a group's counter cell
# equals the number of the group's cells holding one of the group's listed
# digits. `model()` is the CP-SAT side; CountDigitsGacComponent.js is the JS
# side.

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from board_kit import N
from minify import minify_js
from ortools.sat.python import cp_model
from sudoku_kit.cpsat import boxes, sudoku_model

HERE = pathlib.Path(__file__).parent
COMPONENT = HERE / "CountDigitsGacComponent.js"
CANDIDATE_NAME = "CountDigitsGacComponent"
BASELINE_NAME = "CountDigitsComponent"
DEMO_BACKEND = HERE / "demo" / "main-demo.js"
COLOURS = ["#d0342c", "#1a6fd1", "#1f9d55", "#c77800", "#8a3ffc", "#0f8b8d"]


def model(groups, givens):
    """The board's CP-SAT model: sudoku plus, per group, the counter cell's
    digit equal to the number of target cells holding a listed digit. A group's
    `cells` are its targets; on a self-counting board the counter is the first
    of them."""
    m, x = sudoku_model(N, boxes(N, 3, 3))
    for (r, c), v in givens.items():
        m.Add(x[r, c] == v)
    for g in groups:
        listed = cp_model.Domain.FromValues(sorted(set(g["values"])))
        missing = cp_model.Domain.FromValues(
            sorted(set(range(1, N + 1)) - set(g["values"]))
        )
        hits = []
        for cell in (tuple(p) for p in g["cells"]):
            b = m.NewBoolVar(f"{g['name']}_{cell}")
            m.AddLinearExpressionInDomain(x[cell], listed).OnlyEnforceIf(b)
            m.AddLinearExpressionInDomain(x[cell], missing).OnlyEnforceIf(b.Not())
            hits.append(b)
        m.Add(sum(hits) == x[tuple(g["counter"])])
    return m, x


def grow_group(rng, taken, size):
    free = [(r, c) for r in range(N) for c in range(N) if (r, c) not in taken]
    cells = [rng.choice(free)]
    while len(cells) < size:
        edge = [
            (r + dr, c + dc)
            for r, c in cells
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))
            if 0 <= r + dr < N
            and 0 <= c + dc < N
            and (r + dr, c + dc) not in taken
            and (r + dr, c + dc) not in cells
        ]
        if not edge:
            return None
        cells.append(rng.choice(edge))
    return cells


def finish_group(rng, grid, cells, values, blocked, index):
    """The tail the demo and sparse generators share: count the drawn
    `cells` holding a listed digit, then pick the counter among the cells
    outside `blocked` whose solution digit is that count. None when the
    count is outside 1..N or no such cell exists. The rng call is the
    counter's `rng.choice`, last, so a generator's draw order is its own."""
    count = sum(1 for r, c in cells if grid[r][c] in values)
    if not 1 <= count <= N:
        return None
    outside = [
        (r, c)
        for r in range(N)
        for c in range(N)
        if grid[r][c] == count and (r, c) not in blocked
    ]
    if not outside:
        return None
    return {
        "name": f"group {index + 1}",
        "values": values,
        "counter": list(rng.choice(outside)),
        "cells": [list(p) for p in cells],
    }


def demo_backend_code(class_name):
    src = DEMO_BACKEND.read_text().replace(CANDIDATE_NAME, class_name)
    return minify_js(src, base_dir=DEMO_BACKEND.parent, keep_comments=True)


def sparse_backend_code(
    backend, gen, name, keep_comments=False, candidate=CANDIDATE_NAME
):
    """A sparse board's backend: the drawn groups as a `GROUPS` table ahead of
    the `backend` source, with the `candidate` class name (count-digits's unless a
    board names its own) swapped for `name`."""
    table = "const GROUPS = " + json.dumps(gen["groups"], separators=(",", ":")) + "\n"
    src = backend.read_text().replace(candidate, name)
    return minify_js(table + src, base_dir=backend.parent, keep_comments=keep_comments)


def groups_input(gen):
    """The drawn groups, in the document's own shape: cell ids on the 9-wide
    grid, `value` the group's digit list, and the counter cell FIRST, then the
    targets -- the convention the backend reads (main-demo.js). A board's
    constraints carry this same list, emitted here once."""
    return [
        {
            "cells": [r * N + c for r, c in [g["counter"], *g["cells"]]],
            "value": " ".join(map(str, g["values"])),
        }
        for g in gen["groups"]
    ]


def cage_constraints(gen):
    if len(gen["groups"]) > len(COLOURS):
        # colour is what ties a # counter to its group: a wrapped palette
        # would give two groups one colour
        raise ValueError(f"{len(gen['groups'])} groups, {len(COLOURS)} colours")
    out = []
    for i, g in enumerate(gen["groups"]):
        colour = COLOURS[i]
        digits = " ".join(map(str, g["values"]))
        out.append(
            {
                "type": 2001,
                "name": f"Group {i + 1}: count of {digits}",
                "cages": [
                    {"value": digits, "cells": [r * N + c for r, c in g["cells"]]},
                    {"value": "#", "cells": [g["counter"][0] * N + g["counter"][1]]},
                ],
                "style": {"text": {"color": colour}, "cage": {"color": colour}},
            }
        )
    return out
