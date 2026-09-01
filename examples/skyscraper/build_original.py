# Rebuild an already-generated puzzle's link pair from its gen JSON (gen.json
# for n=9, the plain-named pair; gen_<n>x<n>.json for every other size): the
# improved link with the current main.js and component files, and the same
# board with ChinStrap's ORIGINAL wrapper code, so the two can be compared on
# the same grid, givens, and clues. No solving: it re-encodes. Run it after
# every component change so the shipped link carries the code in the repo.
#
#   uv run --with lzstring examples/skyscraper/build_original.py 9
#
# Writes PUZZLE_LINK_<n>x<n>.txt and PUZZLE_LINK_<n>x<n>_original.txt next to
# this script (PUZZLE_LINK.txt / PUZZLE_LINK_original.txt for n=9, the
# plain-named pair) and checks that the only difference between the two is
# the custom constraint's own configuration. The original wrapper renames its
# component and swaps the backend too, so it uses replace_constraint_code
# directly rather than build_link.py's same-name-only --component contract.
# It also reads `input.groups` directly, so the original variant gets the
# explicit frame groups built here -- same board, same lines, just handed to
# the wrapper the way it expects them.
#
# --out names a directory to write into instead; omitting it keeps the
# default of writing next to this script.

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
import build_size
from frame import ring_cell
from framebuild import build_doc, check, load_gen
from link_codec import decode_puzzle, encode_link
from link_swap import find_constraint, frame_only, replace_constraint_code
from minify import minify_js

HERE = pathlib.Path(__file__).parent
ORIG = HERE / "original"
CONSTRAINT_NAME = "Skyscraper Lines"


def frame_groups(n, lines):
    """The 4n drawn-group shape (clue cell, then line cells inward) for the
    n x n frame `build_doc` builds -- the shape the original wrapper's
    `input.groups` needs, on the same board main-global.js builds itself.
    Same cell order as the JS frameGroups() every main-global.js carries."""
    W = n + 2

    def idx(r, c):
        return r * W + c

    def group(key):
        ci = idx(*ring_cell(f"{key[0]}{key[1]}", W))
        line = [idx(r + 1, c + 1) for (r, c) in lines[key]]
        return {"cells": [ci, *line], "value": ""}

    groups = []
    for r in range(n):
        groups.append(group(("L", r)))
        groups.append(group(("R", r)))
    for c in range(n):
        groups.append(group(("T", c)))
        groups.append(group(("B", c)))
    return groups


def build(n, out_dir=HERE):
    """Rebuild the link pair for size `n` into `out_dir`. Reads the gen JSON
    and original wrapper code from beside this script regardless of
    `out_dir`; only the two written links move."""
    # the 9x9 global board is the plain-named pair: gen.json, not gen_9x9.json
    tag = "" if n == 9 else f"{n}x{n}"
    bh, bw, grid, clue, givens, active, lines = load_gen(HERE, n, tag=tag)
    improved = build_doc(build_size.SPEC, n, bh, bw, grid, clue, givens, active, lines)
    improved_link = encode_link(improved)
    check(build_size.SPEC, improved_link, improved, n)
    improved_name = "PUZZLE_LINK.txt" if n == 9 else f"PUZZLE_LINK_{n}x{n}.txt"
    (out_dir / improved_name).write_text(improved_link + "\n")
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

    assert frame_only(improved, CONSTRAINT_NAME) == frame_only(
        original, CONSTRAINT_NAME
    ), "frames differ beyond the constraint's own code/input"
    out_name = (
        "PUZZLE_LINK_original.txt" if n == 9 else f"PUZZLE_LINK_{n}x{n}_original.txt"
    )
    link = encode_link(original)
    assert decode_puzzle(link) == original, "link does not round-trip"
    (out_dir / out_name).write_text(link + "\n")
    print(f"wrote {out_name} ({len(link)} chars) — same puzzle, original wrapper code")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("n", type=int)
    p.add_argument(
        "--out", help="directory to write into (default: next to this script)"
    )
    args = p.parse_args()
    build(args.n, pathlib.Path(args.out) if args.out else HERE)
