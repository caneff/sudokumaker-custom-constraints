# Build the sparse count-digits timing board (#543): a plain 9x9 sudoku
# carrying a set of count-digits groups -- one counter cell whose digit is the
# number of cells in a large, scattered target group holding a digit from that
# group's set -- with the givens carved back until the app's solver actually
# searches.
#
# It exists to give CountDigitsGacComponent a real-app timing row against the
# built-in CountDigits, which is validate-only and prunes nothing
# (docs/research/bundle-api-reference.md, "CountDigits"). Unlike the sparse
# required-digits board next door (#541), nothing here is confounded by the
# app's candidate-set map: `addConstraintComponent` special-cases House,
# SameDigit and RequiredDigits only, so a CountDigits registration buys the
# built-in no help a custom component gives up.
#
# The rule, stated once for both sides: the digit in the counter cell equals
# the number of the group's target cells whose digit is in the group's set.
# `model()` below is the CP-SAT side; CountDigitsGacComponent.js is the JS side.
#
#   uv run examples/outside-sudoku/build_sparse_count_digits.py
#       rebuild both links from the committed gen.json
#   uv run examples/outside-sudoku/build_sparse_count_digits.py --carved K
#       set the board's depth -- how many of the gen's carve order it drops --
#       and rebuild. See `givens_of`.
#   uv run examples/outside-sudoku/build_sparse_count_digits.py --search SEED
#       draw a fresh board (grid, groups, carve order) into --gen. The grid
#       comes from CP-SAT's portfolio search, which is not reproducible from
#       the seed: the committed gen.json is the artifact, this a one-shot.
#
# Lives here, not in docs/research/, because that gate refuses a new .py there
# (check_research_python, #469); it sits beside build_sparse_required_digits.py,
# whose board shape and rows-and-columns base it reuses directly.

import argparse
import json
import pathlib
import random
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from build_sparse_required_digits import box, write
from cpsat import SOLVED, forbid, solver
from minify import minify_file, minify_js
from ortools.sat.python import cp_model

HERE = pathlib.Path(__file__).parent
RESEARCH_DIR = HERE.parent.parent / "docs" / "research" / "count-digits-gac" / "sparse"
GEN = RESEARCH_DIR / "gen.json"
BACKEND = RESEARCH_DIR / "main-sparse-global.js"
COMPONENT = (
    HERE.parent.parent / "docs/research/count-digits-gac/CountDigitsGacComponent.js"
)
CANDIDATE_NAME = "CountDigitsGacComponent"
BASELINE_NAME = "CountDigitsComponent"
CONSTRAINT_NAME = "Sparse count digits"
# The groups are not drawn: they live in the constraint's code, so the text
# says so rather than promise an outline the document does not carry.
RULES = (
    "Normal sudoku rules apply. Timing board: the Sparse count digits "
    "constraint's code holds a set of scattered cell groups, each with a "
    "counter cell whose digit is the number of that group's cells holding one "
    "of the digits the code lists for it."
)

N = 9


def model(groups, givens):
    """The board's CP-SAT model: sudoku plus, per group, the counter cell's
    digit equal to the number of target cells holding a listed digit."""
    m = cp_model.CpModel()
    x = {(r, c): m.NewIntVar(1, N, f"x{r}{c}") for r in range(N) for c in range(N)}
    for i in range(N):
        m.AddAllDifferent([x[i, c] for c in range(N)])
        m.AddAllDifferent([x[r, i] for r in range(N)])
    for b in range(N):
        m.AddAllDifferent(
            [x[r, c] for r in range(N) for c in range(N) if box(r, c) == b]
        )
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


def count_solutions(groups, givens, limit=60):
    """1 for a unique board, 2 for "at least two" -- TimeoutError if no verdict."""
    m, x = model(groups, givens)
    s = solver(limit)
    status = s.Solve(m)
    if status == cp_model.UNKNOWN:
        raise TimeoutError("no verdict")
    if status not in SOLVED:
        return 0
    first = {k: s.Value(v) for k, v in x.items()}
    forbid(m, x, first)
    st = solver(limit).Solve(m)
    if st == cp_model.UNKNOWN:
        raise TimeoutError("no verdict")
    return 2 if st in SOLVED else 1


