# Two checks on the shipped link.
#
# 1. Swapping either shipped component back into PUZZLE_LINK.txt reproduces it
#    byte for byte. What a swap may change is link_swap.test.py's.
# 2. Rebuilding the board from gen.json against the code in the tree
#    (build_size.py --rebuild 9) reproduces it byte for byte, so the link is
#    neither stale against the components nor against the backend.
#
# That check_layout accepts the example is check_layout.py's own run over the
# tree, in the same gate.

import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_size import COMPONENTS, SPEC
from framebuild import RingGlobal
from link_swap import swap_build

if __name__ == "__main__":
    board = HERE / "PUZZLE_LINK.txt"
    shipped = board.read_text().strip()
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "candidate.txt"
        for component in COMPONENTS:
            assert swap_build(board, HERE / component, out) == shipped, (
                f"the committed {component} must round-trip to PUZZLE_LINK.txt"
            )

    assert RingGlobal(SPEC).rebuild(9) == shipped, (
        "build_size.py --rebuild 9 must reproduce PUZZLE_LINK.txt"
    )

    print("ok")
