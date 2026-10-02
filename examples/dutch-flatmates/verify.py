# Prove the shipped Dutch Flatmates board: the one solution gen.json records,
# unique under sudoku plus the flatmate rule, and the committed link carries
# exactly its givens.
#
#   uv run --with lzstring --with ortools examples/dutch-flatmates/verify.py
#
# Four checks, each a handful of single-worker CP-SAT solves:
#
#   1. The board has exactly one solution, and it is the grid gen.json records.
#      A timeout is never read as "no second solution" (`unique_solution` raises).
#   2. The rule is needed: plain sudoku on the same givens has more than one
#      solution, so the flatmate rule is not decoration.
#   3. At least one 5 has its flatmate forced by the rule rather than by the
#      givens alone: under plain sudoku with the givens, the flatmate cell can
#      take another digit, and only the rule pins it. The 5s that do are listed.
#   4. PUZZLE_LINK.txt decodes to the same givens as gen.json, cell for cell.
#
# `build_link.test.py` runs this, so `just check` re-proves the board.

import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import read_board
from flatmate_model import N, prove_recorded, rule_forced_flatmates, unique_solution
from link_codec import decode_puzzle


def verify(gen=HERE / "gen.json", link=HERE / "PUZZLE_LINK.txt"):
    """Run the four checks; return the rule-forced (5, flatmate) cell pairs.
    Raises AssertionError naming the first check that fails."""
    grid, givens = read_board(gen)
    solution = prove_recorded(givens, grid)
    assert unique_solution(givens, flatmate=False) is None, (
        "plain sudoku already has one solution on these givens: the rule is not needed"
    )
    forced = rule_forced_flatmates(givens, solution)
    assert forced, "no 5 has its flatmate forced by the rule rather than the givens"
    cells = decode_puzzle(pathlib.Path(link).read_text().strip())["puzzle"]["cells"]
    shipped = {
        divmod(i, N): cell["value"] for i, cell in enumerate(cells) if cell.get("given")
    }
    assert shipped == givens, "the link's givens are not gen.json's"
    return forced


if __name__ == "__main__":
    forced = verify()
    print("unique under sudoku + flatmate; plain sudoku is not")
    for five, mate in forced:
        print(
            f"  rule-forced: the 5 at r{five[0] + 1}c{five[1] + 1} has its flatmate at r{mate[0] + 1}c{mate[1] + 1}"
        )
