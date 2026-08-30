# Build a Numbered Rooms (interactive outside clue) puzzle link for any grid
# size, on the shared interactive-outside frame (`_shared/framebuild.py`):
# fresh grid, the true clue for every line, minimal interior givens and a
# minimal shown-clue set carved to a unique solution (OR-Tools).
#
#   uv run --with ortools --with lzstring examples/numbered-rooms/build_size.py 4 2 2
#   uv run --with ortools --with lzstring examples/numbered-rooms/build_size.py 6 2 3
#   uv run --with ortools --with lzstring examples/numbered-rooms/build_size.py 9 3 3
#
# Args: n box_height box_width [seed_count]   (box_height * box_width == n)
# Writes PUZZLE_LINK_<n>x<n>.txt and gen_<n>x<n>.json next to this script.
#
# The rule: the first cell of a line (nearest the clue) holds an index k; the
# clue equals the digit in the k-th cell of the line. Hidden clues are the
# interactive ones — the solver deduces them. These are share boards, not
# timing boards (PUZZLE_LINK.txt is the timing fixture).

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from framebuild import Spec, run

HERE = pathlib.Path(__file__).parent


def comment_text(n):
    return (
        "Numbered Rooms. Each outside clue reads inward along its row or column. "
        "The first cell holds an index k; the clue equals the digit in the k-th "
        "cell. Blank clues must be deduced."
    )


def numbered_room(v, _cells):
    return v[v[0] - 1]


def add_numbered_room(m, x, cells, kk, n, tag):
    # x[cells[x[cells[0]] - 1]] == kk, as one element constraint
    ix = m.NewIntVar(0, n - 1, f"ix{tag}")
    m.Add(ix == x[cells[0]] - 1)
    m.AddElement(ix, [x[c] for c in cells], kk)


SPEC = Spec(
    dir=HERE,
    title="Numbered Rooms",
    lines_name="Numbered Rooms",
    components=["NumberedRoomsComponent.js"],
    min_digit=1,
    clue_fn=numbered_room,
    cp_sat_clue_fn=add_numbered_room,
    comment_fn=comment_text,
)

if __name__ == "__main__":
    run(SPEC)
