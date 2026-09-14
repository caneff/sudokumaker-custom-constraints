# build_link.py: decode the output and assert it matches the committed
# PUZZLE_LINK.txt exactly, that a candidate component's code round-trips
# through --component/--out, that --board swaps a candidate's code into
# another committed link while changing nothing else, and that --keep-comments
# reproduces the committed PUZZLE_LINK_annotated.txt with the same board and
# givens and code that differs from the plain link only by comments and
# whitespace (#433).
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
from minify import minify_js

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

    # --keep-comments: the annotated link (#433) reproduces the committed
    # PUZZLE_LINK_annotated.txt exactly, carries the same board and givens as
    # the plain link, and its embedded code differs from the plain link's
    # only by comments and whitespace -- stripping both down to a full
    # minify makes them equal.
    annotated_text = (HERE / "PUZZLE_LINK_annotated.txt").read_text().strip()
    annotated_link, annotated_doc, _annotated_sol, annotated_n_givens = build(
        keep_comments=True
    )
    check(annotated_link, annotated_doc)
    assert annotated_n_givens == 25
    assert annotated_link == annotated_text, (
        "the committed component/backend must reproduce "
        "PUZZLE_LINK_annotated.txt exactly"
    )
    assert blanked(annotated_doc, CONSTRAINT_NAME) == blanked(base, CONSTRAINT_NAME), (
        "the annotated link must carry the same board and givens as the plain one"
    )
    plain_component_code = find_constraint(base, CONSTRAINT_NAME)["definition"][
        "components"
    ][0]["code"]
    annotated_component_code = find_constraint(annotated_doc, CONSTRAINT_NAME)[
        "definition"
    ]["components"][0]["code"]
    assert annotated_component_code != plain_component_code, (
        "the annotated component code must actually carry its comments"
    )
    assert minify_js(annotated_component_code) == minify_js(plain_component_code), (
        "the annotated component's code, stripped, must match the plain link's"
    )
    plain_backend_code = find_constraint(base, CONSTRAINT_NAME)["definition"][
        "backend"
    ]["code"]
    annotated_backend_code = find_constraint(annotated_doc, CONSTRAINT_NAME)[
        "definition"
    ]["backend"]["code"]
    assert minify_js(annotated_backend_code) == minify_js(plain_backend_code), (
        "the annotated backend's code, stripped, must match the plain link's"
    )

    assert BACKEND.name == "main.js"

    # the double-splice guard: a base link that already carries a House GAC
    # constraint must refuse rather than double it (AGENTS.md: a splicing
    # generator run twice on one file duplicates the scene silently)
    try:
        build(base_link=HERE / "PUZZLE_LINK.txt")
    except AssertionError as e:
        assert "already carries a House GAC constraint" in str(e)
    else:
        raise AssertionError(
            "build() did not refuse a base link that already has the filter"
        )

    print("ok")
