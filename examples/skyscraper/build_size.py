# Build a Skyscrapers (interactive outside clue) puzzle link for any grid size.
#
# Generates a fresh grid, derives the visible-count clue for every line, carves
# minimal interior givens and a minimal shown-clue set to a unique solution
# (OR-Tools), then assembles the whole SudokuMaker document parametrically and
# encodes it. Clues that stay hidden are the interactive ones: the solver reads
# them off the line as it solves. The shared machinery (grid, CP-SAT model,
# carve loop, frame assembly, round-trip check) lives in `_shared/framebuild.py`.
#
#   uv run --with ortools --with lzstring examples/skyscraper/build_size.py 4 2 2
#   uv run --with ortools --with lzstring examples/skyscraper/build_size.py 6 2 3
#   uv run --with ortools --with lzstring examples/skyscraper/build_size.py 9 3 3
#
# Args: n box_height box_width   (box_height * box_width == n)
# Writes PUZZLE_LINK_<n>x<n>.txt and gen_<n>.json next to this script.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from framebuild import Spec, run

HERE = pathlib.Path(__file__).parent
COMPONENTS = ["SkyscraperComponent.js", "SkyscraperPairComponent.js"]

# One worked example per size: a line, then the left and right clue it gives.
RULE_EXAMPLES = {
    4: "a row with 1324 gives a left clue of 3 (1, 3, 4 are visible) and a right clue of 1 (only the 4)",
    6: "a row with 142356 gives a left clue of 3 (1, 4, 6) and a right clue of 1 (only the 6)",
    9: "a row with 142356789 gives a left clue of 4 (1, 4, 6, 9) and a right clue of 1 (only the 9)",
}


CORNER_NOTE = (
    "The 1s in the corners only fill space for SudokuMaker's solver; "
    "delete them before publishing."
)


def rule_text(n):
    rule = (
        "Skyscrapers (interactive outside clues): each outside cell holds a digit "
        "equal to the number of buildings visible along its line. A building is "
        "visible when it is taller than every building before it. Blank outside "
        "cells are interactive: read them off the line as you solve."
    )
    ex = RULE_EXAMPLES.get(n)
    if ex:
        rule = f"{rule} For example, {ex}."
    return f"{rule}\n\n{CORNER_NOTE}"


def sky(v):
    # visible buildings: count left-to-right maxima
    count = 0
    mx = 0
    for d in v:
        if d > mx:
            count += 1
            mx = d
    return count


def add_visibility(m, x, cells, kk, n, tag):
    # exactly kk cells are left-to-right maxima along `cells`
    vis = []
    for i in range(n):
        b = m.NewBoolVar(f"v{tag}_{i}")
        if i == 0:
            m.Add(b == 1)  # the first building is always visible
        else:
            greater = []
            for j in range(i):
                g = m.NewBoolVar(f"g{tag}_{i}_{j}")
                m.Add(x[cells[i]] > x[cells[j]]).OnlyEnforceIf(g)
                m.Add(x[cells[i]] < x[cells[j]]).OnlyEnforceIf(g.Not())
                greater.append(g)
            m.AddBoolAnd(greater).OnlyEnforceIf(b)
            m.AddBoolOr([g.Not() for g in greater]).OnlyEnforceIf(b.Not())
        vis.append(b)
    m.Add(sum(vis) == kk)


SPEC = Spec(
    dir=HERE,
    title="Skyscrapers Interactive",
    lines_name="Skyscraper Lines",
    components=COMPONENTS,
    min_digit=1,
    clue_fn=sky,
    cp_sat_clue_fn=add_visibility,
    comment_fn=rule_text,
)

if __name__ == "__main__":
    run(SPEC)
