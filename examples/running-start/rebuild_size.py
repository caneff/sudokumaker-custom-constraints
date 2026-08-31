# Rebuild a Running Start link from its committed gen_<tag>.json, with no fresh
# CP-SAT search: the grid, givens, and shown clues come straight from the
# recorded seed (framebuild.load_gen + build_doc); only the constraint's own
# configuration (component code, backend main code, input) and the comment match
# whatever is in the repo right now. So a shipped link never carries a component
# snapshot from whenever its search last ran. Mirrors
# examples/hit-counts/rebuild_size.py.
#
#   uv run --with ortools --with lzstring examples/running-start/rebuild_size.py 4
#   uv run --with ortools --with lzstring examples/running-start/rebuild_size.py 6
#   uv run --with ortools --with lzstring \
#       examples/running-start/rebuild_size.py 9 --paths
#
# The shipped 9x9 global board is not a framebuild board -- it was decoded from
# a known-good link into gen.json -- so `build_link.py` with no arguments is
# what rebuilds PUZZLE_LINK.txt, not this script.
#
# --paths rebuilds the local board (bent paths, drawn groups, the main.js lane)
# from gen_local.json, so a component edit reaches PUZZLE_LINK_local.txt too, on
# the same board build_size.py --paths searched out.
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
    assert not paths or n == 9, "the local board is the 9x9 only"
    assert paths or n != 9, "the shipped 9x9 global board rebuilds via build_link.py"
    tag = "local" if paths else f"{n}x{n}"
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
