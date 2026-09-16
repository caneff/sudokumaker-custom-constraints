# Two checks on the example's links.
#
# 1. Swapping each shipped component back into PUZZLE_LINK.txt reproduces it
#    byte for byte. What a swap may change is link_swap.test.py's.
# 2. The committed local links, built by `build_size.py <n> ... --paths`, pass
#    board_checks.check_local_board under this example's clue rule (#237,
#    #302), and run minDigit 0.
#
#   uv run examples/hit-counts/build_link.test.py

import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from board_checks import check_local_board
from link_swap import swap_build


def hits(values):
    """The Hit Counts clue for one line of digits: cells whose digit equals
    their 1-based distance from the clue.

    A fourth statement of the rule, restated here rather than imported: a
    test that read the rule off the generator would agree with it by
    construction and catch no drift. It must agree with build_size.hits,
    add_hit_count, and HitCountsComponent -- change the rule, change all four
    (CODING_STANDARDS.md, "The rule has one home").
    """
    return sum(1 for i, v in enumerate(values) if v == i + 1)


if __name__ == "__main__":
    board = HERE / "PUZZLE_LINK.txt"
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "candidate.txt"
        for name in (
            "HitCountsJointComponent",
            "SideSumComponent",
            "SideHitMatchingComponent",
        ):
            assert swap_build(board, HERE / f"{name}.js", out) == (
                board.read_text().strip()
            ), f"the committed {name} must round-trip to PUZZLE_LINK.txt"

    # the 9x9 stress board (accepted DNF) and the 6x6 twin that carries the
    # local timing row
    for tag in ("local", "6x6_local"):
        spec, doc = check_local_board(HERE, tag, "HitCountsComponent", hits)
        p = doc["puzzle"]
        assert (p["minDigit"], p["maxDigit"]) == (0, spec["n"]), (
            "hit-counts runs minDigit 0"
        )
    print("ok")
