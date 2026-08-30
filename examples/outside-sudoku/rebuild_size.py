# Rebuild a sized Outside Sudoku link (PUZZLE_LINK_<n>x<n>.txt) from its
# committed gen_<n>x<n>.json, with no fresh CP-SAT search: the grid, givens and
# shown clues come straight from the recorded seed (framebuild.load_gen +
# build_doc), so only the constraint's own configuration (component code, main
# code, input) and the comment follow whatever is in the repo right now. A
# sized link therefore never carries a component snapshot from whenever its
# search last ran. Mirrors examples/numbered-rooms/rebuild_size.py.
#
#   uv run --with lzstring examples/outside-sudoku/rebuild_size.py 4
#   uv run --with lzstring examples/outside-sudoku/rebuild_size.py 6
#   uv run --with lzstring examples/outside-sudoku/rebuild_size.py 9
#
# Checks the rebuilt link decodes to the same grid, givens and shown clues as
# the one it replaces -- only the constraint's own code/input and the comment
# may differ.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from build_size import spec_for
from framebuild import build_doc, check, load_gen
from link_codec import decode_puzzle, encode_link
from link_swap import frame_and_comment_only

HERE = pathlib.Path(__file__).parent


def rebuild(n):
    """The link for the committed gen_<n>x<n>.json, re-encoded against the
    component and main code in the tree right now."""
    bh, bw, grid, clue, givens, active, lines = load_gen(HERE, n)
    spec = spec_for(bh, bw)
    doc = build_doc(spec, n, bh, bw, grid, clue, givens, active, lines)
    link = encode_link(doc)
    check(spec, link, doc, n)

    before = decode_puzzle((HERE / f"PUZZLE_LINK_{n}x{n}.txt").read_text().strip())
    assert frame_and_comment_only(before, spec.lines_name) == frame_and_comment_only(
        doc, spec.lines_name
    ), (
        "grid, givens, or shown clues changed -- a rebuild from the recorded "
        "seed must only change the constraint code and comment"
    )
    return link


if __name__ == "__main__":
    n = int(sys.argv[1])
    out = HERE / f"PUZZLE_LINK_{n}x{n}.txt"
    link = rebuild(n)
    out.write_text(link + "\n")
    print(f"wrote {out.name} ({len(link)} chars) -- current component code, same board")
