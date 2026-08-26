# Turn a finished puzzle link into a solver-probe link: one the app must
# actually search, not just verify.
#
# A shared/finished SudokuMaker link stores the whole solution in the cells
# (every non-given cell already holds its answer). Loaded as-is, the app's
# "check unique" solver only confirms an already-filled grid -- tens of
# milliseconds, no search. To time the real solver you must first empty the
# interior so it solves from the givens.
#
#   empty  <src_link> <out_link>              # empty one link's interior
#   graft  <board_link> <code_link> <out>     # board's cells into code's doc,
#                                             # then empty -- same board, other code
#
# `graft` builds a fair pair: two links that share one board and differ only in
# the constraint code, for the numbered-rooms case where the "ours" and
# "original" links carry different givens. The skyscraper example already ships
# same-board pairs (build_original.py), so those need only `empty`.
#
#   uv run --with lzstring examples/_shared/probe_link.py empty a.txt a_probe.txt
#
# The interior is the grid minus its outer ring (row/col 0 and W-1). The ring
# holds the outside clues (Numbered Rooms, Skyscraper) the constraint reads, so
# it stays; only inner non-given cells lose their stored value.

import copy
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


def graft_board(board_doc, code_doc):
    """Copy board_doc's cells (its grid + givens) onto code_doc, keeping
    code_doc's constraint code. Returns code_doc."""
    code_doc["puzzle"]["cells"] = copy.deepcopy(board_doc["puzzle"]["cells"])
    return code_doc


def _read(path):
    return decode_puzzle(pathlib.Path(path).read_text().strip())


def main(argv):
    cmd = argv[1] if len(argv) > 1 else ""
    if cmd == "empty":
        _, _, src, out = argv
        doc = empty_interior(_read(src))
    elif cmd == "graft":
        _, _, board, code, out = argv
        doc = empty_interior(graft_board(_read(board), _read(code)))
    else:
        raise SystemExit(__doc__ or "usage: probe_link.py empty|graft ...")
    pathlib.Path(out).write_text(encode_link(doc))
    print(f"wrote {out}")


if __name__ == "__main__":
    main(sys.argv)
