# Turn a finished puzzle link into a solver-probe link: one the app must
# actually search, not just verify.
#
# A shared/finished SudokuMaker link stores the whole solution in the cells
# (every non-given cell already holds its answer). Loaded as-is, the app's
# "check unique" solver only confirms an already-filled grid -- tens of
# milliseconds, no search. To time the real solver you must first empty the
# interior so it solves from the givens.
#
# To compare two code variants, empty each half of a same-board pair -- the
# "ours" link and the "original" link each example's build_original.py writes.
#
#   uv run --with lzstring examples/_shared/probe_link.py empty a.txt a_probe.txt
#
# The interior is the grid minus its outer ring (row/col 0 and W-1). The ring
# holds the outside clues (Numbered Rooms, Skyscraper), so it stays; only inner
# non-given cells lose their stored value.
#
# Why keep the whole ring instead of "keep givens, empty the rest"? Because a
# clue is not always a given. Numbered Rooms stores its 36 outside clues as
# non-given cell VALUES in the ring, not as givens (only the 4 filler corners
# are given). Empty every non-given cell and you delete the clues -- verified:
# the app then reports the puzzle "not unique". The given flag does not separate
# clue from solution here, so we separate them by position instead.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from link_codec import decode_puzzle, encode_link


def empty_interior(doc):
    """Drop the stored value from every inner non-given cell. Returns doc."""
    w, h = doc["puzzle"]["width"], doc["puzzle"]["height"]
    for i, cell in enumerate(doc["puzzle"]["cells"]):
        row, col = divmod(i, w)
        inner = 0 < row < h - 1 and 0 < col < w - 1
        if inner and not cell.get("given"):
            cell.pop("value", None)
    return doc


def main(argv):
    if len(argv) != 4 or argv[1] != "empty":
        raise SystemExit("usage: probe_link.py empty <src_link> <out_link>")
    _, _, src, out = argv
    doc = empty_interior(decode_puzzle(pathlib.Path(src).read_text().strip()))
    pathlib.Path(out).write_text(encode_link(doc))
    print(f"wrote {out}")


if __name__ == "__main__":
    main(sys.argv)
