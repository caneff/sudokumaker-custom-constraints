# Build the clued-board twins: PUZZLE_LINK.txt with all 36 outside clues
# filled from the puzzle's own solution, plus its original-wrapper twin for a
# same-board timing comparison.
#
# SOLUTION is the real app's own solved grid for PUZZLE_LINK.txt (read from
# the SVG cell text after clicking "Find all solutions and valid candidates";
# the app confirmed it "a unique solution"). `verify_solution` re-derives every
# outside clue from it and checks the sudoku, so a stale or mistyped SOLUTION
# fails loud instead of silently shipping a wrong clue.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from build_original import build_original, frame_groups
from link_codec import decode_puzzle
from sm_document import write_link

HERE = pathlib.Path(__file__).parent
CONSTRAINT_NAME = "Custom Numbered Rooms"

# Row-major digits for all 121 cells (11x11: the 9x9 interior plus its outer
# clue ring). The 4 corners belong to no line and hold no puzzle digit -- a
# component pins them -- so their characters here are placeholders that no
# check reads.
SOLUTION = (
    "151392163819758261943913419785626469253417891485197236112168537943593742"
    "6815245697423811117368542915824319657413777112981"
)


def verify_solution(doc, values):
    p = doc["puzzle"]
    for i, c in enumerate(p["cells"]):
        if c and c.get("given"):
            assert values[i] == c["value"], (
                f"cell {i} given {c['value']}, got {values[i]}"
            )

    regions = next(c for c in p["constraints"] if c["type"] == 1)["regions"]
    boxes = {}
    for i, r in enumerate(regions):
        if r >= 0:
            boxes.setdefault(r, []).append(i)
    # The interior's rows and columns are named houses the frame backend
    # builds from the board's own geometry, not cages in the document, so read
    # them off the region map the same way that backend reads them off the
    # grid: an interior cell is one the region map places in a region.
    W = p["width"]
    inside = [i for i, r in enumerate(regions) if r >= 0]
    rows = {}
    cols = {}
    for i in inside:
        rows.setdefault(i // W, []).append(i)
        cols.setdefault(i % W, []).append(i)
    for group in list(rows.values()) + list(cols.values()) + list(boxes.values()):
        digits = [values[i] for i in group]
        assert len(set(digits)) == len(digits), f"repeated digit in {group}: {digits}"

    for g in frame_groups():
        clue, line = g["cells"][0], g["cells"][1:]
        k = values[line[0]]
        assert values[line[k - 1]] == values[clue], (
            f"Numbered Rooms rule broken at clue {clue}: line[{k}-1] != clue"
        )


def fill_ring(doc, values, groups):
    """Outside clues are stored as plain values with no `given` flag, not as
    givens (docs/real-app-timing.md)."""
    import copy

    doc = copy.deepcopy(doc)
    for g in groups:
        clue = g["cells"][0]
        doc["puzzle"]["cells"][clue] = {"value": values[clue]}
    return doc


def build(out_dir=HERE):
    base = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
    values = [int(d) for d in SOLUTION]
    assert len(values) == len(base["puzzle"]["cells"]), "SOLUTION is the wrong size"
    verify_solution(base, values)

    clued = fill_ring(base, values, frame_groups())
    write_link(clued, out_dir / "PUZZLE_LINK_clued.txt")

    clued_original = build_original(clued)
    write_link(clued_original, out_dir / "PUZZLE_LINK_clued_original.txt")
    return clued, clued_original


if __name__ == "__main__":
    build()
    print("wrote PUZZLE_LINK_clued.txt")
    print("wrote PUZZLE_LINK_clued_original.txt")
