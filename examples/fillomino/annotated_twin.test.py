"""The annotated twin of the fillomino link (PUZZLE_LINK_annotated.txt) is the
shipped board with only its embedded code's comments kept: the same puzzle
document outside the constraints, and each embedded code block minifies back
to exactly the shipped one. A twin that drifted would be shared as the board
while playing another.

(That the twin's component is current against the component file is
check_layout's stale-code check; this holds the twin to the shipped link.)

    uv run examples/fillomino/annotated_twin.test.py
"""

import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import CONSTRAINT_NAME
from minify import minify_js
from sm_document import find_constraint
from sudoku_kit.link_codec import decode_puzzle


def the_annotated_twin_is_the_shipped_board_with_comments_kept():
    plain = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
    twin = decode_puzzle((HERE / "PUZZLE_LINK_annotated.txt").read_text().strip())
    assert {**twin["puzzle"], "constraints": None} == {
        **plain["puzzle"],
        "constraints": None,
    }, "the annotated twin is not the shipped board"
    kept = find_constraint(twin, CONSTRAINT_NAME)["definition"]
    bare = find_constraint(plain, CONSTRAINT_NAME)["definition"]
    pairs = [(kept["backend"]["code"], bare["backend"]["code"])] + [
        (k["code"], b["code"])
        for k, b in zip(kept["components"], bare["components"], strict=True)
    ]
    for code, shipped in pairs:
        assert minify_js(code) == shipped, "the twin's code is not the shipped code"


if __name__ == "__main__":
    the_annotated_twin_is_the_shipped_board_with_comments_kept()
    print("annotated_twin.test.py: ok")
