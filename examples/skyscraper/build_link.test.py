# Two checks on the example's links.
#
# 1. Swapping the shipped component back into PUZZLE_LINK.txt reproduces it
#    byte for byte. What a swap may change is link_swap.test.py's.
# 2. The committed local links, built by `build_size.py <n> ... --paths`, pass
#    board_checks.check_local_board under this example's clue rule (#237,
#    #240).
#
#   uv run examples/skyscraper/build_link.test.py

import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from board_checks import check_local_board
from link_swap import swap_build


def visible(values):
    """The Skyscrapers clue for one line of digits: buildings that top every
    building before them, reading inward. A tie is hidden, which is what
    SkyscraperOneSidedComponent's ALLOW_TIES = false says.

    A fourth statement of the rule, restated here rather than imported: a
    test that read the rule off the generator would agree with it by
    construction and catch no drift. It must agree with build_size.sky,
    add_visibility, and the components -- change the rule, change all four
    (CODING_STANDARDS.md, "The rule has one home").
    """
    count = 0
    tallest = 0
    for v in values:
        if v > tallest:
            count += 1
            tallest = v
    return count


if __name__ == "__main__":
    board = HERE / "PUZZLE_LINK.txt"
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "candidate.txt"
        assert swap_build(board, HERE / "SkyscraperLineComponent.js", out) == (
            board.read_text().strip()
        ), "the committed component must round-trip to PUZZLE_LINK.txt"

    for tag in ("local", "6x6_local"):
        spec, doc = check_local_board(HERE, tag, "SkyscraperOneSidedComponent", visible)
        p = doc["puzzle"]
        assert (p["minDigit"], p["maxDigit"]) == (1, spec["n"])

    print("ok")
