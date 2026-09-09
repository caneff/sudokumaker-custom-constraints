# verify.py's self_check() is already board-parameterised: reuse it on a small
# board instead of re-deriving its four cases here (prior art:
# examples/fillomino/generate.test.py's test_self_check). Adds the minDigit
# offset self_check() never covers, since gen_9x9.json ships minDigit 1.
#
#   uv run --with ortools examples/isofill/verify.test.py

import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

import verify
from verify import Board


def test_self_check():
    verify.self_check(Board.of(4))


def test_min_digit_offsets_the_whole_digit_range():
    # Rows 1-3 given as 2s, 3s, 4s on a minDigit-1 board: row 0 must be the
    # missing digit 1. gen_9x9.json ships minDigit 1 (just verify-isofill).
    board = Board.of(4, 1)
    givens = {(r, c): r + 1 for r in range(1, board.n) for c in range(board.n)}
    assert verify.unique(board, givens) is True


def test_timeout_has_headroom_on_a_bigger_board():
    # self_check()'s own 1ms cap at n=4 solves in ~23ms, only 20x margin. A
    # bigger board keeps the timeout unambiguous, and costs nothing since
    # the solve is aborted either way.
    try:
        verify.unique(Board.of(9), {}, limit=0.001)
    except TimeoutError:
        pass
    else:
        raise AssertionError("timeout reported a verdict")


def test_two_boards_in_one_process_do_not_read_each_other():
    # The board is a value, so nothing has to be reset between checks: a 4x4
    # proof run after a 5x5 one still models a 4x4, reading its own cell list
    # and not the last board anybody built.
    five = Board.of(5)
    verify.unique(five, {(r, c): r for r in range(1, 5) for c in range(5)})
    four = Board.of(4)
    _, x = verify.model(four, {})
    assert len(x) == 16, f"a 4x4 model carries 16 cells, not {len(x)}"
    assert (
        verify.unique(four, {(r, c): r for r in range(1, 4) for c in range(4)}) is True
    )


if __name__ == "__main__":
    test_self_check()
    test_min_digit_offsets_the_whole_digit_range()
    test_timeout_has_headroom_on_a_bigger_board()
    test_two_boards_in_one_process_do_not_read_each_other()
    print("ok")
