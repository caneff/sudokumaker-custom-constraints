# The command line every example answers (link_swap.swap_main). This example
# is boardless: its board directories each have their own builder (README.md),
# and only required-digits/ embeds a shared backend -- its two links are
# outside-sudoku's PUZZLE_LINK.txt with the wrapper swapped in, so they carry
# that board's frame-rowcol.js and frame-corners.js.
#
#   uv run examples/count-digits-gac/build_link.py --refresh
#   uv run examples/count-digits-gac/build_link.py --component FILE --out FILE [--board LINK]
#
# --refresh rebuilds required-digits/PUZZLE_LINK.txt and
# PUZZLE_LINK_original.txt through build_required_digits.py's own bodies, on
# outside-sudoku's board with its frame backends pointed at the tree
# (`document.refresh_frame_backends`), so the two come out current whether or
# not outside-sudoku's own --refresh ran first. The other boards embed no
# shared backend and are rebuilt by their own builders.
#
# --component swaps a candidate into required-digits/PUZZLE_LINK.txt, or into
# --board.

import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_required_digits import BOARD_DIR, OUTSIDE_SUDOKU, build_gac, build_original
from document import refresh_frame_backends
from link_swap import swap_main
from sm_document import write_link
from sudoku_kit.link_codec import decode_puzzle


def refresh(_args, _parser):
    base = decode_puzzle((OUTSIDE_SUDOKU / "PUZZLE_LINK.txt").read_text().strip())
    refresh_frame_backends(base)
    for build, name in [
        (build_gac, "PUZZLE_LINK.txt"),
        (build_original, "PUZZLE_LINK_original.txt"),
    ]:
        link = write_link(build(base), BOARD_DIR / name)
        print(f"wrote required-digits/{name} ({len(link)} chars)")


if __name__ == "__main__":
    swap_main(BOARD_DIR, refresh=refresh)
