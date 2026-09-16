# Build the standalone House GAC link: a plain 9x9 with no clue ring and no
# frame constraint, whose only constraint beyond the board's own
# rows-and-columns and region declarations is the shipped
# `examples/_shared/HouseGacComponent.js`, registered on all 27 houses by
# this folder's own `main.js` (examples/_shared/house-gac.js assumes a frame
# board's ring and cannot register a bare 9x9 -- see the README).
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
# --keep-comments builds the annotated sibling link (#433): same board, same
# givens, same component and backend files, but the embedded code keeps every
# comment (only blank lines go; indentation is untouched) instead of the
# usual full strip -- for a reader who opens the link in SudokuMaker and
# reads the code in its own box. Regenerate PUZZLE_LINK_annotated.txt with
#
#   uv run --with lzstring examples/house-gac/build_link.py \
#       --keep-comments --out examples/house-gac/PUZZLE_LINK_annotated.txt
#
# --component swaps a candidate's code into PUZZLE_LINK.txt, or into --board,
# and nothing else changes (_shared/link_swap.swap_main) -- the way
# `just time house-gac --board <fixture>` reaches a fixture other than the
# default board (the room #428 leaves for the harder #427 fixture, kept
# beside this one under its own name once it lands).
#
# The constraint ships under the name "House GAC (standalone)", not the bare
# "House GAC" `house_gac_links.with_filter` writes by default: #421/#434
# (landed while this ticket was in flight) made "House GAC" a reserved title
# meaning ONE specific thing repo-wide -- the shared `examples/_shared/
# house-gac.js` backend on a frame board, always checked for staleness and a
# declared digit range (`check_layout.py`'s `check_frame_backends`). This
# board's backend is a different file (`main.js`, no ring to slice), so it is
# not that thing and must not answer to that name -- `build()` renames the
# spliced constraint below before returning it.

import argparse
import pathlib
import sys

from ortools.sat.python import cp_model

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[1]
BASE_LINK = REPO / "docs/research/406-gac-demo/PUZZLE_LINK_without_gac.txt"
COMPONENT = HERE.parent / "_shared/HouseGacComponent.js"
BACKEND = HERE / "main.js"

CONSTRAINT_NAME = "House GAC (standalone)"
TIMED_COMPONENT = "HouseGacComponent"

sys.path.insert(0, str(REPO / "examples/_shared"))
sys.path.insert(0, str(REPO / "docs/research/408-house-gac"))
from cpsat import SOLVED, has_second_solution, solver
from framebuild import RULES_PREFIX
from house_gac_links import with_filter
from link_codec import decode_puzzle, encode_link
from link_swap import find_constraint, swap_main


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


def build(
    component_path=COMPONENT,
    backend_path=BACKEND,
    base_link=BASE_LINK,
    keep_comments=False,
):
    """Rebuild the standalone House GAC link from `base_link`'s board and
    givens, re-proving uniqueness with CP-SAT, and splicing in the House GAC
    constraint via `backend_path`/`component_path`. Returns (link, doc,
    solution, n_givens).

    `keep_comments=True` is the annotated-link build (#433): the embedded
    component and backend code keep every comment (only blank lines go;
    indentation is untouched), instead of the usual full comment strip. Board,
    givens and every other constraint are unaffected -- only how this one
    constraint's code is minified changes."""
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
        base,
        pathlib.Path(component_path),
        backend=pathlib.Path(backend_path),
        keep_comments=keep_comments,
    )
    # with_filter always names the constraint "House GAC"; rename it to this
    # example's own name (see the module docstring for why) before it is
    # checked against anything that title means repo-wide.
    find_constraint(doc, "House GAC")["definition"]["name"] = CONSTRAINT_NAME
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


def rebuild(args, _parser):
    """No --component: rebuild the link from source, to --out or
    PUZZLE_LINK.txt."""
    out = args.out or HERE / "PUZZLE_LINK.txt"
    link, doc, sol, n_givens = build(
        COMPONENT, args.backend or BACKEND, keep_comments=args.keep_comments
    )
    check(link, doc)
    pathlib.Path(out).write_text(link + "\n")
    print(f"givens carried over: {n_givens}")
    print("unique; solution rows:")
    for r in range(9):
        print("  " + "".join(str(sol[r, c]) for c in range(9)))
    print(f"wrote {out}: {len(link)} characters")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument(
        "--keep-comments",
        action="store_true",
        help="build the annotated link: embedded code keeps every comment "
        "instead of the usual full strip (#433)",
    )
    swap_main(HERE, p, rebuild, rebuild_reads_backend=True)
