# verify.py's self_check() is already N-parameterised: reuse it on a small
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


def test_self_check():
    verify.set_board(4)
    verify.self_check()


def test_min_digit_offsets_the_whole_digit_range():
    # Rows 1-3 given as 2s, 3s, 4s on a minDigit-1 board: row 0 must be the
    # missing digit 1. gen_9x9.json ships minDigit 1 (just verify-isofill).
    verify.set_board(4, 1)
    givens = {(r, c): r + 1 for r in range(1, verify.N) for c in range(verify.N)}
    assert verify.unique(givens) is True


def test_timeout_has_headroom_on_a_bigger_board():
    # self_check()'s own 1ms cap at N=4 solves in ~23ms, only 20x margin. A
    # bigger board keeps the timeout unambiguous, and costs nothing since
    # the solve is aborted either way.
    verify.set_board(9)
    try:
        verify.unique({}, limit=0.001)
    except TimeoutError:
        pass
    else:
        raise AssertionError("timeout reported a verdict")


if __name__ == "__main__":
    test_self_check()
    test_min_digit_offsets_the_whole_digit_range()
    test_timeout_has_headroom_on_a_bigger_board()
    print("ok")
