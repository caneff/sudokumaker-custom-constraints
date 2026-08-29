# Rebuild a sized Numbered Rooms link (PUZZLE_LINK_<n>x<n>.txt) from its
# committed gen_<n>x<n>.json, with no fresh CP-SAT search: the grid, givens,
# and shown clues come straight from the recorded seed (framebuild.load_gen +
# build_doc); only the constraint code (main.js, NumberedRoomsComponent.js)
# and the comment always match whatever is in the repo right now, so a sized
# link never carries a component snapshot from whenever its search last ran
# (#217). Mirrors skyscraper/build_original.py, minus the "original"-wrapper
# swap that script also does -- numbered-rooms has its own build_original.py
# for that, on a different (hand-built) board.
#
#   uv run --with ortools --with lzstring examples/numbered-rooms/rebuild_size.py 4
#   uv run --with ortools --with lzstring examples/numbered-rooms/rebuild_size.py 6
#   uv run --with ortools --with lzstring examples/numbered-rooms/rebuild_size.py 9
#
# Checks the rebuilt link decodes to the same grid, givens, and shown clues as
# the one it replaces -- only the constraint code and comment may differ.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from build_size import SPEC
from framebuild import build_doc, check, load_gen
from link_codec import decode_puzzle, encode_link
from link_swap import blanked

HERE = pathlib.Path(__file__).parent


def frame_only(doc, constraint_name):
    """doc with the named constraint's code and the puzzle comment cleared,
    so two variants that differ only in code/comment compare equal -- the
    same board, givens, and shown clues either way."""
    d = blanked(doc, constraint_name)
    d["puzzle"]["comment"] = ""
    return d


if __name__ == "__main__":
    n = int(sys.argv[1])
    out = HERE / f"PUZZLE_LINK_{n}x{n}.txt"
    before = decode_puzzle(out.read_text().strip())

    bh, bw, grid, clue, givens, active, lines = load_gen(HERE, n)
    doc = build_doc(SPEC, n, bh, bw, grid, clue, givens, active, lines)
    link = encode_link(doc)
    check(SPEC, link, doc, n)

    assert frame_only(before, SPEC.lines_name) == frame_only(doc, SPEC.lines_name), (
        "grid, givens, or shown clues changed -- rebuild-from-frame must only "
        "change the constraint code and comment"
    )

    out.write_text(link + "\n")
    print(f"wrote {out.name} ({len(link)} chars) -- current component code, same board")
