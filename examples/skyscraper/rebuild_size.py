# Rebuild a Skyscrapers link from its committed gen_<n>x<n>.json, with no fresh
# CP-SAT search: the grid, givens, and shown clues come straight from the
# recorded seed (framebuild.load_gen + build_doc); only the constraint's own
# configuration (component code, backend main-global.js, input) and the comment
# match whatever is in the repo right now. So a shipped link never carries a
# component snapshot from whenever its search last ran. Mirrors
# examples/hit-counts/rebuild_size.py.
#
#   uv run --with ortools --with lzstring examples/skyscraper/rebuild_size.py 4
#   uv run --with ortools --with lzstring examples/skyscraper/rebuild_size.py 6
#   uv run --with ortools --with lzstring examples/skyscraper/rebuild_size.py 9
#   uv run --with ortools --with lzstring examples/skyscraper/rebuild_size.py 10
#   uv run --with ortools --with lzstring \
#       examples/skyscraper/rebuild_size.py 9 --paths
#   uv run --with ortools --with lzstring \
#       examples/skyscraper/rebuild_size.py 6 --paths
#
# The 9x9 is the board the timing loop and build_link.py reuse, so it lives as
# PUZZLE_LINK.txt, not PUZZLE_LINK_9x9.txt.
#
# --paths rebuilds a local board (bent paths, drawn groups, the main.js lane)
# instead, so a component edit reaches the local links too, on the same boards
# build_size.py --paths searched out. The 9x9 local pair is the plain-named
# PUZZLE_LINK_local.txt / gen_local.json; every other size keeps its NxN.
#
# Checks the rebuilt link decodes to the same grid, givens, and shown clues as
# the one it replaces -- only the constraint's own code/input and the comment
# may differ. build_original.py rebuilds the 9x9 comparison PAIR; this script is
# the plain rebuild for any size, including the ones with no original twin.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from build_size import SPEC
from framebuild import build_doc, check, load_gen
from link_codec import decode_puzzle, encode_link
from link_swap import frame_only

HERE = pathlib.Path(__file__).parent


def frame_and_comment_only(doc, constraint_name):
    """`frame_only`, plus the puzzle comment cleared, so two variants that
    differ only in code/input/comment compare equal -- the same board,
    givens, and shown clues either way."""
    d = frame_only(doc, constraint_name)
    d["puzzle"]["comment"] = ""
    return d


if __name__ == "__main__":
    paths = "--paths" in sys.argv
    if paths:
        sys.argv.remove("--paths")
    n = int(sys.argv[1])
    # the 9x9 local pair is plain-named; every other local board keeps its NxN
    tag = ("local" if n == 9 else f"{n}x{n}_local") if paths else f"{n}x{n}"
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
