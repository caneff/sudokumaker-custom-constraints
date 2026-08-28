# Build the clued-board twins: PUZZLE_LINK.txt with all 36 outside clues
# filled from the puzzle's own solution (interior unchanged, still blank but
# for the one given), plus its original-wrapper twin for a same-board timing
# comparison. Mirrors build_original.py; see docs/real-app-timing.md.
#
#   uv run --with lzstring examples/numbered-rooms/build_clued.py
#
# SOLUTION is the real app's own solved grid for PUZZLE_LINK.txt (read from
# the SVG cell text after clicking "Find all solutions and valid candidates"
# at https://sudokumaker.app, the same solve app-solve.mjs times -- the app
# confirmed it "a unique solution"). `verify_solution` below re-derives every
# outside clue from it via the Numbered Rooms rule
# (line[k - 1] === clue, k = value(line[0])) and checks standard sudoku
# (rows/columns/boxes all different), so a stale or mistyped SOLUTION string
# fails loud here instead of silently shipping a wrong clue.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from link_codec import decode_puzzle, encode_link
from link_swap import check_and_write, find_constraint, replace_constraint_code
from minify import minify_js

HERE = pathlib.Path(__file__).parent
CONSTRAINT_NAME = "Custom Numbered Rooms"

# Row-major digits for all 121 cells (11x11: the 9x9 interior plus its outer
# clue ring), including the 4 unused filler corners.
SOLUTION = (
    "151392163819758261943913419785626469253417891485197236112168537943593742"
    "6815245697423811117368542915824319657413777112981"
)


def verify_solution(doc, values):
    """Raise AssertionError if `values` does not satisfy this board's own
    sudoku and Numbered Rooms rules, or does not match its given cells."""
    p = doc["puzzle"]
    for i, c in enumerate(p["cells"]):
        if c and c.get("given"):
            assert values[i] == c["value"], (
                f"cell {i} given {c['value']}, got {values[i]}"
            )

    regions = next(c for c in p["constraints"] if c["type"] == 1)["regions"]
    rows = next(c for c in p["constraints"] if c.get("name") == "Rows")["cages"]
    cols = next(c for c in p["constraints"] if c.get("name") == "Columns")["cages"]
    boxes = {}
    for i, r in enumerate(regions):
        if r >= 0:
            boxes.setdefault(r, []).append(i)
    for group in (
        [c["cells"] for c in rows] + [c["cells"] for c in cols] + list(boxes.values())
    ):
        digits = [values[i] for i in group]
        assert len(set(digits)) == len(digits), f"repeated digit in {group}: {digits}"

    for g in find_constraint(doc, CONSTRAINT_NAME)["input"]["groups"]:
        clue, line = g["cells"][0], g["cells"][1:]
        k = values[line[0]]
        assert values[line[k - 1]] == values[clue], (
            f"Numbered Rooms rule broken at clue {clue}: line[{k}-1] != clue"
        )


def fill_ring(doc, values, groups):
    """Return a copy of doc with each group's clue cell set to its solved
    digit. Stored as a non-given value -- outside clues live in the cell
    array without a `given` flag, not as givens (docs/real-app-timing.md)."""
    import copy

    doc = copy.deepcopy(doc)
    for g in groups:
        clue = g["cells"][0]
        doc["puzzle"]["cells"][clue] = {"value": values[clue]}
    return doc


def write_link(doc, out_path):
    link = encode_link(doc)
    assert decode_puzzle(link) == doc, "link does not round-trip"
    pathlib.Path(out_path).write_text(link + "\n")
    return link


def build():
    base = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
    values = [int(d) for d in SOLUTION]
    assert len(values) == len(base["puzzle"]["cells"]), "SOLUTION is the wrong size"
    verify_solution(base, values)

    groups = find_constraint(base, CONSTRAINT_NAME)["input"]["groups"]
    clued = fill_ring(base, values, groups)
    write_link(clued, HERE / "PUZZLE_LINK_clued.txt")

    backend_code = minify_js((HERE / "original" / "main.js").read_text())
    component_code = minify_js(
        (HERE / "original" / "CustomIndexComponent.js").read_text()
    )
    clued_original = replace_constraint_code(
        clued,
        CONSTRAINT_NAME,
        backend_code=backend_code,
        components=[
            {"type": "code", "name": "CustomIndexComponent", "code": component_code}
        ],
    )
    check_and_write(
        clued, clued_original, CONSTRAINT_NAME, HERE / "PUZZLE_LINK_clued_original.txt"
    )
    return clued, clued_original


if __name__ == "__main__":
    build()
    print("wrote PUZZLE_LINK_clued.txt")
    print("wrote PUZZLE_LINK_clued_original.txt")
