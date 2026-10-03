# Build the CountDigits demo board (#568): a small, drawn sudoku carrying a few
# count-digits groups, with BOTH components in the one link -- the app's
# built-in CountDigits and CountDigitsGacComponent -- as two custom
# constraints identical but for the class their backend registers. One ships
# enabled, the other disabled; a reader flips them in the Elements panel
# (per-element menu -> Disable / Enable) and re-solves to feel the difference.
#
# The rule, stated once for both sides: the digit in a group's counter cell
# equals the number of the group's cells holding one of the group's listed
# digits. `count_board.model()` is the CP-SAT
# side; CountDigitsGacComponent.js is the JS side.
#
# The groups reach the solver the way an author's would, through `input.groups`
# (the local lane, docs/example-layout.md): `value` is the digit list, the first
# cell is the counter and the rest are the targets. Both constraints carry the
# same list, emitted once from gen.json (`groups_input`). The app draws nothing
# for those groups outside the constraint's own editor, so each group also gets
# a cosmetic cage round its connected cells, its digit list as the cage's label,
# and a one-cell cage of the same colour on the counter cell labelled "#"; the
# test pins the cages to `input.groups`.
#
# Wire note: the app saves a disabled constraint as `"disabled": true`
# (`enabled` is the in-memory name, `Ec.save` in the app's main bundle);
# writing `"enabled": false` is silently ignored.
#
#   uv run examples/count-digits-gac/build_count_digits_demo.py
#       rebuild the shipped link from the committed gen.json
#   uv run examples/count-digits-gac/build_count_digits_demo.py --search SEED
#       draw a fresh board into --gen (one-shot: the grid comes from CP-SAT's
#       portfolio search, which the seed does not reproduce)
#   ... --enabled builtin --out DIR
#       the same board with the other component switched on, for timing
#   ... --gen docs/research/count-digits-gac/demo/gen_counter_outside.json
#       the counter-outside board (counters outside their targets); its link
#       name follows the gen, so it never overwrites the shipped link
#
# Lives here, not in docs/research/, because that gate refuses a new .py there
# (check_research_python, #469).

import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from board_kit import N, board_doc
from board_kit import search as search_board
from count_board import (
    BASELINE_NAME,
    CANDIDATE_NAME,
    COMPONENT,
    RESEARCH_DIR,
    cage_constraints,
    demo_backend_code,
    groups_input,
    grow_group,
    model,
)
from minify import minify_file
from sm_document import code_constraint, write_link

HERE = pathlib.Path(__file__).parent
DEMO_DIR = RESEARCH_DIR / "demo"
GEN = DEMO_DIR / "gen.json"  # the shipped board: self-counting (#584)
# the counter-outside case: counters outside their own targets
OUTSIDE_GEN = DEMO_DIR / "gen_counter_outside.json"
OUTSIDE_LINK_NAME = "PUZZLE_LINK_demo_counter_outside.txt"
# name -> (constraint title, class its backend registers)
VARIANTS = {
    "builtin": ("CountDigits (built-in)", BASELINE_NAME),
    "gac": ("CountDigits (GAC)", CANDIDATE_NAME),
}
SHIPPED = "gac"


# Both shapes end with the toggle instruction.
TOGGLE = (
    " Two CountDigits elements carry the same rule -- "
    "the app's built-in and a pruning one; exactly one is enabled. Flip "
    "them in the Elements panel (the three-dot menu, Disable / Enable) "
    "and solve again to compare."
)
RULES_HEAD = (
    "Normal sudoku rules apply. Each coloured group lists digits in its "
    "corner. The cell marked # in the same colour is that group's "
)
RULES = (
    RULES_HEAD + "counter: its digit equals how many cells of the group hold "
    "one of the listed digits." + TOGGLE
)
# the shape authors write (#584): the counter is one of the cells it counts
SELFCOUNT_RULES = (
    RULES_HEAD + "counter and one of its own cells: its digit equals how "
    "many cells of the group, itself included, hold one of the listed "
    "digits." + TOGGLE
)


def is_selfcount(gen):
    """True when every group's counter is one of its own target cells (the
    self-counting shape); False for the counter-outside draw."""
    return all(
        tuple(g["counter"]) in {tuple(p) for p in g["cells"]} for g in gen["groups"]
    )


