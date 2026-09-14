# Build an Up to N board at any size, or re-encode a committed one.
#
# The board is a plain n x n sudoku with no ring: framebuild's no-ring mode
# draws all 4n markers, fills every clue from a fresh grid, carves givens and
# then shown clues while CP-SAT still proves one solution, and encodes the
# link. The rule itself -- clue function, CP-SAT model, rules text, markers --
# is `build_link.SPEC`.
#
#   uv run examples/up-to-n/build_size.py 4 2 2 --local
#   uv run examples/up-to-n/build_size.py 6 2 3 --local
#   uv run examples/up-to-n/build_size.py --rebuild 6 --local
#
# Args: n box_height box_width [seed_count] --local, or --rebuild n --local.
# `--local` is required: a no-ring board has only the drawn-groups lane, and
# framebuild refuses the other. --rebuild re-encodes a committed board against
# the code in the tree, with no fresh CP-SAT search.
#
# The 9x9 has two boards. The carve's minimal one, PUZZLE_LINK_9x9.txt /
# gen_9x9.json, is unique by CP-SAT but times out in the live app
# (docs/research/368-up-to-n-setup-throw.md, finding 5). The shipped one,
# PUZZLE_LINK.txt / gen.json, is the same solution with more clues shown and
# still no givens, derived from the minimal one:
#
#   uv run examples/up-to-n/build_size.py 9 3 3 --local   # writes the plain pair
#   (move the plain pair to PUZZLE_LINK_9x9.txt / gen_9x9.json)
#   uv run examples/up-to-n/build_size.py --derive-shipped-9x9
#   uv run examples/up-to-n/build_size.py --rebuild 9 --local
#   uv run examples/up-to-n/build_size.py --rebuild-minimal-9x9

import pathlib
import random
import sys
from dataclasses import replace

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import link_codec
from build_link import SPEC
from framebuild import (
    board_files,
    build_doc,
    check,
    load_board,
    main,
    rebuild,
    save_board,
    unique,
)

HERE = pathlib.Path(__file__).parent
MINIMAL_9X9 = (HERE / "PUZZLE_LINK_9x9.txt", HERE / "gen_9x9.json")
# Clues the shipped 9x9 shows. 18 is the fewest of the counts probed that the
# live app solves: 15 times out, 18 is unique in 15 s (finding 5).
SHIPPED_9X9_CLUES = 18


def shipped_9x9(minimal):
    """The minimal 9x9 with clues added, in a fixed seeded order, until it
    shows SHIPPED_9X9_CLUES. The order is the one the live-app probe used."""
    extra = sorted(set(minimal.lines) - minimal.active)
    random.Random(370).shuffle(extra)
    more = SHIPPED_9X9_CLUES - len(minimal.active)
    return replace(minimal, active=set(minimal.active) | set(extra[:more]))


def derive_shipped_9x9():
    board = shipped_9x9(load_board(MINIMAL_9X9[1]))
    assert unique(SPEC.cp_sat_clue_fn, board) is True
    doc = build_doc(SPEC, board, local=True)
    link = link_codec.encode_link(doc)
    check(SPEC, link, doc, board, local=True)
    link_path, gen_path = board_files(SPEC, 9, local=True)
    link_path.write_text(link + "\n")
    save_board(board, gen_path)
    print(f"wrote {link_path.name} ({len(link)} chars) and {gen_path.name}")


if __name__ == "__main__":
    if sys.argv[1:] == ["--derive-shipped-9x9"]:
        derive_shipped_9x9()
    elif sys.argv[1:] == ["--rebuild-minimal-9x9"]:
        link = rebuild(SPEC, 9, local=True, files=MINIMAL_9X9)
        MINIMAL_9X9[0].write_text(link + "\n")
        print(f"wrote {MINIMAL_9X9[0].name} -- current component code, same board")
    else:
        main(SPEC)
