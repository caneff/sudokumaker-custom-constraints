# Build the sparse required-digits timing board (#541): a plain 9x9 sudoku
# carrying 20 overlapping 9-cell regions that are not houses, each required
# to hold 5 given digits, with the givens carved back until the app's solver
# actually searches (the defaults below draw that shape; fewer or smaller
# groups close in 0ms, more leave the built-in timing out). It exists to give RequiredDigitsGacComponent a real-app
# timing row on the shape the offline bench says it wins on (a sparse, large
# group -- docs/research/required-digits-gac/README.md), which the Outside
# Sudoku wrapper board of #534/#535 could not surface.
#
# The rule, stated once for both sides: every listed digit appears in at
# least one cell of its group (the built-in RequiredDigitsComponent's own
# rule; the group is NOT all-different). `model()` below is the CP-SAT side;
# RequiredDigitsGacComponent.js is the JS side.
#
#   uv run examples/outside-sudoku/build_sparse_required_digits.py
#       rebuild both links from the committed gen.json
#   uv run examples/outside-sudoku/build_sparse_required_digits.py --search SEED
#       draw a fresh board (grid, groups, carved givens) into --gen. The
#       grid comes from CP-SAT's portfolio search, which is not reproducible
#       from the seed: the committed gen.json is the artifact, this a one-shot.
#
# Lives here, not in docs/research/, because that gate refuses a new .py
# there (check_research_python, #469); see build_required_digits.py.

import argparse
import json
import pathlib
import random
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from cpsat import SOLVED, forbid, solver
from link_codec import decode_puzzle, encode_link
from minify import minify_file, minify_js
from ortools.sat.python import cp_model

HERE = pathlib.Path(__file__).parent
RESEARCH_DIR = (
    HERE.parent.parent / "docs" / "research" / "required-digits-gac" / "sparse"
)
GEN = RESEARCH_DIR / "gen.json"
BACKEND = RESEARCH_DIR / "main-sparse-global.js"
# the plain 9x9's rows-and-columns constraint, read off the board #406 built
ROWS_COLUMNS_BASE = (
    HERE.parent.parent / "docs/research/406-gac-demo/PUZZLE_LINK_without_gac.txt"
)
COMPONENT = (
    HERE.parent.parent
    / "docs/research/required-digits-gac/RequiredDigitsGacComponent.js"
)
CANDIDATE_NAME = "RequiredDigitsGacComponent"
BASELINE_NAME = "RequiredDigitsComponent"
CONSTRAINT_NAME = "Sparse required digits"
# The regions are not drawn: they live in the constraint's code, so the text
# says so rather than promise an outline the document does not carry.
RULES = (
    "Normal sudoku rules apply. Timing board: the Sparse required digits "
    "constraint's code holds 20 hidden 9-cell regions, each of which must "
    "contain the digits the code lists for it, at least once each."
)

N = 9


def box(r, c):
    return (r // 3) * 3 + c // 3


def is_house(cells):
    return (
        len({r for r, _ in cells}) == 1
        or len({c for _, c in cells}) == 1
        or len({box(r, c) for r, c in cells}) == 1
    )


def model(groups, givens):
    """The board's CP-SAT model: sudoku plus, per group, every listed digit
    (a digit listed twice wants two cells) in at least its count of cells."""
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


def snake(rng, taken):
    """A 9-cell orthogonally connected self-avoiding walk on free cells."""
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


def search(seed, n_groups=20, n_required=5, overlap=True):
    """Draw a board: a solution grid, disjoint snake groups each requiring
    `n_required` digits its own cells hold, and givens carved (in seeded
    random order) until no more can go while the board stays unique."""
    rng = random.Random(seed)
    taken, cell_lists = set(), []
    for _ in range(n_groups):
        s = snake(rng, set() if overlap else taken)
        taken.update(s)
        cell_lists.append(s)
    # a solution grid to read the required digits off: the plain sudoku
    m, x = model([], {})
    for cell in x:
        m.AddHint(x[cell], rng.randrange(1, N + 1))
    sv = solver(30, reproducible=False, seed=seed, randomize=True)
    assert sv.Solve(m) in SOLVED
    grid = [[sv.Value(x[r, c]) for c in range(N)] for r in range(N)]
    groups = []
    for i, cells in enumerate(cell_lists):
        present = sorted({grid[r][c] for r, c in cells})
        if len(present) < n_required:
            raise ValueError(
                f"a snake holds {len(present)} distinct digits, fewer than "
                f"--required {n_required}: try another seed"
            )
        values = sorted(rng.sample(present, n_required))
        groups.append(
            {
                "name": f"region {i + 1}",
                "values": values,
                "cells": [list(p) for p in cells],
            }
        )
    givens = {(r, c): grid[r][c] for r in range(N) for c in range(N)}
    order = list(givens)
    rng.shuffle(order)
    for cell in order:
        trial = {k: v for k, v in givens.items() if k != cell}
        try:
            unique = count_solutions(groups, trial) == 1
        except TimeoutError:
            unique = False  # no verdict: keep the given, lose nothing
        if unique:
            givens = trial
    return {
        "grid": grid,
        "groups": groups,
        "givens": sorted(list(k) for k in givens),
    }


def backend_code(gen, name):
    table = "const GROUPS = " + json.dumps(gen["groups"], separators=(",", ":")) + "\n"
    src = BACKEND.read_text().replace(CANDIDATE_NAME, name)
    return minify_js(table + src, base_dir=BACKEND.parent)


def rows_and_columns():
    base = decode_puzzle(ROWS_COLUMNS_BASE.read_text().strip())
    (c,) = [
        c
        for c in base["puzzle"]["constraints"]
        if c.get("definition", {}).get("name") == "Rows & Columns"
    ]
    return c


def build_doc(gen, name):
    """The board's document: `name` is the class the backend registers --
    CANDIDATE_NAME (with its component shipped) or BASELINE_NAME (built-in)."""
    givens = {tuple(p) for p in gen["givens"]}
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
            "name": "Sparse required digits",
            "author": "",
            "type": "custom",
            "width": N,
            "height": N,
            "comment": RULES,
            "cells": cells,
            "constraints": [
                {"type": 0},
                {"type": 1, "regions": regions},
                rows_and_columns(),
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


def write(doc, path):
    link = encode_link(doc)
    assert decode_puzzle(link) == doc, "link does not round-trip"
    pathlib.Path(path).write_text(link + "\n")


def build(out_dir=RESEARCH_DIR, gen_path=GEN):
    gen = json.loads(pathlib.Path(gen_path).read_text())
    write(build_doc(gen, CANDIDATE_NAME), out_dir / "PUZZLE_LINK_sparse.txt")
    write(build_doc(gen, BASELINE_NAME), out_dir / "PUZZLE_LINK_sparse_original.txt")


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
        help="directory for the links (default: docs/research/required-digits-gac/sparse/)",
    )
    args = p.parse_args()
    if args.search is not None:
        pathlib.Path(args.gen).write_text(
            json.dumps(search(args.search, args.groups, args.required, args.overlap))
            + "\n"
        )
        print(f"wrote {args.gen}")
    else:
        build(pathlib.Path(args.out) if args.out else RESEARCH_DIR, args.gen)
        print("wrote PUZZLE_LINK_sparse.txt and PUZZLE_LINK_sparse_original.txt")
