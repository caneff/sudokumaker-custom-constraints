# Build a Hit Counts (interactive outside clue) puzzle link for any grid size.
#
# Generates a fresh grid, derives the hit-count clue for every line, carves
# minimal interior givens and a minimal shown-clue set to a unique solution
# (OR-Tools), then assembles the whole SudokuMaker document parametrically and
# encodes it. Clues that stay hidden are the interactive ones: the solver reads
# them off the line as it solves. The shared machinery (grid, CP-SAT model,
# carve loop, frame assembly, round-trip check) lives in `_shared/framebuild.py`.
#
#   uv run --with ortools --with lzstring examples/hit-counts/build_size.py 4 2 2
#   uv run --with ortools --with lzstring examples/hit-counts/build_size.py 6 2 3
#   uv run --with ortools --with lzstring examples/hit-counts/build_size.py 9 3 3
#   uv run --with ortools --with lzstring \
#       examples/hit-counts/build_size.py 9 3 3 3 --paths
#
# Args: n box_height box_width [seed_count] [--paths]
#       (box_height * box_width == n)
# Writes PUZZLE_LINK_<n>x<n>.txt and gen_<n>x<n>.json next to this script,
# except that the 9x9 is the board the timing loop and build_link.py reuse, so
# it lands as PUZZLE_LINK.txt and gen.json.
#
# --paths builds the LOCAL board instead: bent paths in place of the straight
# frame lines, shipped as drawn groups on the main.js lane, so a rule that runs
# on a bare line has a board to play and to time
# (`just time hit-counts --board PUZZLE_LINK_local.txt`). The 9x9 lands as
# PUZZLE_LINK_local.txt with gen_local.json beside it.
#
# A clue is the number of "hits" on a line: read inward, a cell is a hit when
# its digit equals its distance from the clue. A hit count of 0 is a legal clue.
# A sudoku cell cannot normally hold 0, so we set the puzzle's minDigit to 0 (to
# allow 0 anywhere) and add a look-and-say cage "00" (zero 0s) over the interior,
# carried by the Spec's `extra_cages` hook, which keeps 0 out of the sudoku
# itself. Only the clue ring may be 0.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from framebuild import Spec, run

HERE = pathlib.Path(__file__).parent
COMPONENTS = [
    "HitCountsJointComponent.js",
    "SideSumComponent.js",
    "SideHitMatchingComponent.js",
]
# main.js registers the joint component per paired ends and the single-line
# component per unpaired group; the side components are main-global.js's
# alone -- they need a whole side's clues, which only exists once every frame
# line is drawn.
LOCAL_COMPONENTS = ["HitCountsJointComponent.js", "HitCountsComponent.js"]


def comment_text(n):
    return (
        "Hit Counts. An outside clue counts the cells whose digit equals "
        "their distance from that clue, reading inward. A clue can be 0."
    )


def hits(v, _cells):
    # cells whose digit equals their 1-based distance from the clue
    return sum(1 for i, x in enumerate(v) if x == i + 1)


def add_hit_count(m, x, cells, kk, n, tag):
    # exactly kk cells hold their 1-based distance from the clue
    bs = []
    for i, cell in enumerate(cells):
        b = m.NewBoolVar(f"h{tag}_{i}")
        m.Add(x[cell] == i + 1).OnlyEnforceIf(b)
        m.Add(x[cell] != i + 1).OnlyEnforceIf(b.Not())
        bs.append(b)
    m.Add(sum(bs) == kk)


def no_zero_cage(interior):
    # look-and-say cage "00" = "zero 0s": keeps the digit 0 out of the interior,
    # so only the clue ring may be 0. Paired with minDigit=0 on the puzzle.
    return [
        {
            "type": 304,
            "name": "Disallow 0 in the main grid",
            "cages": [{"value": "00", "cells": interior}],
            "style": {"cage": {"color": "#ffffff00"}, "text": {"color": "#ffffff00"}},
        }
    ]


SPEC = Spec(
    dir=HERE,
    title="Hit Counts",
    lines_name="Hit Counts Lines",
    components=COMPONENTS,
    local_components=LOCAL_COMPONENTS,
    min_digit=0,
    clue_fn=hits,
    cp_sat_clue_fn=add_hit_count,
    comment_fn=comment_text,
    extra_cages=no_zero_cage,
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
            (HERE / "gen_9x9.json").rename(HERE / "gen.json")
            print("renamed to PUZZLE_LINK.txt and gen.json (the plain-named 9x9 pair)")
