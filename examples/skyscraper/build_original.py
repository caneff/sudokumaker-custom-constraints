# Rebuild an already-generated puzzle's link pair from gen_<n>x<n>.json: the
# improved link with the current main.js and component files, and the same
# board with ChinStrap's ORIGINAL wrapper code, so the two can be compared on
# the same grid, givens, and clues. No solving: it re-encodes. Run it after
# every component change so the shipped link carries the code in the repo.
#
#   uv run --with ortools --with lzstring examples/skyscraper/build_original.py 9
#
# Writes PUZZLE_LINK_<n>x<n>.txt and PUZZLE_LINK_<n>x<n>_original.txt next to
# this script (PUZZLE_LINK.txt / PUZZLE_LINK_original.txt for n=9, the
# plain-named pair) and checks that the only difference between the two is
# the custom constraint's own configuration. The original wrapper renames its
# component and swaps the backend too, so it uses replace_constraint_code
# directly rather than build_link.py's same-name-only --component contract.
# It also reads `input.groups` directly (never rewritten to build the frame
# itself, unlike main-global.js), so the original variant gets the explicit
# frame groups back via framebuild.frame_groups -- same board, same lines,
# just handed to the wrapper the way it expects them.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
import build_size
from framebuild import build_doc, check, frame_groups, load_gen
from link_codec import decode_puzzle, encode_link
from link_swap import blanked, find_constraint, replace_constraint_code
from minify import minify_js

HERE = pathlib.Path(__file__).parent
ORIG = HERE / "original"
CONSTRAINT_NAME = "Skyscraper Lines"


def frame_only(doc):
    """doc with the constraint's own configuration (code and input) cleared,
    so the improved (global, no input) and original (legacy, explicit
    groups) variants compare equal everywhere except that -- the same board,
    givens, and clues either way."""
    d = blanked(doc, CONSTRAINT_NAME)
    lc = find_constraint(d, CONSTRAINT_NAME)
    lc["definition"]["input"], lc["input"] = [], {}
    return d


if __name__ == "__main__":
    n = int(sys.argv[1])
    bh, bw, grid, clue, givens, active, lines = load_gen(HERE, n)
    improved = build_doc(build_size.SPEC, n, bh, bw, grid, clue, givens, active, lines)
    improved_link = encode_link(improved)
    check(build_size.SPEC, improved_link, improved, n)
    improved_name = "PUZZLE_LINK.txt" if n == 9 else f"PUZZLE_LINK_{n}x{n}.txt"
    (HERE / improved_name).write_text(improved_link + "\n")
    print(
        f"wrote {improved_name} ({len(improved_link)} chars) — current component code"
    )

    backend_code = minify_js((ORIG / "main.js").read_text())
    component_code = minify_js((ORIG / "CustomSkyscraperLineComponent.js").read_text())
    assert backend_code and component_code, "original code empty"

    original = replace_constraint_code(
        improved,
        CONSTRAINT_NAME,
        backend_code=backend_code,
        components=[
            {
                "type": "code",
                "name": "CustomSkyscraperLineComponent",
                "code": component_code,
            }
        ],
    )
    olc = find_constraint(original, CONSTRAINT_NAME)
    olc["definition"]["input"] = [
        {"id": "groups", "label": "Groups", "params": {"type": "raw"}}
    ]
    olc["input"] = {"groups": frame_groups(n, lines)}

    assert frame_only(improved) == frame_only(original), (
        "frames differ beyond the constraint's own code/input"
    )
    out_name = (
        "PUZZLE_LINK_original.txt" if n == 9 else f"PUZZLE_LINK_{n}x{n}_original.txt"
    )
    link = encode_link(original)
    assert decode_puzzle(link) == original, "link does not round-trip"
    (HERE / out_name).write_text(link + "\n")
    print(f"wrote {out_name} ({len(link)} chars) — same puzzle, original wrapper code")
