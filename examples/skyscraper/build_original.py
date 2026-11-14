# Rebuild an already-generated puzzle's link pair from its gen JSON (gen.json
# for n=9, the plain-named pair; gen_<n>x<n>.json for every other size): the
# improved link with the current main-global.js and component files, and the
# same board with ChinStrap's ORIGINAL wrapper code, so the two can be compared on
# the same grid, givens, and clues. No solving: it re-encodes. Run it after
# every component change so the shipped link carries the code in the repo.
#
#   uv run examples/skyscraper/build_original.py 9
#   uv run examples/skyscraper/build_original.py --all
#
# --all rebuilds every size that ships an _original twin (`build_all`); it is
# what build_link.py --refresh runs after re-encoding the carved boards.
#
# Writes PUZZLE_LINK_<n>x<n>.txt and PUZZLE_LINK_<n>x<n>_original.txt next to
# this script (PUZZLE_LINK.txt / PUZZLE_LINK_original.txt for n=9, the
# plain-named pair) and checks that the only difference between the two is
# the custom constraint's own configuration. The original wrapper renames its
# component and swaps the backend too, so it uses replace_constraint_code
# directly rather than build_link.py's same-name-only --component contract.

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
import build_size
from board import load_board
from document import frame_groups
from lanes import RingGlobal
from link_swap import frame_only, replace_constraint_code
from minify import minify_file
from sm_document import GROUPS_INPUT, find_constraint, write_link
from sudoku_kit.link_codec import decode_puzzle

HERE = pathlib.Path(__file__).parent


def build(n, out_dir=HERE, spec=build_size.SPEC):
    """Write the improved link and its original-wrapper twin for size `n`.
    The improved link is `Lane.rebuild`'s, so it is checked and held to the
    committed link's grid, givens and clues before it is written. `spec` is
    the example's, except in a test that plants a board."""
    lane = RingGlobal(spec)
    link_path, gen_path = lane.files(n)
    improved_link = lane.rebuild(n)
    improved = decode_puzzle(improved_link)
    board = load_board(gen_path)
    improved_name = link_path.name
    (out_dir / improved_name).write_text(improved_link + "\n")
    print(
        f"wrote {improved_name} ({len(improved_link)} chars) — current component code"
    )

    constraint_name = spec.constraint_name
    orig = spec.dir / "original"
    backend_code = minify_file(orig / "main.js")
    component_code = minify_file(orig / "CustomSkyscraperLineComponent.js")
    assert backend_code and component_code, "original code empty"

    original = replace_constraint_code(
        improved,
        constraint_name,
        backend_code=backend_code,
        components=[
            {
                "type": "code",
                "name": "CustomSkyscraperLineComponent",
                "code": component_code,
            }
        ],
    )
    olc = find_constraint(original, constraint_name)
    olc["definition"]["input"] = [GROUPS_INPUT]
    # The shared frame_groups, so the original wrapper reads the same drawn
    # groups every other local-lane link in this repo ships (ordered by ring
    # key). The wrapper takes each group's clue from cells[0], so the order of
    # the groups is not part of the rule -- only the cells within one are.
    olc["input"] = {"groups": frame_groups(n, board.lines)}

    assert frame_only(improved, constraint_name) == frame_only(
        original, constraint_name
    ), "frames differ beyond the constraint's own code/input"
    out_name = f"{link_path.stem}_original.txt"
    link = write_link(original, out_dir / out_name)
    print(f"wrote {out_name} ({len(link)} chars) — same puzzle, original wrapper code")


def twin_sizes(spec=build_size.SPEC):
    """The sizes whose global-lane board ships an `_original` twin: every gen
    JSON the global lane owns, read for its size, whose link's twin is
    committed. Read off the files, so a twin added at a new size is refreshed
    without a list here to keep."""
    lane = RingGlobal(spec)
    sizes = []
    for gen in sorted(spec.dir.glob("gen*.json")):
        n = load_board(gen).n
        link_path, owned = lane.files(n)
        if owned == gen and (spec.dir / f"{link_path.stem}_original.txt").exists():
            sizes.append(n)
    return sorted(sizes)


def build_all(out_dir=HERE, spec=build_size.SPEC):
    """`build` for every size in `twin_sizes`."""
    for n in twin_sizes(spec):
        build(n, out_dir, spec)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("n", type=int, nargs="?")
    p.add_argument("--all", action="store_true", help="every size with a twin")
    p.add_argument(
        "--out", help="directory to write into (default: next to this script)"
    )
    args = p.parse_args()
    if args.all == (args.n is not None):
        p.error("give a size n, or --all")
    out = pathlib.Path(args.out) if args.out else HERE
    if args.all:
        build_all(out)
    else:
        build(args.n, out)
