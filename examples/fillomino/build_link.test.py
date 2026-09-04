# build_link.py --component --out: decode the output and assert the only
# difference from the committed PUZZLE_LINK.txt is the swapped-in component's
# code. Fillomino is global with one component and no groups, so there is no
# sibling component to leave untouched. Mirrors examples/isofill/build_link.test.py.
#
#   uv run --with lzstring examples/fillomino/build_link.test.py

import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import (
    CONSTRAINT_NAME,
    RULE,
    TIMED_COMPONENT,
    build,
    build_on_board,
    check,
)
from link_codec import decode_puzzle
from link_swap import blanked, find_constraint

if __name__ == "__main__":
    base_text = (HERE / "PUZZLE_LINK.txt").read_text().strip()
    base = decode_puzzle(base_text)

    # fillomino is not sudoku, so its rules text must not carry the sudoku
    # sentence -- the NO_RULES_PREFIX half of the layout exemption (#305)
    assert not RULE.startswith("Normal sudoku rules apply"), (
        "fillomino rules must not open with the sudoku sentence"
    )

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)

        # the committed component round-trips to PUZZLE_LINK.txt byte-for-byte
        link, doc, n_clues = build(HERE / f"{TIMED_COMPONENT}.js", HERE / "gen.json")
        check(link, doc, n_clues)
        assert link == base_text, (
            "the committed component must reproduce PUZZLE_LINK.txt exactly"
        )

        # a candidate file for the same registered component name, the shape a
        # real edit-and-retime loop uses
        candidate = tmp / f"{TIMED_COMPONENT}.js"
        candidate.write_text(
            (HERE / f"{TIMED_COMPONENT}.js").read_text() + "\n//! candidate edit\n"
        )
        out = tmp / "candidate.txt"
        cand_link, cand_doc, cand_n_clues = build(candidate, HERE / "gen.json")
        check(cand_link, cand_doc, cand_n_clues)
        out.write_text(cand_link + "\n")
        assert decode_puzzle(out.read_text().strip()) == cand_doc, "did not write --out"

        # only the constraint's code differs from the committed link
        assert blanked(cand_doc, CONSTRAINT_NAME) == blanked(base, CONSTRAINT_NAME)

        base_code = find_constraint(base, CONSTRAINT_NAME)["definition"]["components"][
            0
        ]["code"]
        new_code = find_constraint(cand_doc, CONSTRAINT_NAME)["definition"][
            "components"
        ][0]["code"]
        assert new_code != base_code
        # the backend is untouched
        assert (
            find_constraint(cand_doc, CONSTRAINT_NAME)["definition"]["backend"]["code"]
            == find_constraint(base, CONSTRAINT_NAME)["definition"]["backend"]["code"]
        )

        # --board swaps the candidate's code into a committed link and leaves
        # that board's grid and clues alone -- the path `just time fillomino
        # --board <link>` takes
        board_out = tmp / "board.txt"
        board_link = build_on_board(candidate, board_out, HERE / "PUZZLE_LINK.txt")
        swapped = decode_puzzle(board_link)
        assert swapped != base, "--board did not swap the component code"
        assert blanked(swapped, CONSTRAINT_NAME) == blanked(base, CONSTRAINT_NAME), (
            "--board changed more than the component's code"
        )

    print("ok")
