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
#   uv run --with ortools --with lzstring \
#       examples/skyscraper/build_size.py 9 3 3 3 --paths
#
# Args: n box_height box_width [seed_count] [--paths]
#       (box_height * box_width == n)
# Writes PUZZLE_LINK_<n>x<n>.txt and gen_<n>x<n>.json next to this script,
# except for n=9: that size is the plain-named pair build_link.py and
# build_original.py reuse, so it lands as PUZZLE_LINK.txt (gen_9x9.json keeps
# its name).
#
# --paths builds the LOCAL board instead: bent paths in place of the straight
# frame lines, shipped as drawn groups on the main.js lane, so the one-sided DP
# -- the rule that runs on a bare line -- has a board to play and to time
# (`just time skyscraper --board PUZZLE_LINK_local.txt --ring-clues`). The 9x9
# lands as PUZZLE_LINK_local.txt with gen_local.json beside it.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from framebuild import Spec, run

HERE = pathlib.Path(__file__).parent
COMPONENTS = [
    "SkyscraperLineComponent.js",
    "SkyscraperOneSidedComponent.js",
    "SkyscraperSideComponent.js",
]

# One worked example per size, read inward from the clue -- a local board's
# lines bend and carry one clue, so the example must not talk about rows or
# about a clue at the far end.
RULE_EXAMPLES = {
    4: "a line reading 1324 inward from its clue gives a clue of 3 (1, 3 and 4 are visible); read the other way, 4231 gives a clue of 1 (the 4 alone)",
    6: "a line reading 251346 inward from its clue gives a clue of 3 (2, 5 and 6 are visible); read the other way, 643152 gives a clue of 1 (the 6 alone)",
    9: "a line reading 238145679 inward from its clue gives a clue of 4 (2, 3, 8 and 9 are visible); read the other way, 976541832 gives a clue of 1 (the 9 alone)",
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


def sky(v, _cells):
    # visible buildings: count left-to-right maxima
    count = 0
    mx = 0
    for d in v:
        if d > mx:
            count += 1
            mx = d
    return count


def add_visibility(m, x, cells, kk, n, tag):
    # exactly kk cells top every cell before them along `cells`.
    # `g` is "taller than", so its negation is "no taller" -- a tie is hidden,
    # which is what SkyscraperOneSidedComponent's ALLOW_TIES = false says. A
    # drawn path may hold the same digit twice, so `<=` here and `<` are not
    # the same constraint.
    vis = []
    for i in range(len(cells)):
        b = m.NewBoolVar(f"v{tag}_{i}")
        if i == 0:
            m.Add(b == 1)  # the first building is always visible
        else:
            greater = []
            for j in range(i):
                g = m.NewBoolVar(f"g{tag}_{i}_{j}")
                m.Add(x[cells[i]] > x[cells[j]]).OnlyEnforceIf(g)
                m.Add(x[cells[i]] <= x[cells[j]]).OnlyEnforceIf(g.Not())
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
    paths = "--paths" in sys.argv
    if paths:
        sys.argv.remove("--paths")
    n = int(sys.argv[1])
    run(SPEC, paths=paths)
    if n == 9:
        if paths:
            (HERE / "PUZZLE_LINK_9x9_local.txt").rename(HERE / "PUZZLE_LINK_local.txt")
            (HERE / "gen_9x9_local.json").rename(HERE / "gen_local.json")
            print("renamed to PUZZLE_LINK_local.txt and gen_local.json")
        else:
            (HERE / "PUZZLE_LINK_9x9.txt").rename(HERE / "PUZZLE_LINK.txt")
            print("renamed to PUZZLE_LINK.txt (the plain-named 9x9 pair)")
