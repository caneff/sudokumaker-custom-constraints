import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import read_gen
from flatmate_model import N, prove_recorded, rule_forced_flatmates, unique_solution
from link_codec import decode_puzzle


def verify(gen=HERE / "gen.json", link=HERE / "PUZZLE_LINK.txt"):
    """Return the rule-forced (5, flatmate) cell pairs. Raises AssertionError
    naming the first check that fails."""
    grid, givens, extras, _spec = read_gen(gen)
    solution = prove_recorded(givens, grid, extras)
    assert unique_solution(givens, flatmate=False, extras=extras) is None, (
        "plain sudoku already has one solution on these givens: the rule is not needed"
    )
    forced = rule_forced_flatmates(givens, solution, extras=extras)
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
