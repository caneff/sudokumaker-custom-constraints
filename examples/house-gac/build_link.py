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
# --keep-comments builds the annotated sibling link: same board, same givens,
# same component and backend files, but the embedded code keeps every comment
# and blank line (bar the lint directive) -- for a reader who opens the link in
# SudokuMaker and reads the code in its own box. Regenerate
# PUZZLE_LINK_annotated.txt with
#
#   uv run --with lzstring examples/house-gac/build_link.py \
#       --keep-comments --out examples/house-gac/PUZZLE_LINK_annotated.txt
#
# --component swaps a candidate's code into PUZZLE_LINK.txt, or into --board,
# and nothing else changes (_shared/link_swap.swap_main) -- the way
# `just time house-gac --board <fixture>` reaches a fixture other than the
# default board.
#
# The constraint ships under the name "House GAC (standalone)", not the bare
# "House GAC" `house_gac_links.with_filter` writes by default: "House GAC" is a
# reserved title meaning ONE thing repo-wide -- the shared
# `examples/_shared/house-gac.js` backend on a frame board, checked by
# `check_layout.py`'s `check_stale_backend_code` and `check_digit_range`. This
# board's backend is a different file (`main.js`, no ring to slice), so
# `build()` renames the spliced constraint.

import argparse
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[1]
BASE_LINK = REPO / "docs/research/406-gac-demo/PUZZLE_LINK_without_gac.txt"
COMPONENT = HERE.parent / "_shared/HouseGacComponent.js"
BACKEND = HERE / "main.js"

sys.path.insert(0, str(REPO / "examples/_shared"))
sys.path.insert(0, str(REPO / "docs/research/408-house-gac"))
from cpsat import solve_unique, sudoku_model
from framebuild import NO_RING_RULES_PREFIX
from house_gac_links import with_filter
from link_codec import decode_puzzle, encode_link
from link_swap import swap_main
from manifest import load_manifest
from sm_document import find_constraint

MANIFEST = load_manifest(HERE)
CONSTRAINT_NAME = MANIFEST.constraint_name
TIMED_COMPONENT = MANIFEST.timed_component


def prove_unique(givens):
    m, x = sudoku_model(9, (3, 3))
    for (r, c), v in givens.items():
        m.Add(x[r, c] == v)
    first, unique = solve_unique(m, x, 60)
    assert first is not None, "the board has no solution"
    assert unique, "the board has a second solution"
    return first


def build(
    component_path=COMPONENT,
    backend_path=BACKEND,
    base_link=BASE_LINK,
    keep_comments=False,
):
    base = decode_puzzle(pathlib.Path(base_link).read_text().strip())
    width = base["puzzle"]["width"]
    assert width == base["puzzle"]["height"] == 9, "expected the plain 9x9 board"

    givens = {}
    for i, cell in enumerate(base["puzzle"]["cells"]):
        if cell.get("given"):
            r, c = divmod(i, width)
            givens[(r, c)] = int(cell["value"])

    sol = prove_unique(givens)

    # Splicing `with_filter` onto a base that already carries the constraint
    # would double it silently -- refuse instead.
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
    find_constraint(doc, "House GAC")["definition"]["name"] = CONSTRAINT_NAME
    doc["puzzle"]["name"] = "Standalone House GAC"
    doc["puzzle"]["comment"] = (
        NO_RING_RULES_PREFIX
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
