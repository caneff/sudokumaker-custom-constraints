# Build a Running Start (interactive outside clue) puzzle link for any grid size.
#
# Generates a fresh grid, derives the running-start clue for every line, carves
# minimal interior givens and a minimal shown-clue set to a unique solution
# (OR-Tools), then assembles the whole SudokuMaker document parametrically and
# encodes it. Clues that stay hidden are the interactive ones: the solver reads
# them off the line as it solves. The shared machinery (grid, CP-SAT model,
# carve loop, frame assembly, round-trip check) lives in `_shared/framebuild.py`.
#
#   uv run --with ortools --with lzstring examples/running-start/build_size.py 4 2 2
#   uv run --with ortools --with lzstring examples/running-start/build_size.py 6 2 3
#
# Args: n box_height box_width   (box_height * box_width == n)
# Writes PUZZLE_LINK_<n>x<n>.txt and gen_<n>x<n>.json next to this script.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from framebuild import Spec, run

HERE = pathlib.Path(__file__).parent
COMPONENTS = ["RunningStartComponent.js", "RunningStartPairComponent.js"]

# One worked example per size: a line, then the left and right clue it gives.
RULE_EXAMPLES = {
    4: "a row with 1324 gives a left clue of 2 (1, 3) and a right clue of 1 (4)",
    6: "a row with 142356 gives a left clue of 2 (1, 4) and a right clue of 1 (6)",
    9: "a row with 142356789 gives a left clue of 2 (1, 4) and a right clue of 1 (9)",
}


CORNER_NOTE = (
    "The 1s in the corners only fill space for SudokuMaker's solver; "
    "delete them before publishing."
)


def rule_text(n):
    rule = (
        "Running Start: Outside cells on clues must contain a digit, and that "
        "digit indicates the length of the first ascending sequence in that "
        "direction."
    )
    ex = RULE_EXAMPLES.get(n)
    if ex:
        rule = f"{rule} For example, {ex}."
    return f"{rule}\n\n{CORNER_NOTE}"


def rs(v, _cells):
    # length of the first strictly ascending run, read inward
    k = 1
    for i in range(1, len(v)):
        if v[i] > v[i - 1]:
            k += 1
        else:
            break
    return k


def add_running_start(m, x, cells, kk, n, tag):
    # the first kk cells strictly ascend; the run breaks at cell kk unless it
    # already fills the whole line
    for i in range(1, kk):
        m.Add(x[cells[i]] > x[cells[i - 1]])
    if kk < n:
        m.Add(x[cells[kk]] < x[cells[kk - 1]])


SPEC = Spec(
    dir=HERE,
    title="Running Start",
    lines_name="Running Start Lines",
    components=COMPONENTS,
    min_digit=1,
    clue_fn=rs,
    cp_sat_clue_fn=add_running_start,
    comment_fn=rule_text,
)

if __name__ == "__main__":
    run(SPEC)
