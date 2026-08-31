# Rebuild a committed Outside Sudoku link from its gen JSON, with no fresh
# CP-SAT search: the grid, givens and shown clues come straight from the
# recorded seed (framebuild.load_gen + build_doc), so only the constraint's own
# configuration (component code, main code, input) and the comment follow
# whatever is in the repo right now. A link therefore never carries a component
# snapshot from whenever its search last ran. Mirrors
# examples/numbered-rooms/rebuild_size.py.
#
#   uv run --with lzstring examples/outside-sudoku/rebuild_size.py 4
#   uv run --with lzstring examples/outside-sudoku/rebuild_size.py 6
#   uv run --with lzstring examples/outside-sudoku/rebuild_size.py 9
#   uv run --with lzstring examples/outside-sudoku/rebuild_size.py 9 --local
#
# The 9x9 global board is the shipped one, so it lives as PUZZLE_LINK.txt, not
# PUZZLE_LINK_9x9.txt; --local rebuilds the local board (the same frame lines
# drawn as groups on the main.js lane) from gen_local.json.
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


def link_path(n, local=False):
    """The committed link a rebuild of this board replaces. The 9x9 global
    board is the shipped one, so it is plain-named; so is the local board,
    which only exists at 9x9."""
    if local:
        return HERE / "PUZZLE_LINK_local.txt"
    return HERE / ("PUZZLE_LINK.txt" if n == 9 else f"PUZZLE_LINK_{n}x{n}.txt")


def rebuild(n, local=False):
    """The link for the committed gen JSON of this board, re-encoded against
    the component and main code in the tree right now."""
    tag = "local" if local else None
    bh, bw, grid, clue, givens, active, lines = load_gen(HERE, n, tag=tag)
    spec = spec_for(bh, bw)
    # bent=False: this example's local board draws the straight frame lines,
    # so its rules text must not say a line is no house (#268).
    doc = build_doc(
        spec, n, bh, bw, grid, clue, givens, active, lines, local=local, bent=False
    )
    link = encode_link(doc)
    check(spec, link, doc, n, local=local)

    before = decode_puzzle(link_path(n, local).read_text().strip())
    assert frame_and_comment_only(before, spec.lines_name) == frame_and_comment_only(
        doc, spec.lines_name
    ), (
        "grid, givens, or shown clues changed -- a rebuild from the recorded "
        "seed must only change the constraint code and comment"
    )
    return link


if __name__ == "__main__":
    local = "--local" in sys.argv
    if local:
        sys.argv.remove("--local")
    n = int(sys.argv[1])
    out = link_path(n, local)
    link = rebuild(n, local)
    out.write_text(link + "\n")
    print(f"wrote {out.name} ({len(link)} chars) -- current component code, same board")
