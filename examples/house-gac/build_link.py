# Build the standalone House GAC link: a plain 9x9 with no clue ring and no
# frame constraint, whose only constraint
# beyond the board's own rows-and-columns and region declarations is the
# shipped `examples/_shared/HouseGacComponent.js`, registered on all 27 houses
# by this folder's own `main.js` (examples/_shared/house-gac.js assumes a
# frame board's ring and cannot register a bare 9x9 -- see the README).
#
# Reuses the plain-9x9 board and givens from
# docs/research/406-gac-demo/PUZZLE_LINK_without_gac.txt (25 givens, boxes as
# regions, rows and columns declared by the Rows & Columns backend, no GAC
# filter yet) and re-proves uniqueness with CP-SAT so the AutoStep readout can
# be checked cell for cell.
#
#   uv run --with lzstring examples/house-gac/build_link.py
#   uv run --with lzstring examples/house-gac/build_link.py \
#       --component /path/HouseGacComponent.js --out /tmp/candidate.txt
#
# --board names a committed link instead: the candidate component's code is
# swapped into that link and nothing else changes, the way
# `just time house-gac --board <fixture>` reaches a fixture other than the
# default board (the room #428 leaves for the harder #427 fixture, kept
# beside this one under its own name once it lands).

import argparse
import pathlib
import sys

from ortools.sat.python import cp_model

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[1]
BASE_LINK = REPO / "docs/research/406-gac-demo/PUZZLE_LINK_without_gac.txt"
COMPONENT = HERE.parent / "_shared/HouseGacComponent.js"
BACKEND = HERE / "main.js"

CONSTRAINT_NAME = "House GAC"
TIMED_COMPONENT = "HouseGacComponent"
RULES_PREFIX = "Normal sudoku rules apply on the inner grid. "

sys.path.insert(0, str(REPO / "examples/_shared"))
sys.path.insert(0, str(REPO / "docs/research/408-house-gac"))
from cpsat import SOLVED, has_second_solution, solver
from house_gac_links import with_filter
from link_codec import decode_puzzle, encode_link
from link_swap import check_and_write, find_constraint, swap_component_code
from minify import minify_file


def prove_unique(givens):
    m = cp_model.CpModel()
    x = {(r, c): m.NewIntVar(1, 9, f"x{r}{c}") for r in range(9) for c in range(9)}
    for (r, c), v in givens.items():
        m.Add(x[r, c] == v)
    for i in range(9):
        m.AddAllDifferent([x[i, c] for c in range(9)])
        m.AddAllDifferent([x[r, i] for r in range(9)])
    for br in range(3):
        for bc in range(3):
            m.AddAllDifferent(
                [x[br * 3 + i, bc * 3 + j] for i in range(3) for j in range(3)]
            )
    s = solver(60)
    assert s.Solve(m) in SOLVED
    first = {k: s.Value(v) for k, v in x.items()}
    assert not has_second_solution(m, x, first, 60)
    return first


def build(component_path=COMPONENT, backend_path=BACKEND, base_link=BASE_LINK):
    """Rebuild the standalone House GAC link from `base_link`'s board and
    givens, re-proving uniqueness with CP-SAT, and splicing in the House GAC
    constraint via `backend_path`/`component_path`. Returns (link, doc,
    solution, n_givens)."""
    base = decode_puzzle(pathlib.Path(base_link).read_text().strip())
    width = base["puzzle"]["width"]
    assert width == base["puzzle"]["height"] == 9, "expected the plain 9x9 board"

    givens = {}
    for i, cell in enumerate(base["puzzle"]["cells"]):
        if cell.get("given"):
            r, c = divmod(i, width)
            givens[(r, c)] = int(cell["value"])

    sol = prove_unique(givens)

    # Splicing `with_filter` onto a base that already carries a House GAC
    # constraint would double it silently (AGENTS.md: a splicing generator
    # run twice on one file duplicates the scene) -- refuse instead.
    existing_names = {
        c.get("definition", {}).get("name") for c in base["puzzle"]["constraints"]
    }
    assert CONSTRAINT_NAME not in existing_names, (
        "base link already carries a House GAC constraint"
    )

    doc = with_filter(
        base, pathlib.Path(component_path), backend=pathlib.Path(backend_path)
    )
    doc["puzzle"]["name"] = "Standalone House GAC"
    doc["puzzle"]["comment"] = (
        RULES_PREFIX
        + "The only constraint beyond the board's own rows, columns and boxes "
        "is the shipped House GAC filter -- a generalized-arc-consistency "
        "all-different check on every row, column and box. It adds no rule "
        "(every house is already all-different) and only filters harder. Press "
        "the AutoStep button (the run-to-fixpoint logical solver) to see it "
        "clear the grid."
    )
    return encode_link(doc), doc, sol, len(givens)


def check(link, doc):
    back = decode_puzzle(link)
    assert back == doc, "link does not decode back to the built document"
    names = [
        c["name"]
        for c in find_constraint(doc, CONSTRAINT_NAME)["definition"]["components"]
    ]
    assert names == [TIMED_COMPONENT], f"expected one {TIMED_COMPONENT}, got {names}"


def build_on_board(component_path, out_path, board_path):
    """Swap the component's code into a committed link, changing nothing
    else -- the path `just time house-gac --board <link>` takes."""
    base = decode_puzzle(pathlib.Path(board_path).read_text().strip())
    code = minify_file(pathlib.Path(component_path))
    doc = swap_component_code(base, CONSTRAINT_NAME, TIMED_COMPONENT, code)
    return check_and_write(base, doc, CONSTRAINT_NAME, out_path)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--component", default=COMPONENT)
    p.add_argument("--backend", default=BACKEND)
    p.add_argument("--out", default=HERE / "PUZZLE_LINK.txt")
    p.add_argument("--board", help="committed link to swap the component into")
    args = p.parse_args()
    if args.board:
        link = build_on_board(args.component, args.out, args.board)
        print(f"wrote {args.out} ({len(link)} chars, from {args.board})")
    else:
        link, doc, sol, n_givens = build(args.component, args.backend)
        check(link, doc)
        pathlib.Path(args.out).write_text(link + "\n")
        print(f"givens carried over: {n_givens}")
        print("unique; solution rows:")
        for r in range(9):
            print("  " + "".join(str(sol[r, c]) for c in range(9)))
        print(f"wrote {args.out}: {len(link)} characters")
