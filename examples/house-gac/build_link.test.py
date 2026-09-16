# build_link.py: decode the output and assert it matches the committed
# PUZZLE_LINK.txt exactly, rebuilt or swapped back in (what a swap may change
# is link_swap.test.py's), and that --keep-comments
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

from build_link import BACKEND, COMPONENT, CONSTRAINT_NAME, build, check
from link_codec import decode_puzzle
from link_swap import blanked, find_constraint, swap_build
from minify import minify_js

if __name__ == "__main__":
    base_text = (HERE / "PUZZLE_LINK.txt").read_text().strip()
    base = decode_puzzle(base_text)

    # the committed component and backend round-trip to PUZZLE_LINK.txt
    # byte-for-byte, rebuilt from source and swapped back into the board
    link, doc, _sol, n_givens = build()
    check(link, doc)
    assert n_givens == 25
    assert link == base_text, (
        "the committed component/backend must reproduce PUZZLE_LINK.txt exactly"
    )
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "board.txt"
        board = HERE / "PUZZLE_LINK.txt"
        assert swap_build(board, COMPONENT, out, backend=BACKEND) == base_text

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
