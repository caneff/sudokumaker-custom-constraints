# Rebuild an already-generated puzzle's link pair from its gen JSON (gen.json
# for n=9, the plain-named pair; gen_<n>x<n>.json for every other size): the
# improved link with the current main-global.js and component files, and the
# same board with ChinStrap's ORIGINAL wrapper code, so the two can be compared on
# the same grid, givens, and clues. No solving: it re-encodes. Run it after
# every component change so the shipped link carries the code in the repo.
#
#   uv run --with lzstring examples/skyscraper/build_original.py 9
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
from framebuild import RingGlobal, frame_groups, load_board
from link_codec import encode_link
from link_swap import frame_only, replace_constraint_code
from minify import minify_file
from sm_document import GROUPS_INPUT, find_constraint, write_link

HERE = pathlib.Path(__file__).parent
ORIG = HERE / "original"
CONSTRAINT_NAME = "Skyscrapers"


def build(n, out_dir=HERE):
    link_path, gen_path = RingGlobal(build_size.SPEC).files(n)
    board = load_board(gen_path)
    improved = RingGlobal(build_size.SPEC).build_doc(board)
    improved_link = encode_link(improved)
    RingGlobal(build_size.SPEC).check(improved_link, improved, board)
    improved_name = link_path.name
    (out_dir / improved_name).write_text(improved_link + "\n")
    print(
        f"wrote {improved_name} ({len(improved_link)} chars) — current component code"
    )

    backend_code = minify_file(ORIG / "main.js")
    component_code = minify_file(ORIG / "CustomSkyscraperLineComponent.js")
    assert backend_code and component_code, "original code empty"

    original = replace_constraint_code(
        improved,
        CONSTRAINT_NAME,
        backend_code=backend_code,
        components=[
            {
                "type": "code",
                "name": "CustomSkyscraperLineComponent",
                "code": component_code,
            }
        ],
    )
    olc = find_constraint(original, CONSTRAINT_NAME)
    olc["definition"]["input"] = [GROUPS_INPUT]
    # The shared frame_groups, so the original wrapper reads the same drawn
    # groups every other local-lane link in this repo ships (ordered by ring
    # key). The wrapper takes each group's clue from cells[0], so the order of
    # the groups is not part of the rule -- only the cells within one are.
    olc["input"] = {"groups": frame_groups(n, board.lines)}

    assert frame_only(improved, CONSTRAINT_NAME) == frame_only(
        original, CONSTRAINT_NAME
    ), "frames differ beyond the constraint's own code/input"
    out_name = f"{link_path.stem}_original.txt"
    link = write_link(original, out_dir / out_name)
    print(f"wrote {out_name} ({len(link)} chars) — same puzzle, original wrapper code")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("n", type=int)
    p.add_argument(
        "--out", help="directory to write into (default: next to this script)"
    )
    args = p.parse_args()
    build(args.n, pathlib.Path(args.out) if args.out else HERE)
