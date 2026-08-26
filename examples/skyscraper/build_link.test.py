# build_link.py --component --out: decode the output and assert the only
# difference from the committed PUZZLE_LINK.txt is the swapped-in component's
# code, and that swapping one of the two Skyscraper Lines components leaves
# the other component and the backend untouched. Prior art: the check in
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
from link_codec import decode_puzzle
from link_swap import blanked, find_constraint

if __name__ == "__main__":
    base = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        out = tmp / "candidate.txt"

        # a candidate file for the same registered component name
        # (SkyscraperComponent), the shape a real edit-and-retime loop uses
        candidate = tmp / "SkyscraperComponent.js"
        candidate.write_text(
            (HERE / "SkyscraperComponent.js").read_text() + "\n//! candidate edit\n"
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
            new_components["SkyscraperComponent"]
            != base_components["SkyscraperComponent"]
        )
        # the sibling component and the backend are untouched
        assert (
            new_components["SkyscraperPairComponent"]
            == base_components["SkyscraperPairComponent"]
        )
        assert (
            find_constraint(doc, CONSTRAINT_NAME)["definition"]["backend"]["code"]
            == find_constraint(base, CONSTRAINT_NAME)["definition"]["backend"]["code"]
        )

        # swapping the currently-shipped component back in reproduces
        # PUZZLE_LINK.txt exactly
        same = decode_puzzle(build(HERE / "SkyscraperComponent.js", out))
        assert same == base, (
            "the committed component must round-trip to PUZZLE_LINK.txt"
        )

        # an unknown component name fails loud, not silently
        try:
            build(HERE / "original" / "CustomSkyscraperLineComponent.js", out)
            raise AssertionError(
                "expected a failure for an unregistered component name"
            )
        except ValueError:
            pass

    print("ok")
