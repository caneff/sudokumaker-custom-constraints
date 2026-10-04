# Build an Outside Sudoku (interactive outside clue) puzzle link for any grid
# size, on the shared interactive-outside frame (`_shared/framebuild.py`):
# fresh grid, the true clue for every line, minimal interior givens and a
# minimal shown-clue set carved to a unique solution (OR-Tools).
#
#   uv run --with ortools --with lzstring examples/outside-sudoku/build_size.py 4 2 2
#   uv run --with ortools --with lzstring examples/outside-sudoku/build_size.py 6 2 3
#   uv run --with ortools --with lzstring examples/outside-sudoku/build_size.py 9 3 3
#   uv run --with ortools --with lzstring \
#       examples/outside-sudoku/build_size.py 9 3 3 1 --local
#   uv run --with lzstring examples/outside-sudoku/build_size.py --rebuild 6

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from framebuild import Spec, main
from outside_rule import post_membership, window_length_by_box

HERE = pathlib.Path(__file__).parent


def comment_text(_n):
    return (
        "Outside Sudoku. Each outside clue reads inward along its row or "
        "column: the clue digit must appear in the part of that line inside "
        "the nearest box. Blank clues must be deduced."
    )


def clue_fn(values, cells, box):
    # Any window digit satisfies the rule; picking one deterministically is
    # what lets a rebuild re-derive the same clues from the recorded seed.
    return max(values[: window_length_by_box(cells, *box)])


def cp_sat_clue_fn(m, x, cells, kk, n, tag, box):
    window = cells[: window_length_by_box(cells, *box)]
    post_membership(m, x, window, kk, tag)


SPEC = Spec(
    dir=HERE,
    title="Outside Sudoku",
    constraint_name="Custom Outside Sudoku",
    components=["OutsideSudokuComponent.js"],
    min_digit=1,
    clue_fn=clue_fn,
    cp_sat_clue_fn=cp_sat_clue_fn,
    comment_fn=comment_text,
    # This rule's window is a box extent along the line's DIRECTION, and a bent
    # path has none, so the local board draws the STRAIGHT frame lines and its
    # rules text must not say a line is no house.
    bent_lines=False,
)

if __name__ == "__main__":
    main(SPEC)
