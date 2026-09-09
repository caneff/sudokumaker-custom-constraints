# Build a same-board comparison link: the committed PUZZLE_LINK.txt with one
# named component's code swapped for a candidate file. The board, givens, and
# every other constraint field stay exactly as shipped -- only the requested
# component's code changes. See docs/real-app-timing.md.
#
#   uv run --with lzstring examples/numbered-rooms/build_link.py \
#     --component NumberedRoomsComponent.js --out /tmp/candidate.txt
#
# --component names a file whose basename (minus .js) matches an existing
# component registered on PUZZLE_LINK.txt's "Custom Numbered Rooms"
# constraint; that component's code becomes the given file's, minified. The
# backend and any other component are untouched.
#
# --backend swaps the main code in as well. PUZZLE_LINK.txt runs the global
# lane (docs/example-layout.md), so its backend is main-global.js.
#
# --board swaps against a different committed link instead of PUZZLE_LINK.txt,
# which is how `just time numbered-rooms --board PUZZLE_LINK_local.txt` reaches
# the local board.

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from framebuild import RULES_PREFIX, refresh_frame_backends
from link_codec import decode_puzzle
from link_swap import (
    check_and_write,
    replace_constraint_code,
    swap_component_code,
    write_link,
)
from minify import minify_js

HERE = pathlib.Path(__file__).parent
# The shipped board is hand-built and calls its constraint this; the generated
# boards (build_size.py, PUZZLE_LINK_local.txt among them) call it "Numbered
# Rooms". So build() finds the constraint by the component it registers, not by
# name, and this constant names only the shipped board's.
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
# defaults a custom puzzle to 0..9 whatever the grid size, and both shared frame
# backends read `helpers.digits`: left undeclared, a 9-cell interior line stops
# matching digitCount, so every row and column falls back from a named
# HouseComponent to a plain DifferentDigitsComponent with no houseType, and the
# corner pin lands on 0 -- a digit this puzzle never uses. Same pin and the same
# reason as running-start/build_link.py's template (#394).
DIGITS = (1, 9)


def constraint_with(doc, component_name):
    """The name of doc's constraint that registers `component_name`. Raises if
    none does -- a typo'd component must not silently no-op."""
    for c in doc["puzzle"]["constraints"]:
        definition = c.get("definition", {})
        if any(
            comp["name"] == component_name for comp in definition.get("components", [])
        ):
            return definition["name"]
    raise ValueError(f"no constraint registers a component named {component_name!r}")


def build(component_path, out_path, backend_path=None, board_path=None):
    """Swap in the component's code; with backend_path, the main code too.
    board_path swaps against a committed link other than PUZZLE_LINK.txt."""
    component_path = pathlib.Path(component_path)
    board_path = pathlib.Path(board_path) if board_path else HERE / "PUZZLE_LINK.txt"
    code = minify_js(component_path.read_text())
    base = decode_puzzle(board_path.read_text().strip())
    name = constraint_with(base, component_path.stem)
    doc = swap_component_code(base, name, component_path.stem, code)
    if backend_path is not None:
        backend = minify_js(pathlib.Path(backend_path).read_text())
        doc = replace_constraint_code(doc, name, backend_code=backend)
    return check_and_write(base, doc, name, out_path)


def refresh(board_path=None):
    """Rewrite a committed link in place: the frame's shared backends as they
    stand in the tree, the digit range those backends read, and the rules text.

    This board is hand-built. No `gen_*.json` describes it, so
    `framebuild.rebuild` cannot reach it and nothing else re-embeds
    `frame-rowcol.js` or `frame-corners.js` when they change, pins the range
    both of them read off `helpers.digits`, or corrects the comment. Without
    this the link keeps a stale copy and `check_layout.check_houses` reads it as
    a board that declares no interior rows or columns at all.

    PUZZLE_LINK.txt is the source of truth for this example's three other
    hand-built links, so build_original.py and build_clued.py run after it.
    """
    board_path = pathlib.Path(board_path) if board_path else HERE / "PUZZLE_LINK.txt"
    doc = decode_puzzle(board_path.read_text().strip())
    refresh_frame_backends(doc)
    doc["puzzle"]["minDigit"], doc["puzzle"]["maxDigit"] = DIGITS
    doc["puzzle"]["comment"] = COMMENT
    write_link(doc, board_path)
    return board_path


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--component")
    p.add_argument(
        "--backend", help="main-code file to swap in as well (main-global.js)"
    )
    p.add_argument("--out")
    p.add_argument("--board")
    p.add_argument(
        "--refresh",
        action="store_true",
        help="bring the board link up to date in place: the shared frame\n"
        "backends, the digit range, the rules text",
    )
    args = p.parse_args()
    if args.refresh:
        print(f"refreshed {refresh(args.board).name}")
    elif args.component and args.out:
        build(args.component, args.out, args.backend, args.board)
        print(f"wrote {args.out}")
    else:
        p.error("give --component with --out, or --refresh")
