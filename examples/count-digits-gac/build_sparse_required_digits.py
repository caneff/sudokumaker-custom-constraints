# Build the sparse required-digits timing board: a plain 9x9 sudoku
# carrying 20 overlapping 9-cell groups that are not houses, each required
# to hold 5 given digits, with the givens carved back until the app's solver
# actually searches (the defaults below draw that shape; fewer or smaller
# groups close in 0ms, more leave the built-in timing out). It exists to give RequiredDigitsGacComponent a real-app
# timing row on the shape the offline bench says it wins on (a sparse, large
# group -- docs/research/required-digits-gac/README.md), which the Outside
# Sudoku wrapper board (build_required_digits.py) could not surface.
#
# The rule, stated once for both sides: every listed digit appears in at
# least one cell of its group (the built-in RequiredDigitsComponent's own
# rule; the group is NOT all-different). `model()` below is the CP-SAT side;
# RequiredDigitsGacComponent.js is the JS side.
#
#   uv run examples/count-digits-gac/build_sparse_required_digits.py
#       rebuild both links from the committed gen.json
#   uv run examples/count-digits-gac/build_sparse_required_digits.py --search SEED
#       draw a fresh board (grid, groups, carved givens) into --gen. The
#       grid comes from CP-SAT's portfolio search, which is not reproducible
#       from the seed: the committed gen.json is the artifact, this a one-shot.

import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from board_kit import N, board_doc, box
from board_kit import search as search_board
from cpsat import sudoku_model
from minify import minify_file, minify_js
from sm_document import code_constraint, write_link

HERE = pathlib.Path(__file__).parent
BOARD_DIR = HERE / "required-digits" / "sparse"
GEN = BOARD_DIR / "gen.json"
BACKEND = BOARD_DIR / "main-sparse-global.js"
COMPONENT = HERE / "RequiredDigitsGacComponent.js"
CANDIDATE_NAME = "RequiredDigitsGacComponent"
BASELINE_NAME = "RequiredDigitsComponent"
CONSTRAINT_NAME = "Sparse required digits"
# The groups are not drawn: they live in the constraint's code, so the text
# says so rather than promise an outline the document does not carry.
RULES = (
    "Normal sudoku rules apply. Timing board: the Sparse required digits "
    "constraint's code holds 20 hidden 9-cell groups, each of which must "
    "contain the digits the code lists for it, at least once each."
)


def is_house(cells):
    return (
        len({r for r, _ in cells}) == 1
        or len({c for _, c in cells}) == 1
        or len({box(r, c) for r, c in cells}) == 1
    )


def model(groups, givens):
    m, x = sudoku_model(N, (3, 3))
    for (r, c), v in givens.items():
        m.Add(x[r, c] == v)
    for g in groups:
        cells = [tuple(p) for p in g["cells"]]
        for d in set(g["values"]):
            hits = []
            for cell in cells:
                b = m.NewBoolVar(f"g{cell}_{d}")
                m.Add(x[cell] == d).OnlyEnforceIf(b)
                m.Add(x[cell] != d).OnlyEnforceIf(b.Not())
                hits.append(b)
            m.Add(sum(hits) >= g["values"].count(d))
    return m, x


def snake(rng, taken):
    for _ in range(2000):
        cur = (rng.randrange(N), rng.randrange(N))
        if cur in taken:
            continue
        path = [cur]
        while len(path) < N:
            r, c = path[-1]
            nxt = [
                p
                for p in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1))
                if 0 <= p[0] < N and 0 <= p[1] < N and p not in taken and p not in path
            ]
            if not nxt:
                break
            path.append(rng.choice(nxt))
        if (
            len(path) == N
            and len({box(r, c) for r, c in path}) >= 3
            and not is_house(path)
        ):
            return path
    raise RuntimeError("no snake found")


def make_groups(rng, grid, n_groups, n_required, overlap):
    taken, groups = set(), []
    for i in range(n_groups):
        cells = snake(rng, set() if overlap else taken)
        taken.update(cells)
        present = sorted({grid[r][c] for r, c in cells})
        if len(present) < n_required:
            raise ValueError(
                f"a snake holds {len(present)} distinct digits, fewer than "
                f"--required {n_required}: try another seed"
            )
        groups.append(
            {
                "name": f"group {i + 1}",
                "values": sorted(rng.sample(present, n_required)),
                "cells": [list(p) for p in cells],
            }
        )
    return groups


def search(seed, n_groups=20, n_required=5, overlap=True):
    return search_board(
        seed,
        lambda rng, grid: make_groups(rng, grid, n_groups, n_required, overlap),
        model,
    )


def backend_code(gen, name):
    table = "const GROUPS = " + json.dumps(gen["groups"], separators=(",", ":")) + "\n"
    src = BACKEND.read_text().replace(CANDIDATE_NAME, name)
    return minify_js(table + src, base_dir=BACKEND.parent)


def build_doc(gen, name):
    components = (
        [(CANDIDATE_NAME, minify_file(COMPONENT))] if name == CANDIDATE_NAME else []
    )
    return board_doc(
        "Sparse required digits",
        RULES,
        gen,
        [
            code_constraint(
                CONSTRAINT_NAME, backend_code(gen, name), components, named=True
            )
        ],
    )


def build(out_dir=BOARD_DIR, gen_path=GEN):
    gen = json.loads(pathlib.Path(gen_path).read_text())
    write_link(build_doc(gen, CANDIDATE_NAME), out_dir / "PUZZLE_LINK.txt")
    write_link(build_doc(gen, BASELINE_NAME), out_dir / "PUZZLE_LINK_original.txt")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--search", type=int, metavar="SEED")
    p.add_argument("--gen", default=GEN)
    p.add_argument("--groups", type=int, default=20)
    p.add_argument("--required", type=int, default=5)
    p.add_argument(
        "--disjoint",
        dest="overlap",
        action="store_false",
        help="keep groups from sharing cells (default: they may)",
    )
    p.add_argument(
        "--out",
        help="directory for the links (default: required-digits/sparse/ beside this script)",
    )
    args = p.parse_args()
    if args.search is not None:
        pathlib.Path(args.gen).write_text(
            json.dumps(search(args.search, args.groups, args.required, args.overlap))
            + "\n"
        )
        print(f"wrote {args.gen}")
    else:
        build(pathlib.Path(args.out) if args.out else BOARD_DIR, args.gen)
        print("wrote PUZZLE_LINK.txt and PUZZLE_LINK_original.txt")
