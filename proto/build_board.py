# Build a timeable 6x6 quad-rank board (#324).
#
# Strategy B's first half: take a known grid, read the true ranks off the
# oracle, and clue a few windows. The board is not claimed unique -- uniqueness
# is #325's question -- it only has to make the app's solver SEARCH, which is
# what a timing needs.
#
#   uv run --with lzstring proto/build_board.py <out.txt> [--no-deduction]
#   uv run --with lzstring proto/build_board.py <out.txt> --puzzle p.json
#
# --no-deduction writes the same board with the leading-digit removals taken
# out of `update`, the baseline the two-row ship rule compares against.
# --puzzle takes a {grid, clues: [[r, c, rank], ...], givens: [[r, c], ...]}
# file (0-based, the shape qr_find.py writes) at any size, instead of the 6x6
# board baked in below. Board size comes from the grid.

import json
import pathlib
import sys

sys.path.insert(
    0, str(pathlib.Path(__file__).resolve().parents[1] / "examples/_shared")
)
from link_codec import encode_link  # noqa: E402

BOXES = {4: (2, 2), 6: (2, 3), 9: (3, 3)}


def load_board(argv):
    """(N, box, solution, clues, givens, name). clues are 1-based {r, c, rank}."""
    if "--puzzle" in argv:
        p = json.loads(pathlib.Path(argv[argv.index("--puzzle") + 1]).read_text())
        n = len(p["grid"])
        clues = [{"r": r + 1, "c": c + 1, "rank": k} for r, c, k in p["clues"]]
        return n, BOXES[n], p["grid"], clues, [tuple(g) for g in p["givens"]], f"Quad Rank {n}x{n}"
    # The 6x6 timing board from #324: solution and clues both read off the
    # oracle by proto/pick_board.mjs.
    b = json.loads(pathlib.Path(__file__).with_name("board.json").read_text())
    return 6, BOXES[6], b["grid"], b["clues"], b["givens"], "Quad Rank 6x6 (timing board)"


N, BOX, SOLUTION, CLUES, GIVENS, NAME = load_board(sys.argv)

RULES = (
    "Normal sudoku rules apply on the inner grid. Quad Rank: read every "
    "overlapping 2x2 window's four digits top-left, top-right, bottom-left, "
    f"bottom-right and concatenate them into a four-digit number. Rank all {(N - 1) ** 2} "
    "windows by that number, smallest first; tied windows share the lower rank "
    "and the ranks after a tie are skipped. A circled number on a window gives "
    "that window's rank."
)

COMPONENT = pathlib.Path(__file__).with_name("QuadRankComponent.js").read_text()

BACKEND = (
    """\
//! One QuadRankComponent per drawn group: cells are the window read
//! TL/TR/BL/BR, and the group's value is the clued rank. A group whose value is
//! not a rank in range is a clue the author has not finished, so it is skipped
//! rather than thrown on -- the editor rebuilds every component on every edit.
const n = %d
const allCells = [...Array(n * n).keys()]
const maxRank = (n - 1) * (n - 1)

for (const g of input.groups) {
  if (g.cells.length !== 4) continue
  const rank = Number(String(g.value).trim())
  if (!Number.isInteger(rank) || rank < 1 || rank > maxRank) continue
  const name = `the quad rank clue at ${helpers.naming.getCellName(g.cells[0])}`
  puzzle.addConstraintComponent(new QuadRankComponent(name, g.cells, rank, allCells, n))
}
"""
    % N
)


def regions():
    br, bc = BOX
    out = []
    for i in range(N * N):
        r, c = divmod(i, N)
        out.append((r // br) * (N // bc) + (c // bc))
    return out


def build(out_path, deduction=True):
    component = COMPONENT
    if not deduction:
        # The baseline: same component, same validate, no leading-digit removals.
        component = component.replace(
            """  const allowed = allowedTopLeft(instance.n, instance.rank)
  const tl = instance.cells[0]
  for (const d of puzzle.getCandidates(tl)) {
    if (!allowed.includes(d)) yield puzzle.removeCandidateFromCell(d, tl)
  }""",
            """  // baseline: deduction removed, so this yields nothing""",
        )

    cells = [{} for _ in range(N * N)]
    for r, c in GIVENS:
        cells[r * N + c] = {"value": SOLUTION[r][c], "given": True}

    groups = []
    for clue in CLUES:
        r, c = clue["r"] - 1, clue["c"] - 1
        tl = r * N + c
        groups.append(
            {"cells": [tl, tl + 1, tl + N, tl + N + 1], "value": str(clue["rank"])}
        )

    doc = {
        "formatVersion": "1.6.0",
        "puzzle": {
            "name": NAME,
            "author": "",
            "comment": RULES,
            "type": "custom",
            "width": N,
            "height": N,
            "minDigit": 1,
            "maxDigit": N,
            "cells": cells,
            "constraints": [
                {"type": 1, "regions": regions()},
                {"type": 0},
                {
                    "name": "Quad Rank",
                    "type": 1000,
                    "definition": {
                        "name": "Quad Rank",
                        "input": [
                            {
                                "id": "groups",
                                "label": "Groups",
                                "params": {"type": "raw"},
                            }
                        ],
                        "backend": {"type": "code", "code": BACKEND},
                        "components": [
                            {
                                "type": "code",
                                "name": "QuadRankComponent",
                                "code": component,
                            }
                        ],
                    },
                    "input": {"groups": groups},
                    "style": {},
                },
            ],
            "export": {"sudokuPad": {"useIncompleteGridAsSolution": True}},
        },
    }
    pathlib.Path(out_path).write_text(encode_link(doc))


if __name__ == "__main__":
    build(sys.argv[1], deduction="--no-deduction" not in sys.argv)
    print(f"wrote {sys.argv[1]}: {N}x{N}, {len(CLUES)} clues, {len(GIVENS)} givens")
