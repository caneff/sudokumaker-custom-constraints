# build_link.py --component --out: decode the output and assert the only
# difference from the committed PUZZLE_LINK.txt is the swapped-in component's
# code, and that swapping one Skyscraper Lines component leaves any other
# component and the backend untouched. Prior art: the check in
# build_original.py, and examples/_shared/probe_link.test.py.
#
#   uv run --with lzstring examples/skyscraper/build_link.test.py

import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import CONSTRAINT_NAME, build
from link_codec import decode_puzzle, encode_link
from link_swap import blanked, find_constraint

if __name__ == "__main__":
    base = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        out = tmp / "candidate.txt"

        # a candidate file for the same registered component name, the shape
        # a real edit-and-retime loop uses
        candidate = tmp / "SkyscraperLineComponent.js"
        candidate.write_text(
            (HERE / "SkyscraperLineComponent.js").read_text() + "\n//! candidate edit\n"
        )

        link = build(candidate, out)
        doc = decode_puzzle(link)
        assert decode_puzzle(out.read_text().strip()) == doc, "did not write --out"

        # only the constraint's code differs from the committed link
        assert blanked(doc, CONSTRAINT_NAME) == blanked(base, CONSTRAINT_NAME)

        base_components = {
            c["name"]: c["code"]
            for c in find_constraint(base, CONSTRAINT_NAME)["definition"]["components"]
        }
        new_components = {
            c["name"]: c["code"]
            for c in find_constraint(doc, CONSTRAINT_NAME)["definition"]["components"]
        }
        assert new_components.keys() == base_components.keys()
        assert (
            new_components["SkyscraperLineComponent"]
            != base_components["SkyscraperLineComponent"]
        )
        # the backend is untouched
        assert (
            find_constraint(doc, CONSTRAINT_NAME)["definition"]["backend"]["code"]
            == find_constraint(base, CONSTRAINT_NAME)["definition"]["backend"]["code"]
        )

        # swapping the currently-shipped component back in reproduces
        # PUZZLE_LINK.txt exactly
        same = decode_puzzle(build(HERE / "SkyscraperLineComponent.js", out))
        assert same == base, (
            "the committed component must round-trip to PUZZLE_LINK.txt"
        )

        # --board: swap against a different committed link, not just
        # PUZZLE_LINK.txt. Build one from a copy of the base doc with a
        # harmless field changed, so it is distinguishable from base but
        # still a valid "Skyscraper Lines" board.
        other_doc = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
        other_doc["puzzle"]["name"] = other_doc["puzzle"]["name"] + " (other board)"
        other_board = tmp / "other_board.txt"
        other_board.write_text(encode_link(other_doc) + "\n")

        board_link = build(candidate, out, board_path=other_board)
        board_doc = decode_puzzle(board_link)
        assert board_doc["puzzle"]["name"] == other_doc["puzzle"]["name"], (
            "--board must swap against the given board, not PUZZLE_LINK.txt"
        )
        assert blanked(board_doc, CONSTRAINT_NAME) == blanked(
            other_doc, CONSTRAINT_NAME
        )

        # omitting --board keeps default behaviour byte-identical
        default_link = build(candidate, out)
        assert default_link == link

        # an unknown component name fails loud, not silently
        try:
            build(HERE / "original" / "CustomSkyscraperLineComponent.js", out)
            raise AssertionError(
                "expected a failure for an unregistered component name"
            )
        except ValueError:
            pass

    print("ok")
