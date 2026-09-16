# build_link.py --component --out: decode the output and assert the only
# difference from the committed PUZZLE_LINK.txt is the swapped-in component's
# code. ISOFILL is global with one component and no groups, so there is no
# sibling component to leave untouched (contrast the local-groups examples).
# Mirrors examples/skyscraper/build_link.test.py.
#
# Also covers build_hard_links.py's FIXTURES: write_links, run into a temp
# dir with every subprocess call made to fail, must write each hard-fixture
# link (PUZZLE_LINK_30g.txt and friends) byte-equal to the committed one, so
# drift in a fixture is caught and the build stays in-process.
#
#   uv run --with lzstring examples/isofill/build_link.test.py

import pathlib
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

import build_hard_links
from build_hard_links import FIXTURES
from build_link import CONSTRAINT_NAME, build, build_on_board, check
from link_codec import decode_puzzle
from link_swap import blanked, find_constraint

if __name__ == "__main__":
    base_text = (HERE / "PUZZLE_LINK.txt").read_text().strip()
    base = decode_puzzle(base_text)

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)

        # the committed component round-trips to PUZZLE_LINK.txt byte-for-byte
        link, doc, n_clues = build(HERE / "IsofillComponent.js", HERE / "gen.json")
        check(link, doc, n_clues)
        assert link == base_text, (
            "the committed component must reproduce PUZZLE_LINK.txt exactly"
        )

        # a candidate file for the same registered component name, the shape a
        # real edit-and-retime loop uses
        # The edit has to be code: a comment is stripped out of the shipped
        # copy, which would leave the candidate byte-equal (#385).
        candidate = tmp / "IsofillComponent.js"
        candidate.write_text(
            (HERE / "IsofillComponent.js").read_text() + "\nconst CANDIDATE_EDIT = 1\n"
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

        # --board swaps the candidate's code into another committed link and
        # leaves that board's grid and clues alone -- the path `just time
        # isofill --board PUZZLE_LINK_30g.txt` takes
        board = HERE / "PUZZLE_LINK_30g.txt"
        board_doc = decode_puzzle(board.read_text().strip())
        board_out = tmp / "board.txt"
        board_link = build_on_board(candidate, board_out, board)
        swapped = decode_puzzle(board_link)
        assert swapped != board_doc, "--board did not swap the component code"
        assert blanked(swapped, CONSTRAINT_NAME) == blanked(
            board_doc, CONSTRAINT_NAME
        ), "--board changed more than the component's code"
        assert (
            find_constraint(swapped, CONSTRAINT_NAME)["definition"]["components"][0][
                "code"
            ]
            == find_constraint(cand_doc, CONSTRAINT_NAME)["definition"]["components"][
                0
            ]["code"]
        ), "--board must carry the candidate component's code"

    # build_hard_links writes the committed links byte for byte, spawning nothing
    def no_subprocess(*args, **kwargs):
        raise AssertionError(f"build_hard_links spawned a process: {args}")

    subprocess.run = subprocess.Popen = no_subprocess
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        build_hard_links.write_links(tmp)
        for link_name in FIXTURES.values():
            assert (tmp / link_name).read_bytes() == (HERE / link_name).read_bytes(), (
                f"build_hard_links wrote a {link_name} that differs from the committed one"
            )
        assert sorted(p.name for p in tmp.iterdir()) == sorted(FIXTURES.values()), (
            "build_hard_links left extra files behind"
        )

    print("ok")
