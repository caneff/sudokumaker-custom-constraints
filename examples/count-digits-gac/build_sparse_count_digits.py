# Build the sparse count-digits timing board: a plain 9x9 sudoku
# carrying a set of count-digits groups -- one counter cell whose digit is the
# number of cells in a large, scattered target group holding a digit from that
# group's set -- with the givens carved back until the app's solver actually
# searches.
#
# It exists to give CountDigitsGacComponent a real-app timing row against the
# built-in CountDigits, which is validate-only and prunes nothing
# (docs/research/bundle-api-reference.md, "CountDigits"). Unlike the sparse
# required-digits board next door, nothing here is confounded by the
# app's candidate-set map: `addConstraintComponent` special-cases House,
# SameDigit and RequiredDigits only, so a CountDigits registration buys the
# built-in no help a custom component gives up.
#
#   uv run examples/count-digits-gac/build_sparse_count_digits.py
#       rebuild both links from the committed gen.json
#   uv run examples/count-digits-gac/build_sparse_count_digits.py --carved K
#       set the board's depth -- how many of the gen's carve order it drops --
#       and rebuild. See `board_kit.givens_of`; the whole carve left the app's
#       solver unable to finish the baseline link at all
#       (docs/research/count-digits-gac/README.md, "Depth").
#   uv run examples/count-digits-gac/build_sparse_count_digits.py --keep-comments
#       write only PUZZLE_LINK_annotated.txt: the candidate link's
#       board and givens, with the component and backend code keeping every
#       comment, for a reader who opens it in SudokuMaker and reads the code
#       box. Same flag as examples/house-gac/build_link.py.
#   uv run examples/count-digits-gac/build_sparse_count_digits.py --search SEED
#       draw a fresh board (grid, groups, carve order) into --gen. The grid
#       comes from CP-SAT's portfolio search, which is not reproducible from
#       the seed: the committed gen.json is the artifact, this a one-shot.

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
    model,
)
from minify import minify_file, minify_js
from sm_document import code_constraint, write_link

HERE = pathlib.Path(__file__).parent
BOARD_DIR = HERE / "sparse"
GEN = BOARD_DIR / "gen.json"
BACKEND = BOARD_DIR / "main-sparse-global.js"
CONSTRAINT_NAME = "Sparse count digits"
# The groups are not drawn: they live in the constraint's code, so the text
# says so rather than promise an outline the document does not carry.
RULES = (
    "Normal sudoku rules apply. Timing board: the Sparse count digits "
    "constraint's code holds a set of scattered cell groups, each with a "
    "counter cell whose digit is the number of that group's cells holding one "
    "of the digits the code lists for it."
)


def draw_group(rng, grid, index, n_targets, n_digits):
    cells = rng.sample([(r, c) for r in range(N) for c in range(N)], n_targets)
    values = sorted(rng.sample(range(1, N + 1), n_digits))
    count = sum(1 for r, c in cells if grid[r][c] in values)
    if not 1 <= count <= N:
        return None
    outside = [
        (r, c)
        for r in range(N)
        for c in range(N)
        if grid[r][c] == count and (r, c) not in set(cells)
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
    groups = []
    for _attempt in range(2000):
        if len(groups) == n_groups:
            break
        g = draw_group(rng, grid, len(groups), n_targets, n_digits)
        if g is not None:
            groups.append(g)
    if len(groups) != n_groups:
        raise RuntimeError(f"only drew {len(groups)} of {n_groups} groups")
    return groups


def search(seed, n_groups=20, n_targets=14, n_digits=3):
    return search_board(
        seed,
        lambda rng, grid: make_groups(rng, grid, n_groups, n_targets, n_digits),
        model,
    )


def backend_code(gen, name, keep_comments=False):
    table = "const GROUPS = " + json.dumps(gen["groups"], separators=(",", ":")) + "\n"
    src = BACKEND.read_text().replace(CANDIDATE_NAME, name)
    return minify_js(table + src, base_dir=BACKEND.parent, keep_comments=keep_comments)


def build_doc(gen, name, keep_comments=False):
    components = (
        [(CANDIDATE_NAME, minify_file(COMPONENT, keep_comments))]
        if name == CANDIDATE_NAME
        else []
    )
    return board_doc(
        "Sparse count digits",
        RULES,
        gen,
        [
            code_constraint(
                CONSTRAINT_NAME,
                backend_code(gen, name, keep_comments),
                components,
                named=True,
            )
        ],
    )


def build(out_dir=BOARD_DIR, gen_path=GEN, keep_comments=False):
    gen = json.loads(pathlib.Path(gen_path).read_text())
    if keep_comments:
        names = ["PUZZLE_LINK_annotated.txt"]
        write_link(
            build_doc(gen, CANDIDATE_NAME, keep_comments=True), out_dir / names[0]
        )
        return names
    write_link(build_doc(gen, CANDIDATE_NAME), out_dir / "PUZZLE_LINK.txt")
    write_link(build_doc(gen, BASELINE_NAME), out_dir / "PUZZLE_LINK_original.txt")
    return ["PUZZLE_LINK.txt", "PUZZLE_LINK_original.txt"]


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--search", type=int, metavar="SEED")
    p.add_argument("--gen", default=GEN)
    p.add_argument("--groups", type=int, default=20)
    p.add_argument("--targets", type=int, default=14)
    p.add_argument("--digits", type=int, default=3)
    p.add_argument(
        "--carved",
        type=int,
        help="how many of gen.json's carve_order this board drops, written "
        "back into the gen before the rebuild -- the board's depth knob",
    )
    p.add_argument(
        "--keep-comments",
        action="store_true",
        help="write only PUZZLE_LINK_annotated.txt: the candidate link "
        "with every comment kept in the embedded code, the lint directive aside (#567)",
    )
    p.add_argument(
        "--out",
        help="directory for the links (default: sparse/ beside this script)",
    )
    args = p.parse_args()
    if args.search is not None:
        pathlib.Path(args.gen).write_text(
            json.dumps(search(args.search, args.groups, args.targets, args.digits))
            + "\n"
        )
        print(f"wrote {args.gen}")
    else:
        if args.carved is not None:
            if args.keep_comments:
                # --keep-comments writes only the annotated link, so the new
                # depth would leave both plain links on the old board.
                p.error(
                    "--carved rebuilds the plain links; run --keep-comments after it"
                )
            if args.out or str(args.gen) != str(GEN):
                # The depth is written back into the gen, and the committed gen
                # has to keep describing the committed links: a depth written
                # to one gen while the links are built from another, or into
                # another directory, leaves the two disagreeing, and the board
                # test reads that as a link that no longer reproduces.
                p.error(
                    "--carved rebuilds the committed board; it takes no --out and no --gen"
                )
            gen_path = pathlib.Path(args.gen)
            gen = json.loads(gen_path.read_text())
            gen["carved"] = args.carved
            gen_path.write_text(json.dumps(gen) + "\n")
            print(f"set carved={args.carved} in {args.gen}")
        written = build(
            pathlib.Path(args.out) if args.out else BOARD_DIR,
            args.gen,
            args.keep_comments,
        )
        print("wrote " + " and ".join(written))
