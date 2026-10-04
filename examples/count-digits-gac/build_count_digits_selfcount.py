# Build the self-counting CountDigits board: every group's counter is also its
# own first target (docs/research/count-digits-gac/counter-in-targets/). The
# link ships twice, same board, one component swapped: the current
# CountDigitsGacComponent and the copy from before it handled a self-listed
# counter (self-count/original/CountDigitsGacComponent.pre578.js, from d0b1854).
# Same-board comparison per docs/real-app-timing.md.
#
# A group in `input.groups` is [counter, counter, *others]: the counter, then
# the targets with the counter as the first of them -- the colleague's spelling.
# gen.json's `cells` is the target list INCLUDING the counter (first), so the
# CP-SAT model counts it, and `count_board.groups_input` prepends the counter.
#
#   uv run examples/count-digits-gac/build_count_digits_selfcount.py
#       rebuild both links from the committed gen.json
#   uv run examples/count-digits-gac/build_count_digits_selfcount.py --search SEED --groups G --targets T --gen FILE
#       draw a fresh board (one-shot: CP-SAT's portfolio search is not seeded)

import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from board_kit import board_doc
from board_kit import search as search_board
from count_board import (
    CANDIDATE_NAME,
    cage_constraints,
    demo_backend_code,
    groups_input,
    grow_group,
    model,
)
from count_board import (
    COMPONENT as CURRENT,
)
from minify import minify_file
from sm_document import code_constraint, write_link

HERE = pathlib.Path(__file__).parent
BOARD_DIR = HERE / "self-count"
GEN = BOARD_DIR / "gen.json"
PRE578 = BOARD_DIR / "original" / "CountDigitsGacComponent.pre578.js"
VARIANTS = {"current": CURRENT, "pre578": PRE578}
# The pre-#578 component is the baseline the current one is timed against.
LINK_NAMES = {"current": "PUZZLE_LINK.txt", "pre578": "PUZZLE_LINK_original.txt"}
EVENS = [2, 4, 6, 8]

RULES = (
    "Normal sudoku rules apply. Each coloured group "
    "counts the even digits in it, and the cell marked # in the same colour "
    "is that group's counter and one of its own cells: its digit equals "
    "how many cells of the group, itself included, hold an even digit."
)


def draw_group(rng, grid, taken, index, size):
    cells = grow_group(rng, taken, size)
    if cells is None:
        return None
    count = sum(1 for r, c in cells if grid[r][c] in EVENS)
    picks = [p for p in cells if grid[p[0]][p[1]] == count]
    if not picks:
        return None
    # a cage label draws in the group's top-left cell: a counter there would
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


def make_groups(rng, grid, n_groups, size):
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
    return groups


def search(seed, n_groups, size):
    return search_board(
        seed, lambda rng, grid: make_groups(rng, grid, n_groups, size), model
    )


def custom_constraint(gen, variant):
    return code_constraint(
        f"CountDigits self-count ({variant})",
        demo_backend_code(CANDIDATE_NAME),
        [(CANDIDATE_NAME, minify_file(VARIANTS[variant], keep_comments=True))],
        groups=groups_input(gen),
        named=True,
    )


def build_doc(gen, variant):
    return board_doc(
        f"CountDigits self-count ({variant})",
        RULES,
        gen,
        [*cage_constraints(gen), custom_constraint(gen, variant)],
    )


def build(out_dir=BOARD_DIR, gen_path=GEN):
    gen = json.loads(pathlib.Path(gen_path).read_text())
    out_dir.mkdir(parents=True, exist_ok=True)
    paths = []
    for variant in VARIANTS:
        path = out_dir / LINK_NAMES[variant]
        write_link(build_doc(gen, variant), path)
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
