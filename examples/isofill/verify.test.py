import json
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

import verify
from sudoku_kit import cpsat
from verify import Board


def test_self_check():
    verify.self_check(Board.of(4))


def test_min_digit_offsets_the_whole_digit_range():
    board = Board.of(4, lo=1)
    givens = {(r, c): r + 1 for r in range(1, board.height) for c in range(board.width)}
    assert verify.unique(board, givens) is True


def test_timeout_has_headroom_on_a_bigger_board():
    # self_check()'s own 1ms cap at n=4 solves in ~23ms, only 20x margin. A
    # bigger board keeps the timeout unambiguous.
    try:
        verify.unique(Board.of(9), {}, limit=0.001)
    except TimeoutError:
        pass
    else:
        raise AssertionError("timeout reported a verdict")


def test_two_boards_in_one_process_do_not_read_each_other():
    five, four = Board.of(5), Board.of(4)
    _, x5 = verify.model(five, {})
    _, x4 = verify.model(four, {})
    assert (len(x5), len(x4)) == (25, 16), (len(x5), len(x4))
    givens = {(r, c): r for r in range(1, four.height) for c in range(four.width)}
    assert verify.unique(four, givens) is True


def rows_given(board, rows):
    return {(r, c): r + board.lo for r in rows for c in range(board.width)}


def test_a_wide_board_proves_one_row_per_digit():
    # 6 wide, 4 high, 4 digits: regions of 6, so each row is a region.
    board = Board.of(6, 4, lo=1, digits=4)
    assert (board.size, board.digits) == (6, 4)
    assert verify.unique(board, rows_given(board, range(1, 4))) is True
    assert verify.unique(board, rows_given(board, range(2, 4))) is False


def test_a_tall_board_proves_with_more_digits_than_width():
    # 3 wide, 5 high, 5 digits: regions of 3.
    board = Board.of(3, 5, digits=5)
    assert (board.size, board.digits) == (3, 5)
    assert verify.unique(board, rows_given(board, range(1, 5))) is True


def test_digits_name_a_count_other_than_the_width():
    # 4 wide, 3 high, 2 digits: regions of 6 split many ways.
    board = Board.of(4, 3, lo=1, digits=2)
    assert board.size == 6
    assert verify.unique(board, {}) is False
    _, x = verify.model(board, {})
    assert len(x) == 12


def test_sample_fills_a_rectangle():
    board = Board.of(5, 3, lo=1, digits=3)
    grid = verify.sample(board, seed=1)
    assert [len(r) for r in grid] == [5, 5, 5]
    assert sorted(set("".join(grid))) == ["1", "2", "3"]
    assert all(row.count(d) == 5 for d in "123" for row in ["".join(grid)])


def test_a_rectangle_without_a_digit_count_is_refused():
    try:
        Board.of(4, 3)
    except ValueError as e:
        assert "digit count" in str(e), e
    else:
        raise AssertionError("a rectangle was built without a digit count")


def test_uneven_split_is_refused():
    try:
        Board.of(5, 3, digits=4)
    except ValueError as e:
        assert "15 cells" in str(e), e
    else:
        raise AssertionError("an uneven board was built")


def test_of_doc_reads_height_from_rows_and_digits_from_the_key():
    doc = {"grid": ["11222", "11222", "33333"], "clues": [], "minDigit": 1, "digits": 3}
    board = Board.of_doc(doc)
    assert (board.width, board.height, board.digits, board.size) == (5, 3, 3, 5)


def test_a_written_gen_reads_back_when_digits_equal_the_width():
    # 4 wide, 6 high, 4 digits: the written gen leaves `digits` out, and
    # reading it back must still give the same board.
    board = Board.of(4, 6, lo=1, digits=4)
    grid = ["1122", "1122", "1122", "3344", "3344", "3344"]
    doc = verify.gen_doc(board, grid, board.cells)
    assert "digits" not in doc, doc
    assert Board.of_doc(json.loads(json.dumps(doc))) == board


def test_a_region_holds_cells_over_digits_not_the_width():
    # 4 wide, 6 high, 4 digits: each region holds 6 cells, not 4, so four
    # 2x3 blocks are a valid grid.
    board = Board.of(4, 6, lo=1, digits=4)
    grid = ["1122", "1122", "1122", "3344", "3344", "3344"]
    m, _ = verify.model(board, board.givens({"grid": grid, "clues": board.cells}))
    status = cpsat.solver(10).Solve(m)
    assert status in cpsat.SOLVED, "a grid of four 6-cell regions broke the model"
    # Two cells of digit 1 left blank: the count of 6 forces them back.
    open_ = {(0, 0), (0, 1)}
    givens = {p: int(grid[p[0]][p[1]]) for p in board.cells if p not in open_}
    assert verify.unique(board, givens) is True


def test_sample_reports_a_spent_time_cap_as_a_timeout():
    try:
        verify.sample(Board.of(9, lo=1), seed=1, limit=0.0001)
    except TimeoutError as e:
        assert "seed 1" in str(e), e
    else:
        raise AssertionError("a spent time cap returned a grid")


if __name__ == "__main__":
    test_self_check()
    test_min_digit_offsets_the_whole_digit_range()
    test_timeout_has_headroom_on_a_bigger_board()
    test_two_boards_in_one_process_do_not_read_each_other()
    test_sample_reports_a_spent_time_cap_as_a_timeout()
    test_a_wide_board_proves_one_row_per_digit()
    test_a_tall_board_proves_with_more_digits_than_width()
    test_digits_name_a_count_other_than_the_width()
    test_sample_fills_a_rectangle()
    test_a_rectangle_without_a_digit_count_is_refused()
    test_uneven_split_is_refused()
    test_of_doc_reads_height_from_rows_and_digits_from_the_key()
    test_a_written_gen_reads_back_when_digits_equal_the_width()
    test_a_region_holds_cells_over_digits_not_the_width()
    print("ok")