def draw_group(rng, grid, taken, index, n_targets, n_digits):
    """One drawn group over the solution `grid`: a connected group disjoint
    from `taken`, a digit set, and a counter cell outside every group whose
    solution digit is the count. None when this draw has no counter to offer."""
    cells = grow_group(rng, taken, n_targets)
    if cells is None:
        return None
    values = sorted(rng.sample(range(1, N + 1), n_digits))
    count = sum(1 for r, c in cells if grid[r][c] in values)
    if not 1 <= count <= N:
        return None
    blocked = taken | set(cells)
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


def make_groups(rng, grid, n_groups, n_targets, n_digits):
    """`n_groups` disjoint drawn groups over `grid`, each from `draw_group`."""
    groups, taken = [], set()
    for _attempt in range(5000):
        if len(groups) == n_groups:
            break
        g = draw_group(rng, grid, taken, len(groups), n_targets, n_digits)
        if g is not None:
            groups.append(g)
            taken |= {tuple(p) for p in g["cells"]} | {tuple(g["counter"])}
    if len(groups) != n_groups:
        raise RuntimeError(f"only drew {len(groups)} of {n_groups} groups")
    return groups


def search(seed, n_groups, n_targets, n_digits):
    """Draw a board: a solution grid, `n_groups` disjoint drawn groups over it,
    and givens carved (in seeded random order) while the board stays unique."""
    return search_board(
        seed,
        lambda rng, grid: make_groups(rng, grid, n_groups, n_targets, n_digits),
        model,
    )


def custom_constraint(gen, variant, enabled):
    title, class_name = VARIANTS[variant]
    components = (
        [(CANDIDATE_NAME, minify_file(COMPONENT, keep_comments=True))]
        if class_name == CANDIDATE_NAME
        else []
    )
    c = code_constraint(
        title,
        demo_backend_code(class_name),
        components,
        groups=groups_input(gen),
        named=True,
    )
    if not enabled:
        c["disabled"] = True
    return c


def build_doc(gen, enabled=SHIPPED):
    """The board's document: both components as custom constraints, `enabled`
    (a VARIANTS key) switched on and the other left `disabled`."""
    return board_doc(
        "CountDigits demo",
        SELFCOUNT_RULES if is_selfcount(gen) else RULES,
        gen,
        [
            *cage_constraints(gen),
            *(custom_constraint(gen, v, v == enabled) for v in VARIANTS),
        ],
    )


def link_name(gen_path, enabled):
    """The link's file name follows its gen, so a board never overwrites
    another's link: gen.json -> PUZZLE_LINK_demo, gen_<x>.json ->
    PUZZLE_LINK_demo_<x>; a non-shipped `enabled` adds its own suffix."""
    stem = pathlib.Path(gen_path).stem
    board = "" if pathlib.Path(gen_path) == GEN else "_" + stem.removeprefix("gen_")
    return f"PUZZLE_LINK_demo{board}{'' if enabled == SHIPPED else '_' + enabled}.txt"


def build(out_dir=DEMO_DIR, gen_path=GEN, enabled=SHIPPED):
    gen = json.loads(pathlib.Path(gen_path).read_text())
    name = link_name(gen_path, enabled)
    out_dir.mkdir(parents=True, exist_ok=True)
    write_link(build_doc(gen, enabled), out_dir / name)
    return out_dir / name


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--search", type=int, metavar="SEED")
    p.add_argument("--gen", default=GEN)
    p.add_argument("--groups", type=int, default=3)
    p.add_argument("--targets", type=int, default=10)
    p.add_argument("--digits", type=int, default=3)
    p.add_argument("--enabled", choices=sorted(VARIANTS), default=SHIPPED)
    p.add_argument("--out")
    args = p.parse_args()
    if args.search is not None:
        pathlib.Path(args.gen).write_text(
            json.dumps(search(args.search, args.groups, args.targets, args.digits))
            + "\n"
        )
        print(f"wrote {args.gen}")
    else:
        out = build(
            pathlib.Path(args.out) if args.out else DEMO_DIR,
            args.gen,
            args.enabled,
        )
        print(f"wrote {out}")
