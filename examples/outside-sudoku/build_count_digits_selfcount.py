# Build the self-counting CountDigits board (#581): every group's counter is
# also its own first target, the shape #578 made exact
# (docs/research/count-digits-gac/counter-in-targets/). The link ships twice,
# same board, one component swapped: the current CountDigitsGacComponent and
# the pre-#578 copy (self-count/CountDigitsGacComponent.pre578.js, from
# d0b1854). Same-board comparison per docs/real-app-timing.md.
#
# A group in `input.groups` is [counter, counter, *others]: the counter, then
# the targets with the counter as the first of them -- the colleague's spelling.
# gen.json's `cells` is the target list INCLUDING the counter (first), so the
# CP-SAT model counts it, and `groups_input` (imported) prepends the counter.
#
#   uv run examples/outside-sudoku/build_count_digits_selfcount.py
#       rebuild both links from the committed gen.json
#   uv run examples/outside-sudoku/build_count_digits_selfcount.py --search SEED --groups G --targets T --gen FILE
#       draw a fresh board (one-shot: CP-SAT's portfolio search is not seeded)
#
# Lives here, not in docs/research/, because that gate refuses a new .py there
# (check_research_python, #469).

import argparse
import json
import pathlib
import random
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from build_count_digits_demo import (
    CANDIDATE_NAME,
    N,
    backend_code,
    cage_constraints,
    groups_input,
    grow_region,
)
from build_sparse_count_digits import count_solutions, givens_of, model
from build_sparse_required_digits import box, write
from cpsat import SOLVED, solver
from minify import minify_file

HERE = pathlib.Path(__file__).parent
BOARD_DIR = HERE.parent.parent / "docs" / "research" / "count-digits-gac" / "self-count"
GEN = BOARD_DIR / "gen.json"
CURRENT = (
    HERE.parent.parent / "docs/research/count-digits-gac/CountDigitsGacComponent.js"
)
PRE578 = BOARD_DIR / "CountDigitsGacComponent.pre578.js"
# link name -> component source
VARIANTS = {"current": CURRENT, "pre578": PRE578}
EVENS = [2, 4, 6, 8]

RULES = (
    "Normal sudoku rules apply. Each coloured region "
    "counts the even digits in it, and the cell marked # in the same colour "
    "is that region's counter and one of its own cells: its digit equals "
    "how many cells of the region, itself included, hold an even digit."
)


def draw_group(rng, grid, taken, index, size):
    """A connected region of `size` free cells whose first cell is a counter:
    a cell whose solution digit equals the region's count of evens (the
    counter itself counted), off the region's top-left corner. None when this
    draw has no such cell."""
    cells = grow_region(rng, taken, size)
    if cells is None:
        return None
    count = sum(1 for r, c in cells if grid[r][c] in EVENS)
    picks = [p for p in cells if grid[p[0]][p[1]] == count]
    if not picks:
        return None
    # a cage label draws in the region's top-left cell: a counter there would
    # share that corner with the digit list
    picks = [p for p in picks if p != min(cells)]
    if not picks:
        return None
    counter = rng.choice(picks)
    rest = [p for p in cells if p != counter]
    return {
        "name": f"group {index + 1}",
        "values": EVENS,
        "counter": list(counter),
        "cells": [list(counter), *map(list, rest)],
    }


def search(seed, n_groups, size):
    rng = random.Random(seed)
    m, x = model([], {})
    for cell in x:
        m.AddHint(x[cell], rng.randrange(1, N + 1))
    sv = solver(30, reproducible=False, seed=seed, randomize=True)
    assert sv.Solve(m) in SOLVED
    grid = [[sv.Value(x[r, c]) for c in range(N)] for r in range(N)]
    groups, taken = [], set()
    for _attempt in range(5000):
        if len(groups) == n_groups:
            break
        g = draw_group(rng, grid, taken, len(groups), size)
        if g is not None:
            groups.append(g)
            taken |= {tuple(p) for p in g["cells"]}
    if len(groups) != n_groups:
        raise RuntimeError(f"only drew {len(groups)} of {n_groups} groups")
    givens = {(r, c): grid[r][c] for r in range(N) for c in range(N)}
    order = list(givens)
    rng.shuffle(order)
    carve_order = []
    for cell in order:
        trial = {k: v for k, v in givens.items() if k != cell}
        try:
            unique = count_solutions(groups, trial) == 1
        except TimeoutError:
            unique = False
        if unique:
            givens = trial
            carve_order.append(cell)
    return {
        "grid": grid,
        "groups": groups,
        "carve_order": [list(p) for p in carve_order],
        "carved": len(carve_order),
    }


def custom_constraint(gen, variant):
    name = f"CountDigits self-count ({variant})"
    return {
        "name": name,
        "type": 1000,
        "definition": {
            "name": name,
            "input": [{"id": "groups", "label": "Groups", "params": {"type": "raw"}}],
            "backend": {"type": "code", "code": backend_code(CANDIDATE_NAME)},
            "components": [
                {
                    "type": "code",
                    "name": CANDIDATE_NAME,
                    "code": minify_file(VARIANTS[variant], keep_comments=True),
                }
            ],
        },
        "input": {"groups": groups_input(gen)},
        "style": {},
    }


def build_doc(gen, variant):
    givens = givens_of(gen)
    cells = [
        {"value": gen["grid"][r][c], "given": True} if (r, c) in givens else {}
        for r in range(N)
        for c in range(N)
    ]
    return {
        "formatVersion": "1.6.0",
        "puzzle": {
            "name": f"CountDigits self-count ({variant})",
            "author": "",
            "type": "sudoku",
            "width": N,
            "height": N,
            "comment": RULES,
            "cells": cells,
            "constraints": [
                {"type": 0},
                {"type": 1, "regions": [box(r, c) for r in range(N) for c in range(N)]},
                *cage_constraints(gen),
                custom_constraint(gen, variant),
            ],
        },
    }


def build(out_dir=BOARD_DIR, gen_path=GEN):
    gen = json.loads(pathlib.Path(gen_path).read_text())
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for variant in VARIANTS:
        path = out_dir / f"PUZZLE_LINK_selfcount_{variant}.txt"
        write(build_doc(gen, variant), path)
        paths.append(path)
    return paths


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--search", type=int, metavar="SEED")
    p.add_argument("--gen", default=GEN)
    p.add_argument("--groups", type=int, default=5)
    p.add_argument(
        "--targets", type=int, default=8, help="cells per group, the counter included"
    )
    p.add_argument("--out")
    args = p.parse_args()
    if args.search is not None:
        pathlib.Path(args.gen).write_text(
            json.dumps(search(args.search, args.groups, args.targets)) + "\n"
        )
        print(f"wrote {args.gen}")
    else:
        for path in build(pathlib.Path(args.out) if args.out else BOARD_DIR, args.gen):
            print(f"wrote {path}")
