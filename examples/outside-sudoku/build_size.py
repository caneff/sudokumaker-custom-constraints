# Build an Outside Sudoku (interactive outside clue) puzzle link for any grid
# size, on the shared interactive-outside frame (`_shared/framebuild.py`):
# fresh grid, the true clue for every line, minimal interior givens and a
# minimal shown-clue set carved to a unique solution (OR-Tools).
#
#   uv run --with ortools --with lzstring examples/outside-sudoku/build_size.py 4 2 2
#   uv run --with ortools --with lzstring examples/outside-sudoku/build_size.py 6 2 3
#   uv run --with ortools --with lzstring examples/outside-sudoku/build_size.py 9 3 3
#
# Args: n box_height box_width [seed_count]   (box_height * box_width == n)
# Writes PUZZLE_LINK_<n>x<n>.txt and gen_<n>x<n>.json next to this script.
#
# The rule: the clue digit appears in the line's window -- its first w cells,
# w being the extent of the nearest box along the line's direction. Hidden
# clues are the interactive ones: the solver deduces them. These are share
# boards, not timing boards (PUZZLE_LINK.txt is the timing fixture).
#
# The window length depends on the line's DIRECTION, which a 6x6 shows: boxes
# 2 tall by 3 wide give a window of 3 across a row and 2 down a column. A Spec
# therefore has to be built for one box shape -- `spec_for(bh, bw)` -- and
# framebuild hands both clue functions the line's cells, so each can read the
# direction off them.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from framebuild import Spec, run
from outside_rule import post_membership, window_length_by_box

HERE = pathlib.Path(__file__).parent


def comment_text(_n):
    return (
        "Outside Sudoku. Each outside clue reads inward along its row or "
        "column: the clue digit must appear in the part of that line inside "
        "the nearest box. Blank clues must be deduced."
    )


def spec_for(bh, bw):
    """The generator Spec for a board of `bh` by `bw` boxes.

    Both clue functions size the window from the line's own direction, so they
    need the box shape, which the Spec closes over.
    """

    def clue_fn(values, cells):
        # The largest digit of the window. Any window digit satisfies the rule;
        # picking one deterministically is what lets rebuild_size.py re-derive
        # the same clues from the recorded seed, with no fresh search.
        return max(values[: window_length_by_box(cells, bh, bw)])

    def cp_sat_clue_fn(m, x, cells, kk, n, tag):
        window = cells[: window_length_by_box(cells, bh, bw)]
        post_membership(m, x, window, kk, tag)

    return Spec(
        dir=HERE,
        title="Outside Sudoku",
        lines_name="Custom Outside Sudoku",
        components=["OutsideSudokuComponent.js"],
        min_digit=1,
        clue_fn=clue_fn,
        cp_sat_clue_fn=cp_sat_clue_fn,
        comment_fn=comment_text,
    )


if __name__ == "__main__":
    bh, bw = (int(a) for a in sys.argv[2:4])
    run(spec_for(bh, bw))
