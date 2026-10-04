import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import CONSTRAINT_NAME
from link_codec import decode_puzzle
from link_swap import swap_build
from sm_document import find_constraint

if __name__ == "__main__":
    board = HERE / "PUZZLE_LINK.txt"
    base = decode_puzzle(board.read_text().strip())

    lc = find_constraint(base, CONSTRAINT_NAME)
    assert lc["definition"]["input"] == [] and lc["input"] == {}, (
        "the global board reads no drawn groups"
    )

    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "candidate.txt"
        component = HERE / "OutsideSudokuComponent.js"
        assert swap_build(board, component, out) == board.read_text().strip(), (
            "the committed component must round-trip to PUZZLE_LINK.txt"
        )
        assert (
            swap_build(board, component, out, backend=HERE / "main-global.js")
            == board.read_text().strip()
        ), "the committed main-global.js must round-trip to PUZZLE_LINK.txt"

    print("ok")
