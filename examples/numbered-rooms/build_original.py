# Rebuild the shipped Numbered Rooms puzzle (PUZZLE_LINK.txt) with ChinStrap's
# ORIGINAL wrapper code instead of the improved components, so the two can be
# timed on the same grid, givens, and clues.
#
# The original wrapper renames its component and swaps the backend too, so this
# uses replace_constraint_code directly rather than build_link.py's
# same-name-only --component contract.
#
# PUZZLE_LINK.txt runs the global lane, so it ships no drawn groups; the
# original wrapper reads `input.groups`, so it gets the same 4n frame lines
# main-global.js builds itself, as drawn groups.

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from framebuild import frame_groups as _frame_groups
from framebuild import make_lines
from link_codec import decode_puzzle
from link_swap import frame_only, replace_constraint_code
from minify import minify_file
from sm_document import GROUPS_INPUT, find_constraint, write_link

HERE = pathlib.Path(__file__).parent
CONSTRAINT_NAME = "Custom Numbered Rooms"
N = 9


def frame_groups(n=N):
    return _frame_groups(n, make_lines(n))


def with_frame_groups(doc):
    lc = find_constraint(doc, CONSTRAINT_NAME)
    lc["definition"]["input"] = [GROUPS_INPUT]
    lc["input"] = {"groups": frame_groups()}
    return doc


def build_original(base):
    backend_code = minify_file(HERE / "original" / "main.js")
    component_code = minify_file(HERE / "original" / "CustomIndexComponent.js")
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


def build(out_dir=HERE):
    ours = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
    return write_link(build_original(ours), out_dir / "PUZZLE_LINK_original.txt")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument(
        "--out", help="directory to write into (default: next to this script)"
    )
    args = p.parse_args()
    link = build(pathlib.Path(args.out) if args.out else HERE)
    print(f"wrote PUZZLE_LINK_original.txt ({len(link)} chars)")
