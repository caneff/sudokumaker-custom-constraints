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
from link_codec import decode_puzzle
from link_swap import blanked, find_constraint

N = 9  # the shipped board's interior
W = N + 2


def frame_groups():
    """The 4n frame lines of a W-wide board, clue cell first then the line
    inward -- the group order main.js reads (docs/example-layout.md)."""

    def at(r, c):
        return r * W + c

    groups = []
    for i in range(1, N + 1):
        groups.append([at(i, 0)] + [at(i, c) for c in range(1, N + 1)])
        groups.append([at(i, W - 1)] + [at(i, c) for c in range(N, 0, -1)])
        groups.append([at(0, i)] + [at(r, i) for r in range(1, N + 1)])
        groups.append([at(W - 1, i)] + [at(r, i) for r in range(N, 0, -1)])
    return groups


if __name__ == "__main__":
    base = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())

    # the shipped board draws every frame line as a group, clue cell first
    shipped = find_constraint(base, CONSTRAINT_NAME)["input"]["groups"]
    assert sorted(tuple(g["cells"]) for g in shipped) == sorted(
        tuple(g) for g in frame_groups()
    ), "the shipped groups are the 4n frame lines, clue first"

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
            build(HERE / "OutsideSudokuComponent.js", out, HERE / "main.js")
        )
        assert same == base, "the committed main.js must round-trip to PUZZLE_LINK.txt"

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
