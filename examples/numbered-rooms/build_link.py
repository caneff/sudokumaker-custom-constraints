# Build a same-board comparison link (docs/real-app-timing.md): the committed
# PUZZLE_LINK.txt, or --board, with one component's code swapped for a
# candidate file and nothing else changed. PUZZLE_LINK.txt runs the global lane
# (docs/example-layout.md), so a --backend to swap in is main-global.js.
#
#   uv run examples/numbered-rooms/build_link.py --component FILE --out FILE \
#       [--board LINK] [--backend main-global.js]
#
# --refresh instead rewrites PUZZLE_LINK.txt in place (see refresh below). It
# writes values belonging to that board alone, so it refuses --board.

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from framebuild import RULES_PREFIX, refresh_frame_backends
from link_codec import decode_puzzle
from link_swap import find_constraint, swap_main, write_link
from minify import minify_file

HERE = pathlib.Path(__file__).parent
# The shipped board is hand-built and calls its constraint this; the generated
# boards (build_size.py, PUZZLE_LINK_local.txt among them) call it "Numbered
# Rooms", which is why a swap finds the constraint by the component it
# registers.
CONSTRAINT_NAME = "Custom Numbered Rooms"
TIMED_COMPONENT = "NumberedRoomsComponent"

# The shipped board's rules text. It has to live here: the board is hand-built,
# no generator writes its comment, and `refresh` is the only thing that can keep
# it true. The generated boards read theirs from build_size.comment_text.
COMMENT = RULES_PREFIX + (
    "Numbered Rooms: All outside cells on a clue must contain a digit. That "
    "digit must also appear in the Nth position looking into the grid in the "
    "row/column, where N is the digit in the first position."
)

# The interior is a 9x9 sudoku on 1-9, and the document has to say so. The app
# defaults a custom puzzle to 1..9 whatever the grid size (#461), and both shared
# frame backends read `helpers.digits`; declaring the range keeps the rule from
# resting on that default. A range that does not span the interior line makes
# every row and column fall back from a named HouseComponent to a plain
# DifferentDigitsComponent with no houseType. Same pin and the same reason as
# running-start/build_link.py's template (#394).
DIGITS = (1, 9)


def refresh():
    """Rewrite PUZZLE_LINK.txt in place: this board's own backend and the
    frame's shared ones as they stand in the tree, the digit range those
    backends read, and the rules text.

    PUZZLE_LINK.txt and no other board. DIGITS and COMMENT below describe this
    one hand-built 9x9; stamped on a smaller board they would give six-cell
    interior lines a nine-digit range -- the very degradation the range is
    declared to prevent -- and rules text for a different puzzle.

    This board is hand-built. No `gen_*.json` describes it, so
    `framebuild.rebuild` cannot reach it and nothing else re-embeds
    `main-global.js`, `frame-rowcol.js` or `frame-corners.js` when they change,
    pins the range both frame backends read off `helpers.digits`, or corrects
    the comment. Without this the link keeps a stale copy and
    `check_layout.check_houses` reads it as a board that declares no interior
    rows or columns at all.

    `main-global.js` is refreshed here for the same reason as the other two:
    it is assembled from the tree (an `// #include` of the shared frame reader
    resolves at minify time, #359), so a link built before that file moved
    ships a body no source file matches. `check_shipped_link` asserts exactly
    that equality, and this is the only writer that can satisfy it.

    PUZZLE_LINK.txt is the source of truth for this example's three other
    hand-built links, so build_original.py and build_clued.py run after it.
    """
    board_path = HERE / "PUZZLE_LINK.txt"
    doc = decode_puzzle(board_path.read_text().strip())
    lc = find_constraint(doc, CONSTRAINT_NAME)
    lc["definition"]["backend"]["code"] = minify_file(HERE / "main-global.js")
    refresh_frame_backends(doc)
    doc["puzzle"]["minDigit"], doc["puzzle"]["maxDigit"] = DIGITS
    doc["puzzle"]["comment"] = COMMENT
    write_link(doc, board_path)
    return board_path


def rebuild(args, parser):
    if not args.refresh:
        parser.error("give --component with --out, or --refresh")
    if args.board:
        parser.error("--refresh rewrites PUZZLE_LINK.txt alone; drop --board")
    print(f"refreshed {refresh().name}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument(
        "--refresh",
        action="store_true",
        help="bring the board link up to date in place: the shared frame\n"
        "backends, the digit range, the rules text",
    )
    swap_main(HERE, p, rebuild)
