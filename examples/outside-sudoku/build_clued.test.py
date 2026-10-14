import copy
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

import build_clued
from build_clued import BOARDS, build, twin_name
from sm_document import find_constraint
from sudoku_kit.link_codec import decode_puzzle
from untouched import leaves_untouched
from verify import CONSTRAINT_NAME, clue_groups


def _decode(path):
    return decode_puzzle(path.read_text().strip())


def test_names_follow_the_link_grammar():
    assert [twin_name(b) for b in BOARDS] == [
        "PUZZLE_LINK_clued.txt",
        "PUZZLE_LINK_4x4_clued.txt",
        "PUZZLE_LINK_6x6_clued.txt",
        "PUZZLE_LINK_clued_local.txt",
    ]


def test_each_twin_fills_only_blank_outside_clues_and_reproduces():
    names = [twin_name(b) for b in BOARDS]
    with (
        leaves_untouched([HERE / n for n in names]) as shipped,
        tempfile.TemporaryDirectory() as tmp,
    ):
        out = pathlib.Path(tmp)
        build(out)
        for n in names:
            assert (out / n).read_bytes() == shipped[HERE / n], (
                f"{n} does not reproduce byte-identically"
            )

    for board in BOARDS:
        base = _decode(HERE / board)
        twin = _decode(HERE / twin_name(board))
        W = base["puzzle"]["width"]
        clues = {g[0] for g in clue_groups(base, W, W - 2)}
        b, t = base["puzzle"]["cells"], twin["puzzle"]["cells"]
        blank = {i for i in clues if not b[i].get("given")}
        assert blank, f"{board} has no blank clue; a twin would be a copy"
        for i in clues:
            assert t[i].get("given") and t[i].get("value") is not None, (
                f"{board}: clue {i} is not filled in its twin"
            )
        for i in range(len(b)):
            if i not in blank:
                assert t[i] == b[i], f"{board}: cell {i} changed outside the blanks"
        base_p, twin_p = copy.deepcopy(base), copy.deepcopy(twin)
        base_p["puzzle"]["cells"] = twin_p["puzzle"]["cells"] = None
        assert base_p == twin_p, f"{board}: the twin differs beyond its cells"
        assert find_constraint(twin, CONSTRAINT_NAME) == find_constraint(
            base, CONSTRAINT_NAME
        ), f"{board}: the embedded constraint changed"


def test_a_board_that_is_not_unique_fails_loud():
    doc = _decode(HERE / "PUZZLE_LINK_4x4.txt")
    for c in doc["puzzle"]["cells"]:
        if c.get("given"):
            c.pop("given")
            c.pop("value")
    try:
        build_clued.make_twin(doc)
    except AssertionError as e:
        assert "not unique" in str(e), e
    else:
        raise AssertionError("a non-unique board built a twin")


def test_a_filled_clue_outside_its_window_fails_loud():
    base = _decode(HERE / "PUZZLE_LINK_4x4.txt")
    twin = _decode(HERE / twin_name("PUZZLE_LINK_4x4.txt"))
    W = base["puzzle"]["width"]
    first = build_clued.solve(base)
    blank = next(
        g
        for g in clue_groups(base, W, W - 2)
        if not base["puzzle"]["cells"][g[0]].get("given")
    )
    clue = blank[0]
    window = build_clued.window(base, blank)
    outside = ({1, 2, 3, 4} - {first[c] for c in window}).pop()
    twin["puzzle"]["cells"][clue] = {"value": outside, "given": True}
    try:
        build_clued.check_twin(base, twin, first)
    except AssertionError as e:
        assert "window" in str(e), e
    else:
        raise AssertionError("a clue outside its window passed")


if __name__ == "__main__":
    test_names_follow_the_link_grammar()
    test_each_twin_fills_only_blank_outside_clues_and_reproduces()
    test_a_board_that_is_not_unique_fails_loud()
    test_a_filled_clue_outside_its_window_fails_loud()
    print("ok")
