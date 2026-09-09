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
    # Two boards alive at once: each model carries its own board's cells, and
    # a 4x4 proof built beside a 5x5 one still models a 4x4.
    five, four = Board.of(5), Board.of(4)
    _, x5 = verify.model(five, {})
    _, x4 = verify.model(four, {})
    assert (len(x5), len(x4)) == (25, 16), (len(x5), len(x4))
    givens = {(r, c): r for r in range(1, four.n) for c in range(four.n)}
    assert verify.unique(four, givens) is True


def test_sample_reports_a_spent_time_cap_as_a_timeout():
    # `sample` runs under a cap too, and "no grid yet" is not "no grid exists":
    # the two failures need telling apart from the message alone.
    limit = verify.LIMIT
    verify.LIMIT = 0.0001
    try:
        verify.sample(Board.of(9, 1), seed=1)
    except TimeoutError as e:
        assert "seed 1" in str(e), e
    else:
        raise AssertionError("a spent time cap returned a grid")
    finally:
        verify.LIMIT = limit


if __name__ == "__main__":
    test_self_check()
    test_min_digit_offsets_the_whole_digit_range()
    test_timeout_has_headroom_on_a_bigger_board()
    test_two_boards_in_one_process_do_not_read_each_other()
    test_sample_reports_a_spent_time_cap_as_a_timeout()
    print("ok")
