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
#   uv run examples/up-to-n/build_size.py 9 3 3 --local
#   uv run examples/up-to-n/build_size.py --rebuild 9 --local
#
# Args: n box_height box_width [seed_count] --local, or --rebuild n --local.
# `--local` is required: a no-ring board has only the drawn-groups lane, and
# framebuild refuses the other. The 9x9 lands as PUZZLE_LINK.txt / gen.json,
# every other size as PUZZLE_LINK_<n>x<n>.txt / gen_<n>x<n>.json
# (framebuild.board_files). --rebuild re-encodes a committed board against
# the code in the tree, with no fresh CP-SAT search.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from build_link import SPEC
from framebuild import main

if __name__ == "__main__":
    main(SPEC)
