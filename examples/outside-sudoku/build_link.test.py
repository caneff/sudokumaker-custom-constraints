# build_link.py --component --out: decode the output and assert the only
# difference from the committed PUZZLE_LINK.txt is the swapped-in component's
# code. Prior art: examples/numbered-rooms/build_link.test.py.
#
#   uv run --with lzstring examples/outside-sudoku/build_link.test.py

import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import CONSTRAINT_NAME, build
from link_codec import decode_puzzle, encode_link
from link_swap import blanked, find_constraint
from minify import minify_js

if __name__ == "__main__":
    base = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())

    # the shipped board runs the GLOBAL lane: main-global.js as the backend
    # and no drawn groups, so the backend builds the 4n frame lines itself
    # (docs/example-layout.md, "Which lane a link runs"). The local board and
    # its drawn groups are build_size.test.py's.
    lc = find_constraint(base, CONSTRAINT_NAME)
    assert lc["definition"]["backend"]["code"] == minify_js(
        (HERE / "main-global.js").read_text()
    ), "PUZZLE_LINK.txt must run main-global.js"
    assert lc["definition"]["input"] == [] and lc["input"] == {}, (
        "the global board reads no drawn groups"
    )

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        out = tmp / "candidate.txt"

        # a candidate file for the same registered component name
        # (OutsideSudokuComponent), the shape a real edit-and-retime loop uses
        candidate = tmp / "OutsideSudokuComponent.js"
        candidate.write_text(
            (HERE / "OutsideSudokuComponent.js").read_text() + "\n//! candidate edit\n"
        )

        link = build(candidate, out)
        doc = decode_puzzle(link)
        assert decode_puzzle(out.read_text().strip()) == doc, "did not write --out"

        # only the constraint's code differs from the committed link
        assert blanked(doc, CONSTRAINT_NAME) == blanked(base, CONSTRAINT_NAME)
        base_components = find_constraint(base, CONSTRAINT_NAME)["definition"][
            "components"
        ]
        new_components = find_constraint(doc, CONSTRAINT_NAME)["definition"][
            "components"
        ]
        assert [c["name"] for c in new_components] == [
            c["name"] for c in base_components
        ]
        assert new_components != base_components, "component code did not change"
        assert (
            find_constraint(doc, CONSTRAINT_NAME)["definition"]["backend"]["code"]
            == find_constraint(base, CONSTRAINT_NAME)["definition"]["backend"]["code"]
        )

        # swapping the currently-shipped component back in reproduces
        # PUZZLE_LINK.txt exactly; so does the committed main code
        same = decode_puzzle(build(HERE / "OutsideSudokuComponent.js", out))
        assert same == base, (
            "the committed component must round-trip to PUZZLE_LINK.txt"
        )
        same = decode_puzzle(
            build(HERE / "OutsideSudokuComponent.js", out, HERE / "main-global.js")
        )
        assert same == base, (
            "PUZZLE_LINK.txt runs the global lane, so the committed "
            "main-global.js must round-trip to it"
        )

        # a component whose name is not registered on the constraint fails
        # loud, not silently
        stranger = tmp / "NotRegisteredComponent.js"
        stranger.write_text("function update () {}\n")
        try:
            build(stranger, out)
            raise AssertionError(
                "expected a failure for an unregistered component name"
            )
        except ValueError:
            pass

        # --board swaps against a link other than PUZZLE_LINK.txt, which is how
        # `just time outside-sudoku --board PUZZLE_LINK_local.txt` reaches the
        # local board. Build a distinguishable board from the base doc.
        other_doc = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
        other_doc["puzzle"]["name"] += " (other board)"
        other_board = tmp / "other_board.txt"
        other_board.write_text(encode_link(other_doc) + "\n")

        board_doc = decode_puzzle(build(candidate, out, board_path=other_board))
        assert board_doc["puzzle"]["name"] == other_doc["puzzle"]["name"], (
            "--board must swap against the given board, not PUZZLE_LINK.txt"
        )
        assert blanked(board_doc, CONSTRAINT_NAME) == blanked(
            other_doc, CONSTRAINT_NAME
        )
        # omitting --board keeps the default byte-identical
        assert build(candidate, out) == link

        # the committed local board takes a component swap too: that is the
        # board the local timing row is measured on
        local = decode_puzzle(
            build(candidate, out, board_path=HERE / "PUZZLE_LINK_local.txt")
        )
        committed_local = decode_puzzle(
            (HERE / "PUZZLE_LINK_local.txt").read_text().strip()
        )
        assert blanked(local, CONSTRAINT_NAME) == blanked(
            committed_local, CONSTRAINT_NAME
        )

    print("ok")
