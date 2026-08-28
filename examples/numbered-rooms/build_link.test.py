# build_link.py --component --out: decode the output and assert the only
# difference from the committed PUZZLE_LINK.txt is the swapped-in component's
# code. Prior art: the check in build_original.py, and
# examples/_shared/probe_link.test.py.
#
#   uv run --with lzstring examples/numbered-rooms/build_link.test.py

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
        # (NumberedRoomsComponent), the shape a real edit-and-retime loop uses
        candidate = tmp / "NumberedRoomsComponent.js"
        candidate.write_text(
            (HERE / "NumberedRoomsComponent.js").read_text() + "\n//! candidate edit\n"
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
        same = decode_puzzle(build(HERE / "NumberedRoomsComponent.js", out))
        assert same == base, (
            "the committed component must round-trip to PUZZLE_LINK.txt"
        )
        same = decode_puzzle(
            build(HERE / "NumberedRoomsComponent.js", out, HERE / "main.js")
        )
        assert same == base, "the committed main.js must round-trip to PUZZLE_LINK.txt"

        # a component whose name is not registered on the constraint fails
        # loud, not silently -- e.g. the differently-named original wrapper
        try:
            build(HERE / "ORIGINAL_CustomIndexComponent.js", out)
            raise AssertionError(
                "expected a failure for an unregistered component name"
            )
        except ValueError:
            pass

        # --global: input list emptied, groups gone, nothing else moved
        g = decode_puzzle(build(candidate, out, global_mode=True))
        lc = find_constraint(g, CONSTRAINT_NAME)
        assert lc["definition"]["input"] == [] and lc["input"] == {}
        lc["definition"]["input"] = find_constraint(base, CONSTRAINT_NAME)[
            "definition"
        ]["input"]
        lc["input"] = find_constraint(base, CONSTRAINT_NAME)["input"]
        assert blanked(g, CONSTRAINT_NAME) == blanked(base, CONSTRAINT_NAME)
        print("ok --global")

    print("ok")
