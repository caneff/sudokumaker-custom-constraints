"""ISOFILL uniqueness checker (OR-Tools CP-SAT).

    uv run --with ortools examples/isofill/verify.py            # self-check
    uv run --with ortools examples/isofill/verify.py gen.json

gen.json: {"grid": [N strings of digits], "clues": [[r, c], ...],
"minDigit": 0}. The clues name the given cells; their digits come from the
grid. The board is W x H (the grid's rows and their width) with D digits from
minDigit (default 0), D defaulting to the width: 10x10 with 0-9, a 9x9 with
1-9, or a rectangle whose "digits" key says how many regions the cells split
into. Each region holds cells / D cells.

The rule and its CP-SAT model live in examples/_shared/isofill_model.py,
shared with the ring board in examples/isofill-skyscraper.

Every function here takes the `Board` it works on. Nothing is read off module
state, so two boards can be checked in one process -- which is what
verify.test.py and `just verify-isofill` do.
"""

import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "_shared"))
from isofill_model import LIMIT, Board, model, sample
from sudoku_kit import cpsat


def strip(board, grid, seed):
    """Hundreds of solves, none of them the proof that ships: the clue set this
    lands on is written to a gen JSON and re-proved by `unique` before the
    link is shared, so these run on the portfolio."""
    givens = {(r, c): int(grid[r][c]) for r, c in board.cells}
    order = list(board.cells)
    random.Random(seed).shuffle(order)
    for p in order:
        v = givens.pop(p)
        if not unique(board, givens, reproducible=False):
            givens[p] = v
    return sorted(givens)


def unique(board, givens, limit=LIMIT, reproducible=True):
    """True if exactly one ISOFILL grid matches the givens, False if more.

    Raises ValueError when none does and TimeoutError when a solve hits `limit`
    seconds — a timeout is never reported as unique.

    Reproducible by default: one worker and seed 0, so a committed proof gives
    the same answer on every run. `reproducible=False` opens CP-SAT's
    portfolio, which is far faster and is what the generation searches want.
    """
    m, x = model(board, givens)
    first, is_unique = cpsat.solve_unique(m, x, limit, reproducible=reproducible)
    if first is None:
        raise ValueError("no ISOFILL grid matches the givens")
    return is_unique


def self_check(board):
    n = board.width
    assert board.height == board.digits == n, "self_check needs a square board"
    banded = ["".join(str(r) for _ in range(n)) for r in range(n)]

    def given(*rs):
        return {(r, c): int(banded[r][c]) for r in rs for c in range(n)}

    # Every row but the first given: the free row's cells must all be the
    # one missing digit.
    assert unique(board, given(*range(1, n))) is True
    # Every row but the first two given: the top strip can split between the
    # two missing digits many ways.
    assert unique(board, given(*range(2, n))) is False
    # Digit 0 pinned at both ends of row 0 with 1s between, every row but the
    # first two full: counts allow it, but 0 cannot connect through the
    # spare cells outside row 0.
    split = given(*range(2, n))
    split.update({(0, c): (0 if c in (0, n - 1) else 1) for c in range(n)})
    try:
        unique(board, split)
    except ValueError:
        pass
    else:
        raise AssertionError("disconnected region accepted")
    try:
        unique(board, {}, limit=0.001)
    except TimeoutError:
        pass
    else:
        raise AssertionError("timeout reported a verdict")
    print("self-check ok")


if __name__ == "__main__":
    if len(sys.argv) == 1:
        self_check(Board.of(10))
    elif sys.argv[1] in ("sample", "strip"):
        # verify.py sample <seed> [width] [minDigit] [height] [digits]: a full grid as gen.json
        # with every cell given, ready for app-strip.mjs --grid.
        # verify.py strip <seed> [width] [minDigit] [height] [digits]: the same grid stripped to a
        # minimal unique clue set with CP-SAT (slower than the app strip; fine
        # for a 9x9).
        given = [int(a) for a in sys.argv[2:]]
        seed, width, lo, height, digits = given + [None] * (5 - len(given))
        board = Board.of(width or 10, height, lo=lo or 0, digits=digits)
        grid = sample(board, seed)
        clues = strip(board, grid, seed) if sys.argv[1] == "strip" else board.cells
        doc = {"grid": grid, "clues": clues, "minDigit": board.lo}
        if board.digits != board.width:
            doc["digits"] = board.digits
        print(json.dumps(doc))
    else:
        doc = json.loads(Path(sys.argv[1]).read_text())
        board = Board.of_doc(doc)
        # The one proof here that does NOT run reproducible: the portfolio is
        # the configuration measured on the 10x10 proofs (README, "verify.py",
        # has the numbers). Nothing this prints is committed except the verdict itself, and the
        # verdict is a property of the model, not of the search -- the two
        # configurations agree wherever both terminate, and only one of them
        # terminates. See README, "verify.py".
        ok = unique(board, board.givens(doc), reproducible=False)
        print("unique" if ok else "not unique")
        sys.exit(0 if ok else 1)
