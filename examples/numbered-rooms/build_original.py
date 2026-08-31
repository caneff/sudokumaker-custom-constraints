# Rebuild the shipped Numbered Rooms puzzle (PUZZLE_LINK.txt) with ChinStrap's
# ORIGINAL wrapper code instead of the improved components, so the two can be
# timed on the same grid, givens, and clues. Only the constraint code differs.
#
#   uv run --with lzstring examples/numbered-rooms/build_original.py
#
# Writes PUZZLE_LINK_original.txt next to this script and checks that the two
# links differ only in the "Custom Numbered Rooms" constraint's own code and
# input. PUZZLE_LINK.txt is the source of truth; this mirrors
# skyscraper/build_original.py. The original wrapper renames its component and
# swaps the backend too, so it uses replace_constraint_code directly rather
# than build_link.py's same-name-only --component contract.
#
# PUZZLE_LINK.txt runs the global lane (docs/example-layout.md), so it ships no
# drawn groups. The original wrapper reads `input.groups` directly, so the
# original variant gets the explicit frame groups built here -- the same 4n
# lines main-global.js builds itself, handed to the wrapper the way it expects
# them.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from framebuild import frame_groups as _frame_groups
from framebuild import make_lines
from link_codec import decode_puzzle, encode_link
from link_swap import find_constraint, frame_only, replace_constraint_code
from minify import minify_js

HERE = pathlib.Path(__file__).parent
CONSTRAINT_NAME = "Custom Numbered Rooms"
N = 9  # the shipped board's interior


def frame_groups(n=N):
    """The 4n drawn groups for the n x n frame the shipped board carries --
    the input the original wrapper reads, on a board whose own lane ships
    none. The same shape a generated local board carries."""
    return _frame_groups(n, make_lines(n))


def with_frame_groups(doc):
    """Return a copy of `doc` with the constraint's drawn groups filled in:
    the local-lane input a groups-reading backend needs."""
    lc = find_constraint(doc, CONSTRAINT_NAME)
    lc["definition"]["input"] = [
        {"id": "groups", "label": "Groups", "params": {"type": "raw"}}
    ]
    lc["input"] = {"groups": frame_groups()}
    return doc


def build_original(base):
    """`base` with the original wrapper's backend, component, and drawn
    groups. Only the constraint's own code and input change."""
    backend_code = minify_js((HERE / "original" / "main.js").read_text())
    component_code = minify_js(
        (HERE / "original" / "CustomIndexComponent.js").read_text()
    )
    assert backend_code and component_code, "original code empty"

    original = with_frame_groups(
        replace_constraint_code(
            base,
            CONSTRAINT_NAME,
            backend_code=backend_code,
            components=[
                {"type": "code", "name": "CustomIndexComponent", "code": component_code}
            ],
        )
    )
    assert frame_only(base, CONSTRAINT_NAME) == frame_only(original, CONSTRAINT_NAME), (
        "frames differ beyond the constraint's own code and input"
    )
    return original


def write(doc, out_path):
    link = encode_link(doc)
    assert decode_puzzle(link) == doc, "link does not round-trip"
    pathlib.Path(out_path).write_text(link + "\n")
    return link


if __name__ == "__main__":
    ours = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
    link = write(build_original(ours), HERE / "PUZZLE_LINK_original.txt")
    print(f"wrote PUZZLE_LINK_original.txt ({len(link)} chars)")
