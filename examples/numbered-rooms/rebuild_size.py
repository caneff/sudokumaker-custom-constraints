# Rebuild a sized Numbered Rooms link (PUZZLE_LINK_<n>x<n>.txt) from its
# committed gen_<n>x<n>.json, with no fresh CP-SAT search: the grid, givens,
# and shown clues come straight from the recorded seed (framebuild.load_gen +
# build_doc); only the constraint's own configuration (code, input -- main.js
# vs main-global.js, #235) and the comment always match whatever is in the
# repo right now, so a sized link never carries a component snapshot from
# whenever its search last ran (#217). Mirrors skyscraper/build_original.py,
# minus the "original"-wrapper swap that script also does -- numbered-rooms
# has its own build_original.py for that, on a different (hand-built) board.
#
#   uv run --with ortools --with lzstring examples/numbered-rooms/rebuild_size.py 4
#   uv run --with ortools --with lzstring examples/numbered-rooms/rebuild_size.py 6
#   uv run --with ortools --with lzstring examples/numbered-rooms/rebuild_size.py 9
#   uv run --with ortools --with lzstring \
#       examples/numbered-rooms/rebuild_size.py 9 --paths
#   uv run --with ortools --with lzstring \
#       examples/numbered-rooms/rebuild_size.py 6 --paths
#
# --paths rebuilds a local board (bent paths, drawn groups, the main.js lane)
# instead, so a component edit reaches the local links too, on the same boards
# build_size.py --paths searched out. The 9x9 local pair is the plain-named
# PUZZLE_LINK_local.txt / gen_local.json; every other size keeps its NxN.
#
# Checks the rebuilt link decodes to the same grid, givens, and shown clues as
# the one it replaces -- only the constraint's own code/input and the comment
# may differ.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from build_size import SPEC
from framebuild import build_doc, check, load_gen
from link_codec import decode_puzzle, encode_link
from link_swap import frame_and_comment_only

HERE = pathlib.Path(__file__).parent


if __name__ == "__main__":
    paths = "--paths" in sys.argv
    if paths:
        sys.argv.remove("--paths")
    n = int(sys.argv[1])
    # the 9x9 local pair is plain-named; every other local board keeps its NxN
    tag = ("local" if n == 9 else f"{n}x{n}_local") if paths else f"{n}x{n}"
    out = HERE / f"PUZZLE_LINK_{tag}.txt"
    before = decode_puzzle(out.read_text().strip())

    bh, bw, grid, clue, givens, active, lines = load_gen(HERE, n, tag=tag)
    doc = build_doc(SPEC, n, bh, bw, grid, clue, givens, active, lines, local=paths)
    link = encode_link(doc)
    check(SPEC, link, doc, n, local=paths)

    assert frame_and_comment_only(before, SPEC.lines_name) == frame_and_comment_only(
        doc, SPEC.lines_name
    ), (
        "grid, givens, or shown clues changed -- rebuild-from-frame must only "
        "change the constraint code and comment"
    )

    out.write_text(link + "\n")
    print(f"wrote {out.name} ({len(link)} chars) -- current component code, same board")
