import json
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_size import SPEC
from frame import ring_cell
from framebuild import (
    LOCAL_RULES_SUFFIX,
    RULES_PREFIX,
    RingGlobal,
    RingLocal,
    make_lines,
)
from link_codec import decode_puzzle
from minify import minify_file
from outside_rule import window_length_by_box, window_length_by_region
from sm_document import find_constraint

SIZES = [(4, 2, 2), (6, 2, 3), (9, 3, 3)]
CONSTRAINT_NAME = "Custom Outside Sudoku"


def link_path(n, lane=RingGlobal):
    return lane(SPEC).files(n)[0]


def gen_path(n, lane=RingGlobal):
    return lane(SPEC).files(n)[1]


ROW_9 = [(4, c) for c in range(9)]
COL_9 = [(r, 4) for r in range(9)]
ROW_6 = [(2, c) for c in range(6)]
COL_6 = [(r, 2) for r in range(6)]
ROW_4 = [(1, c) for c in range(4)]
COL_4 = [(r, 1) for r in range(4)]


def test_window_length_is_the_box_extent_along_the_line():
    assert window_length_by_box(ROW_9, 3, 3) == 3
    assert window_length_by_box(COL_9, 3, 3) == 3
    assert window_length_by_box(ROW_6, 2, 3) == 3
    assert window_length_by_box(COL_6, 2, 3) == 2
    assert window_length_by_box(ROW_4, 2, 2) == 2
    assert window_length_by_box(COL_4, 2, 2) == 2


def test_window_never_runs_past_the_line():
    assert window_length_by_box([(0, 0), (0, 1)], 3, 3) == 2


def test_clue_is_the_largest_digit_of_the_window():
    clue = SPEC.clue_fn
    assert clue([2, 3, 8, 1, 4, 5, 6, 7, 9], ROW_9, (3, 3)) == 8


def test_the_window_follows_the_direction_on_a_6x6():
    clue = SPEC.clue_fn
    values = [1, 3, 6, 2, 5, 4]
    assert clue(values, ROW_6, (2, 3)) == 6
    assert clue(values, COL_6, (2, 3)) == 3


def test_rebuild_reproduces_every_shipped_link_byte_for_byte():
    for n, _bh, _bw in SIZES:
        link = link_path(n).read_text()
        assert RingGlobal(SPEC).rebuild(n) + "\n" == link, (
            f"{n}x{n} does not rebuild byte-equal"
        )
    local = link_path(9, RingLocal).read_text()
    assert RingLocal(SPEC).rebuild(9) + "\n" == local, (
        "the local board does not rebuild byte-equal"
    )


def test_every_recorded_clue_is_its_window_s_largest_digit():
    for n, bh, bw in SIZES:
        gen = json.loads(gen_path(n).read_text())
        grid, lines = gen["grid"], make_lines(n)
        for key, cells in lines.items():
            values = [grid[r][c] for r, c in cells]
            w = window_length_by_box(cells, bh, bw)
            assert gen["clue"][f"{key[0]}{key[1]}"] == max(values[:w])


def test_the_two_python_window_lengths_agree_on_a_shipped_board():
    for n, bh, bw in SIZES:
        doc = decode_puzzle(link_path(n).read_text().strip())["puzzle"]
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
        doc = decode_puzzle(link_path(n).read_text().strip())["puzzle"]
        assert doc["comment"].startswith(RULES_PREFIX)
        assert not [c for c in doc["cells"] if "value" in c and not c.get("given")]
        shown = len(json.loads(gen_path(n).read_text())["active"])
        assert shown < 4 * n, f"{n}x{n} shows every clue -- the ring must stay sparse"


def test_the_two_lanes_ship_the_boards_their_names_promise():
    for lane, backend, drawn in (
        (RingGlobal, "main-global.js", False),
        (RingLocal, "main.js", True),
    ):
        doc = decode_puzzle(link_path(9, lane).read_text().strip())
        lc = find_constraint(doc, CONSTRAINT_NAME)
        assert lc["definition"]["backend"]["code"] == minify_file(HERE / backend), (
            f"{link_path(9, lane).name} must run {backend}"
        )
        groups = lc["input"].get("groups", [])
        assert bool(groups) is drawn, f"{backend}: drawn groups {drawn} expected"
        if drawn:
            W = 11
            want = {
                tuple(
                    [
                        W * ring_cell(f"{k[0]}{k[1]}", W)[0]
                        + ring_cell(f"{k[0]}{k[1]}", W)[1]
                    ]
                    + [(r + 1) * W + c + 1 for r, c in cells]
                )
                for k, cells in make_lines(9).items()
            }
            assert {tuple(g["cells"]) for g in groups} == want, (
                "the local board's drawn groups must be the 36 frame lines, "
                "clue cell first"
            )


def test_the_local_board_is_share_ready():
    doc = decode_puzzle(link_path(9, RingLocal).read_text().strip())["puzzle"]
    assert doc["comment"].startswith(RULES_PREFIX)
    assert not [c for c in doc["cells"] if "value" in c and not c.get("given")]
    # Its lines are rows and columns, so the rules text must not tell a solver
    # a line is no house -- that sentence belongs to a bent-path board.
    assert LOCAL_RULES_SUFFIX not in doc["comment"]
    shown = len(json.loads(gen_path(9, RingLocal).read_text())["active"])
    assert shown < 4 * 9, (
        "the local board shows every clue -- the ring must stay sparse"
    )


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
    print("ok")
