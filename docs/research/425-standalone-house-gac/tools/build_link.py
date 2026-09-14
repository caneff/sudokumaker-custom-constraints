"""Build the standalone House GAC link (#425): a plain 9x9 with no clue ring
and no frame constraint, whose only custom constraint is the shipped
`examples/_shared/HouseGacComponent.js`, registered on all 27 houses by this
folder's own `house-gac9-main.js` (examples/_shared/house-gac.js assumes a
frame board's ring and cannot register a bare 9x9 -- see that file's header).

Reuses the plain-9x9 board and givens from
docs/research/406-gac-demo/PUZZLE_LINK_without_gac.txt (25 givens, boxes as
regions, rows and columns declared by the Rows & Columns backend, no GAC
filter yet) and re-proves uniqueness with CP-SAT so the AutoStep readout can
be checked cell for cell.

    uv run docs/research/425-standalone-house-gac/tools/build_link.py
"""

import sys
from pathlib import Path

from ortools.sat.python import cp_model

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[3]
BASE_LINK = REPO / "docs/research/406-gac-demo/PUZZLE_LINK_without_gac.txt"
COMPONENT = REPO / "examples/_shared/HouseGacComponent.js"
BACKEND = HERE / "house-gac9-main.js"
OUT = HERE.parent / "PUZZLE_LINK.txt"

RULES_PREFIX = "Normal sudoku rules apply on the inner grid. "

sys.path.insert(0, str(REPO / "examples/_shared"))
sys.path.insert(0, str(REPO / "docs/research/408-house-gac"))
from cpsat import SOLVED, has_second_solution, solver  # noqa: E402
from house_gac_links import with_filter  # noqa: E402
from link_codec import decode_puzzle, encode_link  # noqa: E402

base = decode_puzzle(BASE_LINK.read_text().strip())
width = base["puzzle"]["width"]
assert width == base["puzzle"]["height"] == 9, "expected the plain 9x9 board"

givens = {}
for i, cell in enumerate(base["puzzle"]["cells"]):
    if cell.get("given"):
        r, c = divmod(i, width)
        givens[(r, c)] = int(cell["value"])
print("givens carried over:", len(givens))


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


sol = prove_unique(givens)
print("unique; solution rows:")
for r in range(9):
    print("  " + "".join(str(sol[r, c]) for c in range(9)))

doc = with_filter(base, COMPONENT, backend=BACKEND)
doc["puzzle"]["name"] = "Standalone House GAC"
doc["puzzle"]["comment"] = (
    RULES_PREFIX
    + "The only custom constraint is the shipped House GAC filter -- a "
    "generalized-arc-consistency all-different check on every row, column "
    "and box. It adds no rule (every house is already all-different) and "
    "only filters harder. Press the AutoStep button (the run-to-fixpoint "
    "logical solver) to see it clear the grid."
)

link = encode_link(doc)
assert decode_puzzle(link) == doc
OUT.write_text(link + "\n")
print(f"wrote {OUT}: {len(link)} characters")