def givens_of(gen):
    """The board's given cells, as {(row, col): digit}.

    `carve_order` is every cell the search proved removable, in the order it
    removed them, and `carved` is how many of that prefix this board uses.
    Depth is that one number: uniqueness is monotone in the givens, so any
    prefix of a carve order that ended unique is unique too, and a shallower
    board is a rebuild rather than another search. Fewer carved givens means a
    shallower search -- the whole carve left the app's solver unable to finish
    the baseline link at all (README, "Depth").
    """
    dropped = {tuple(p) for p in gen["carve_order"][: gen["carved"]]}
    return {
        (r, c): gen["grid"][r][c]
        for r in range(N)
        for c in range(N)
        if (r, c) not in dropped
    }


def draw_group(rng, grid, index, n_targets, n_digits):
    """One group: scattered target cells, a digit set, and a counter cell
    outside the group whose solution digit is the count. None when this draw
    has no counter cell to offer (a count of 0, or no cell holding it)."""
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


def search(seed, n_groups=20, n_targets=14, n_digits=3):
    """Draw a board: a solution grid, `n_groups` count-digits groups over it,
    and givens carved (in seeded random order) until no more can go while the
    board stays unique."""
    rng = random.Random(seed)
    m, x = model([], {})
    for cell in x:
        m.AddHint(x[cell], rng.randrange(1, N + 1))
    sv = solver(30, reproducible=False, seed=seed, randomize=True)
    assert sv.Solve(m) in SOLVED
    grid = [[sv.Value(x[r, c]) for c in range(N)] for r in range(N)]

    groups = []
    for _attempt in range(2000):
        if len(groups) == n_groups:
            break
        g = draw_group(rng, grid, len(groups), n_targets, n_digits)
        if g is not None:
            groups.append(g)
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
            unique = False  # no verdict: keep the given, lose nothing
        if unique:
            givens = trial
            carve_order.append(cell)
    return {
        "grid": grid,
        "groups": groups,
        "carve_order": [list(p) for p in carve_order],
        "carved": len(carve_order),
    }


def backend_code(gen, name):
    table = "const GROUPS = " + json.dumps(gen["groups"], separators=(",", ":")) + "\n"
    src = BACKEND.read_text().replace(CANDIDATE_NAME, name)
    return minify_js(table + src, base_dir=BACKEND.parent)


def build_doc(gen, name):
    """The board's document: `name` is the class the backend registers --
    CANDIDATE_NAME (with its component shipped) or BASELINE_NAME (built-in)."""
    givens = givens_of(gen)
    cells = [
        {"value": gen["grid"][r][c], "given": True} if (r, c) in givens else {}
        for r in range(N)
        for c in range(N)
    ]
    regions = [box(r, c) for r in range(N) for c in range(N)]
    components = (
        [{"type": "code", "name": CANDIDATE_NAME, "code": minify_file(COMPONENT)}]
        if name == CANDIDATE_NAME
        else []
    )
    return {
        "formatVersion": "1.6.0",
        "puzzle": {
            "name": "Sparse count digits",
            "author": "",
            "type": "sudoku",
            "width": N,
            "height": N,
            "comment": RULES,
            "cells": cells,
            "constraints": [
                {"type": 0},
                {"type": 1, "regions": regions},
                {
                    "name": CONSTRAINT_NAME,
                    "type": 1000,
                    "definition": {
                        "name": CONSTRAINT_NAME,
                        "input": [],
                        "backend": {"type": "code", "code": backend_code(gen, name)},
                        "components": components,
                    },
                    "input": {},
                    "style": {},
                },
            ],
        },
    }


def build(out_dir=RESEARCH_DIR, gen_path=GEN):
    gen = json.loads(pathlib.Path(gen_path).read_text())
    write(build_doc(gen, CANDIDATE_NAME), out_dir / "PUZZLE_LINK_sparse.txt")
    write(build_doc(gen, BASELINE_NAME), out_dir / "PUZZLE_LINK_sparse_original.txt")


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
        "--out",
        help="directory for the links (default: docs/research/count-digits-gac/sparse/)",
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
        build(pathlib.Path(args.out) if args.out else RESEARCH_DIR, args.gen)
        print("wrote PUZZLE_LINK_sparse.txt and PUZZLE_LINK_sparse_original.txt")
