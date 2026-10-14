# Build a same-board comparison link (docs/real-app-timing.md): a committed
# board with one component's code swapped for a candidate file, and nothing
# else changed. PUZZLE_LINK.txt runs the global lane, so its backend is main-global.js.
#
# `--refresh` re-encodes the four boards against the tree
# (`build_size.py --rebuild`), then rebuilds their `_clued` twins from them.

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
import build_clued
from build_size import SPEC
from framebuild import lane_kinds
from link_swap import swap_main
from manifest import load_manifest
from sudoku_kit.link_codec import decode_puzzle

HERE = pathlib.Path(__file__).parent
MANIFEST = load_manifest(HERE)
CONSTRAINT_NAME = MANIFEST.constraint_name


def refresh():
    """Re-encode every board from its recorded seed, then its twin from it.

    The twins come last: a twin is its board's clues filled, so one built
    before the board is re-encoded would carry the old embedded code."""
    global_lane, local_lane = lane_kinds(SPEC)
    for board in build_clued.BOARDS:
        n = decode_puzzle((HERE / board).read_text().strip())["puzzle"]["width"] - 2
        lane = (local_lane if board.endswith("_local.txt") else global_lane)(SPEC)
        link_path, _ = lane.files(n)
        assert link_path == HERE / board, f"{board} is not the {lane.name} board of {n}"
        link_path.write_text(lane.rebuild(n) + "\n")
    build_clued.build()


def rebuild(args, parser):
    if not args.refresh:
        parser.error("give --component with --out, or --refresh")
    refresh()
    print("refreshed the four boards and the four _clued twins built from them")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument(
        "--refresh",
        action="store_true",
        help="re-encode the four boards against the tree, then rebuild the "
        "_clued twin of each",
    )
    swap_main(HERE, p, rebuild)
