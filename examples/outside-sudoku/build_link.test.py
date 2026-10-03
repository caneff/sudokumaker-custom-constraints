# The shipped board runs the global lane, and swapping its committed component
# and main-global.js back in reproduces PUZZLE_LINK.txt byte for byte. What a
# swap may change is link_swap.test.py's; the local board and its drawn groups
# are build_size.test.py's.
#
#   uv run examples/outside-sudoku/build_link.test.py

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

    # the shipped board runs the GLOBAL lane: no drawn groups, so the backend
    # builds the 4n frame lines itself (docs/example-layout.md, "Which lane a
    # link runs"). That it runs main-global.js is the round trip below and
    # build_size.test.py's lane check.
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
