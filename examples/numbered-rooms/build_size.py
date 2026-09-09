# Build a Numbered Rooms (interactive outside clue) puzzle link for any grid
# size, on the shared interactive-outside frame (`_shared/framebuild.py`):
# fresh grid, the true clue for every line, minimal interior givens and a
# minimal shown-clue set carved to a unique solution (OR-Tools).
#
#   uv run --with ortools --with lzstring examples/numbered-rooms/build_size.py 4 2 2
#   uv run --with ortools --with lzstring examples/numbered-rooms/build_size.py 6 2 3
#   uv run --with ortools --with lzstring examples/numbered-rooms/build_size.py 9 3 3
#   uv run --with ortools --with lzstring \
#       examples/numbered-rooms/build_size.py 9 3 3 3 --paths
#   uv run --with ortools --with lzstring \
#       examples/numbered-rooms/build_size.py --rebuild 9
#
# Args: n box_height box_width [seed_count] [--paths], or --rebuild n [--paths]
#       (box_height * box_width == n)
# Writes PUZZLE_LINK_<n>x<n>.txt and gen_<n>x<n>.json next to this script; the
# local 9x9 pair is plain-named (framebuild.board_files), and PUZZLE_LINK.txt
# itself is this example's hand-built original board, not a generated one.
# --rebuild re-encodes a committed board against the code in the tree right
# now, with no fresh CP-SAT search.
#
# --paths builds the LOCAL board instead: bent paths in place of the straight
# frame lines, shipped as drawn groups on the main.js lane, so the three rules
# that run on a bare line have a board to play and to time
# (`just time numbered-rooms --board PUZZLE_LINK_local.txt --ring-clues`). The
# 9x9 lands as PUZZLE_LINK_local.txt with gen_local.json beside it.
#
# The rule: the first cell of a line (nearest the clue) holds an index k; the
# clue equals the digit in the k-th cell of the line. Hidden clues are the
# interactive ones — the solver deduces them. These are share boards, not
# timing boards (PUZZLE_LINK.txt is the timing fixture).

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from framebuild import Spec, main

HERE = pathlib.Path(__file__).parent


# One rules text for both variants, so it says "line" and never "row or
# column": a local board's lines bend, and framebuild appends the sentence that
# says a drawn line is not a house. Same call as skyscraper's RULE_EXAMPLES.
def comment_text(n):
    return (
        "Numbered Rooms. Each outside clue reads inward along its line. The "
        "first cell holds an index k; the clue equals the digit in the k-th "
        "cell of that line. An index past the end of the line is illegal. "
        "Blank clues must be deduced."
    )


def numbered_room(v, _cells, _box):
    return v[v[0] - 1]


def add_numbered_room(m, x, cells, kk, n, tag, _box):
    # x[cells[x[cells[0]] - 1]] == kk, as one element constraint
    ix = m.NewIntVar(0, n - 1, f"ix{tag}")
    m.Add(ix == x[cells[0]] - 1)
    m.AddElement(ix, [x[c] for c in cells], kk)


SPEC = Spec(
    dir=HERE,
    title="Numbered Rooms",
    constraint_name="Numbered Rooms",
    components=["NumberedRoomsComponent.js"],
    min_digit=1,
    clue_fn=numbered_room,
    cp_sat_clue_fn=add_numbered_room,
    comment_fn=comment_text,
    # PUZZLE_LINK.txt is this example's hand-built original board, so the
    # framebuild 9x9 keeps its NxN name (framebuild.board_files).
    plain_global_9x9=False,
)

if __name__ == "__main__":
    main(SPEC)
