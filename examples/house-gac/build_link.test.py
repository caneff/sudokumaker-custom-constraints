# build_link.py: decode the output and assert it matches the committed
# PUZZLE_LINK.txt exactly, that a candidate component's code round-trips
# through --component/--out, and that --board swaps a candidate's code into
# another committed link while changing nothing else.
#
#   uv run --with lzstring examples/house-gac/build_link.test.py

import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import BACKEND, COMPONENT, CONSTRAINT_NAME, build, build_on_board, check
from link_codec import decode_puzzle
from link_swap import blanked, find_constraint

if __name__ == "__main__":
    base_text = (HERE / "PUZZLE_LINK.txt").read_text().strip()
    base = decode_puzzle(base_text)

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)

        # the committed component and backend round-trip to PUZZLE_LINK.txt
        # byte-for-byte
        link, doc, _sol, n_givens = build()
        check(link, doc)
        assert n_givens == 25
        assert link == base_text, (
            "the committed component/backend must reproduce PUZZLE_LINK.txt exactly"
        )

        # a candidate component file for the same registered name, the shape a
        # real edit-and-retime loop uses. The edit has to be code: a comment
        # stripped out of the shipped copy leaves the candidate byte-equal (#385).
        candidate = tmp / "HouseGacComponent.js"
        candidate.write_text(COMPONENT.read_text() + "\nconst CANDIDATE_EDIT = 1\n")
        out = tmp / "candidate.txt"
        cand_link, cand_doc, _cand_sol, cand_n_givens = build(component_path=candidate)
        check(cand_link, cand_doc)
        assert cand_n_givens == 25
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

        # --board swaps the candidate's code into another committed link and
        # leaves that board's grid and clues alone -- the path
        # `just time house-gac --board PUZZLE_LINK.txt` takes, and the one
        # #427's harder fixture will use once it lands beside this link.
        board_out = tmp / "board.txt"
        board_link = build_on_board(candidate, board_out, HERE / "PUZZLE_LINK.txt")
        swapped = decode_puzzle(board_link)
        assert swapped != base, "--board did not swap the component code"
        assert blanked(swapped, CONSTRAINT_NAME) == blanked(base, CONSTRAINT_NAME), (
            "--board changed more than the component's code"
        )
        assert (
            find_constraint(swapped, CONSTRAINT_NAME)["definition"]["components"][0][
                "code"
            ]
            == find_constraint(cand_doc, CONSTRAINT_NAME)["definition"]["components"][
                0
            ]["code"]
        ), "--board must carry the candidate component's code"

    assert BACKEND.name == "main.js"
    print("ok")
