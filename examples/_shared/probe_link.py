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
#   uv run --with lzstring examples/_shared/probe_link.py strip a.txt a_probe.txt
#
# `strip` is the stricter mode: keep only given cells, drop every value and
# pencil mark from the rest. Use it for any puzzle whose clues are all givens
# (ISOFILL). Timing with entered values present is not a timing: the app then
# reports a verdict "based on already entered values" and the solver never
# searches.
#
# Why does `empty` keep the whole ring instead of "keep givens, empty the rest"?
# Because a clue is not always a given. Numbered Rooms stores its 36 outside clues as
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


def strip_to_givens(doc):
    """Clear every non-given cell entirely (value, pencil marks, all). Returns doc."""
    for cell in doc["puzzle"]["cells"]:
        if not cell.get("given"):
            cell.clear()
    return doc


MODES = {"empty": empty_interior, "strip": strip_to_givens}


def empty_link_file(src_path, out_path, mode="empty"):
    """Read the link at src_path, apply the mode, write it to out_path."""
    doc = MODES[mode](decode_puzzle(pathlib.Path(src_path).read_text().strip()))
    pathlib.Path(out_path).write_text(encode_link(doc))


def main(argv):
    if len(argv) != 4 or argv[1] not in MODES:
        raise SystemExit("usage: probe_link.py empty|strip <src_link> <out_link>")
    _, mode, src, out = argv
    empty_link_file(src, out, mode)
    print(f"wrote {out}")


if __name__ == "__main__":
    main(sys.argv)
