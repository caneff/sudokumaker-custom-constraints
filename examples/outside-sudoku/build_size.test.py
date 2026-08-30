# The generator's half of the window rule -- how long the window is, and which
# window digit becomes the clue -- and the recorded-seed rebuild path.
#
#   uv run --with lzstring examples/outside-sudoku/build_size.test.py
#
# No ortools: framebuild imports the solver only inside its search, so the
# clue functions, the document assembly, and the rebuild all reach this test
# with lzstring alone (which is all `just check` installs).

import json
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_size import spec_for
from framebuild import RULES_PREFIX, make_lines
from link_codec import decode_puzzle
from outside_rule import window_length_by_box, window_length_by_region
from rebuild_size import rebuild

SIZES = [(4, 2, 2), (6, 2, 3), (9, 3, 3)]

# One row line and one column line of each shipped size, as framebuild draws
# them: interior (row, column) pairs, nearest the clue first.
ROW_9 = [(4, c) for c in range(9)]
COL_9 = [(r, 4) for r in range(9)]
ROW_6 = [(2, c) for c in range(6)]
COL_6 = [(r, 2) for r in range(6)]
ROW_4 = [(1, c) for c in range(4)]
COL_4 = [(r, 1) for r in range(4)]


def test_window_length_is_the_box_extent_along_the_line():
    # The README's numbers: 3 either way on a 9x9, 3 across and 2 down on a
    # 6x6 (boxes 2 tall by 3 wide), 2 either way on a 4x4.
    assert window_length_by_box(ROW_9, 3, 3) == 3
    assert window_length_by_box(COL_9, 3, 3) == 3
    assert window_length_by_box(ROW_6, 2, 3) == 3
    assert window_length_by_box(COL_6, 2, 3) == 2
    assert window_length_by_box(ROW_4, 2, 2) == 2
    assert window_length_by_box(COL_4, 2, 2) == 2


def test_window_never_runs_past_the_line():
    assert window_length_by_box([(0, 0), (0, 1)], 3, 3) == 2


def test_clue_is_the_largest_digit_of_the_window():
    clue = spec_for(3, 3).clue_fn
    # 9x9, window 3: the clue is the largest of 2, 3, 8 — the 5 and the 9
    # further down the line are outside the window and cannot be the clue.
    assert clue([2, 3, 8, 1, 4, 5, 6, 7, 9], ROW_9) == 8


def test_the_window_follows_the_direction_on_a_6x6():
    # Boxes 2 tall by 3 wide, so the same digits give a different clue
    # depending on which way the line runs.
    clue = spec_for(2, 3).clue_fn
    values = [1, 3, 6, 2, 5, 4]
    assert clue(values, ROW_6) == 6  # 3 across: max(1, 3, 6)
    assert clue(values, COL_6) == 3  # 2 down: max(1, 3)


def test_rebuild_reproduces_every_shipped_link_byte_for_byte():
    # The whole point of a deterministic clue_fn: the committed board comes
    # back out of its recorded seed data, with no fresh search.
    for n, _bh, _bw in SIZES:
        link = (HERE / f"PUZZLE_LINK_{n}x{n}.txt").read_text()
        assert rebuild(n) + "\n" == link, f"{n}x{n} does not rebuild byte-equal"


def test_every_recorded_clue_is_its_window_s_largest_digit():
    for n, bh, bw in SIZES:
        gen = json.loads((HERE / f"gen_{n}x{n}.json").read_text())
        grid, lines = gen["grid"], make_lines(n)
        for key, cells in lines.items():
            values = [grid[r][c] for r, c in cells]
            w = window_length_by_box(cells, bh, bw)
            assert gen["clue"][f"{key[0]}{key[1]}"] == max(values[:w])


def test_the_two_python_window_lengths_agree_on_a_shipped_board():
    # verify.py sizes the window off a decoded link's regions; the generator
    # sizes it off the box shape it was asked for. One rule, so one answer.
    for n, bh, bw in SIZES:
        doc = decode_puzzle((HERE / f"PUZZLE_LINK_{n}x{n}.txt").read_text().strip())[
            "puzzle"
        ]
        W = doc["width"]
        region = next(c for c in doc["constraints"] if c.get("type") == 1)["regions"]
        row = [i // W for i in range(W * W)]
        column = [i % W for i in range(W * W)]
        for key, cells in make_lines(n).items():
            line = [(r + 1) * W + c + 1 for r, c in cells]
            assert window_length_by_region(line, region, row, column) == (
                window_length_by_box(cells, bh, bw)
            ), f"{n}x{n} {key}: the two window lengths disagree"


def test_every_shipped_link_is_share_ready():
    for n, _bh, _bw in SIZES:
        doc = decode_puzzle((HERE / f"PUZZLE_LINK_{n}x{n}.txt").read_text().strip())[
            "puzzle"
        ]
        assert doc["comment"].startswith(RULES_PREFIX)
        # A cell holds a value only when it is a given: no solution digit and
        # no hidden clue ships pre-typed.
        assert not [c for c in doc["cells"] if "value" in c and not c.get("given")]
        # Sparse ring: the board shows only the clues its uniqueness proof
        # needed, so some of the 4n clue cells stay empty for the solver.
        shown = len(json.loads((HERE / f"gen_{n}x{n}.json").read_text())["active"])
        assert shown < 4 * n, f"{n}x{n} shows every clue -- the ring must stay sparse"


if __name__ == "__main__":
    test_window_length_is_the_box_extent_along_the_line()
    test_window_never_runs_past_the_line()
    test_clue_is_the_largest_digit_of_the_window()
    test_the_window_follows_the_direction_on_a_6x6()
    test_rebuild_reproduces_every_shipped_link_byte_for_byte()
    test_every_recorded_clue_is_its_window_s_largest_digit()
    test_the_two_python_window_lengths_agree_on_a_shipped_board()
    test_every_shipped_link_is_share_ready()
    print("ok")
