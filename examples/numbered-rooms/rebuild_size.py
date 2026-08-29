# Rebuild a sized Numbered Rooms link (PUZZLE_LINK_<n>x<n>.txt) from its
# committed gen_<n>x<n>.json, with no fresh CP-SAT search: mirrors
# skyscraper/build_original.py's load_gen + build_doc call, but for numbered-
# rooms' own SPEC (build_size.py) instead of running an "original"-wrapper
# swap. The grid, givens, and shown clues come straight from the recorded
# seed; only the constraint code (main.js, NumberedRoomsComponent.js) and the
# comment always match whatever is in the repo right now, so a sized link
# never carries a component snapshot from whenever its search last ran (#217).
#
#   uv run --with ortools --with lzstring examples/numbered-rooms/rebuild_size.py 4
#   uv run --with ortools --with lzstring examples/numbered-rooms/rebuild_size.py 6
#   uv run --with ortools --with lzstring examples/numbered-rooms/rebuild_size.py 9
#
# Checks the rebuilt link decodes to the same grid, givens, and shown clues as
# the one it replaces -- only the constraint code and comment may differ.

import copy
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from build_size import SPEC
from framebuild import build_doc, check, make_lines
from link_codec import decode_puzzle, encode_link
from link_swap import find_constraint

HERE = pathlib.Path(__file__).parent


def load_gen(n):
    g = json.loads((HERE / f"gen_{n}x{n}.json").read_text())
    bh, bw = g["box"]
    grid = g["grid"]
    lines = make_lines(n)
    clue = {(k[0], int(k[1:])): v for k, v in g["clue"].items()}
    active = {(k[0], int(k[1:])) for k in g["active"]}
    givens = {
        (int(r), int(c)): v for k, v in g["givens"].items() for r, c in [k.split(",")]
    }
    return bh, bw, grid, clue, givens, active, lines


def frame_only(doc, constraint_name):
    """doc with the named constraint's code and the puzzle comment cleared,
    so two variants that differ only in code/comment compare equal -- the
    same board, givens, and shown clues either way."""
    d = copy.deepcopy(doc)
    defn = find_constraint(d, constraint_name)["definition"]
    defn["backend"]["code"] = ""
    defn["components"] = []
    d["puzzle"]["comment"] = ""
    return d


if __name__ == "__main__":
    n = int(sys.argv[1])
    out = HERE / f"PUZZLE_LINK_{n}x{n}.txt"
    before = decode_puzzle(out.read_text().strip())

    bh, bw, grid, clue, givens, active, lines = load_gen(n)
    doc = build_doc(SPEC, n, bh, bw, grid, clue, givens, active, lines)
    link = encode_link(doc)
    check(SPEC, link, doc, n)

    assert frame_only(before, SPEC.lines_name) == frame_only(doc, SPEC.lines_name), (
        "grid, givens, or shown clues changed -- rebuild-from-frame must only "
        "change the constraint code and comment"
    )

    out.write_text(link + "\n")
    print(f"wrote {out.name} ({len(link)} chars) -- current component code, same board")
