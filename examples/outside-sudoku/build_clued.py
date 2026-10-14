# Build the clued twins: each shipped board with every blank outside clue
# filled, so the app's "Find all solutions" reads it unique (#835; why the
# shipped boards read not-unique: docs/research/398-outside-sudoku-not-unique.md).
#
#   uv run --with lzstring --with ortools examples/outside-sudoku/build_clued.py
#
# A blank clue is free within its window, so the app counts each filling as a
# solution. The twin gives every clue the digit its window's first cell holds
# in the board's own CP-SAT solution. The solution comes from `verify`'s model,
# not from a typed grid: a board that is not unique, or a filled clue the
# solution does not hold in its window, fails here.

import copy
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from sm_document import write_link
from sudoku_kit.link_codec import decode_puzzle
from verify import clue_groups, solve_board, window

HERE = pathlib.Path(__file__).parent

# Every committed board, in the order its twin is reported.
BOARDS = (
    "PUZZLE_LINK.txt",
    "PUZZLE_LINK_4x4.txt",
    "PUZZLE_LINK_6x6.txt",
    "PUZZLE_LINK_local.txt",
)


def twin_name(board):
    """`clued` takes its fixed place in the tag order (check_layout.TAGS): after
    the size, before `local`."""
    stem = board.removesuffix(".txt").removesuffix("_local")
    local = "_local" if board.endswith("_local.txt") else ""
    return f"{stem}_clued{local}.txt"


def solve(link):
    """The board's one solution, as {cell: digit}; fails loud when it has none
    or is not unique."""
    first, unique, _, _ = solve_board(link)
    assert first is not None, "the board has no solution"
    assert unique, "the board is not unique: a twin would fix a guess"
    return first


def check_twin(base, twin, solution):
    """Every outside clue of `twin` is filled, and holds a digit its window
    has in `solution`."""
    W = base["puzzle"]["width"]
    cells = twin["puzzle"]["cells"]
    for group in clue_groups(base, W, W - 2):
        clue = cells[group[0]]
        assert clue.get("given") and clue.get("value") is not None, (
            f"clue {group[0]} is not filled"
        )
        held = {solution[c] for c in window(base, group)}
        assert clue["value"] in held, (
            f"clue {group[0]} = {clue['value']} is not in its window "
            f"(the solution holds {sorted(held)})"
        )


def make_twin(base):
    solution = solve(base)
    twin = copy.deepcopy(base)
    W = base["puzzle"]["width"]
    for group in clue_groups(base, W, W - 2):
        if not base["puzzle"]["cells"][group[0]].get("given"):
            twin["puzzle"]["cells"][group[0]] = {
                "value": solution[window(base, group)[0]],
                "given": True,
            }
    check_twin(base, twin, solution)
    return twin


def build(out_dir=HERE):
    for board in BOARDS:
        base = decode_puzzle((HERE / board).read_text().strip())
        write_link(make_twin(base), out_dir / twin_name(board))


if __name__ == "__main__":
    build()
    for board in BOARDS:
        print(f"wrote {twin_name(board)}")
