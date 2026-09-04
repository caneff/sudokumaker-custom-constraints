# Rebuild a Hit Counts link from its committed gen_<n>x<n>.json, with no fresh
# CP-SAT search: the grid, givens, and shown clues come straight from the
# recorded seed (framebuild.load_gen + build_doc); only the constraint's own
# configuration (component code, backend main-global.js, input) and the comment
# match whatever is in the repo right now. So a shipped link never carries a
# component snapshot from whenever its search last ran. Mirrors
# examples/numbered-rooms/rebuild_size.py.
#
#   uv run --with ortools --with lzstring examples/hit-counts/rebuild_size.py 4
#   uv run --with ortools --with lzstring examples/hit-counts/rebuild_size.py 6
#   uv run --with ortools --with lzstring examples/hit-counts/rebuild_size.py 9
#   uv run --with ortools --with lzstring \
#       examples/hit-counts/rebuild_size.py 9 --paths
#
# The 9x9 is the board the timing loop and build_link.py reuse, so it lives as
# PUZZLE_LINK.txt, not PUZZLE_LINK_9x9.txt.
#
# --paths rebuilds the local board (bent paths, drawn groups, the main.js lane)
# from gen_local.json instead, so a component edit reaches PUZZLE_LINK_local.txt
# too, on the same board build_size.py --paths searched out.
#
# Checks the rebuilt link decodes to the same grid, givens, and shown clues as
# the one it replaces -- only the constraint's own code/input and the comment
# may differ.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
sys.path.insert(0, str(pathlib.Path(__file__).parent))
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
    # the 9x9 boards are the plain-named pair: gen.json / gen_local.json
    if paths:
        tag = "local" if n == 9 else f"{n}x{n}_local"
    else:
        tag = "" if n == 9 else f"{n}x{n}"
    out = HERE / (
        "PUZZLE_LINK.txt" if n == 9 and not paths else f"PUZZLE_LINK_{tag}.txt"
    )
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
