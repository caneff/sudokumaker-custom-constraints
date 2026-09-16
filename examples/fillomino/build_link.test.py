# The fillomino board builds through _shared/bareboard.py: the committed
# component and gen.json reproduce PUZZLE_LINK.txt byte for byte. The
# component swap is link_swap.test.py's.
#
#   uv run examples/fillomino/build_link.test.py

import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import RULE, TIMED_COMPONENT, build, check

if __name__ == "__main__":
    # fillomino is not sudoku, so its rules text must not carry the sudoku
    # sentence -- the NO_RULES_PREFIX half of the layout exemption (#305)
    assert not RULE.startswith("Normal sudoku rules apply"), (
        "fillomino rules must not open with the sudoku sentence"
    )

    link, doc, n_clues = build(HERE / f"{TIMED_COMPONENT}.js", HERE / "gen.json")
    check(link, doc, n_clues)
    assert link == (HERE / "PUZZLE_LINK.txt").read_text().strip(), (
        "the committed component must reproduce PUZZLE_LINK.txt exactly"
    )

    print("ok")
