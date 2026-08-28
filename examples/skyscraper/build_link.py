# Build a same-board comparison link: a committed board link (PUZZLE_LINK.txt
# by default) with one named component's code swapped for a candidate file.
# The board, givens, and every other constraint field stay exactly as shipped
# -- only the requested component's code changes. See docs/real-app-timing.md.
#
#   uv run --with lzstring examples/skyscraper/build_link.py \
#     --component SkyscraperLineComponent.js --out /tmp/candidate.txt
#
# --component names a file whose basename (minus .js) matches an existing
# component registered on the board's "Skyscraper Lines" constraint; that
# component's code becomes the given file's, minified. The backend and any
# sibling component are untouched. --board swaps against a different
# committed link (e.g. PUZZLE_LINK_6x6.txt) instead of PUZZLE_LINK.txt;
# omitting it keeps the PUZZLE_LINK.txt default.

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from link_codec import decode_puzzle
from link_swap import check_and_write, swap_component_code
from minify import minify_js

HERE = pathlib.Path(__file__).parent
CONSTRAINT_NAME = "Skyscraper Lines"
TIMED_COMPONENT = "SkyscraperLineComponent"


def build(component_path, out_path, board_path=None):
    component_path = pathlib.Path(component_path)
    board_path = pathlib.Path(board_path) if board_path else HERE / "PUZZLE_LINK.txt"
    code = minify_js(component_path.read_text())
    base = decode_puzzle(board_path.read_text().strip())
    doc = swap_component_code(base, CONSTRAINT_NAME, component_path.stem, code)
    return check_and_write(base, doc, CONSTRAINT_NAME, out_path)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--component", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--board")
    args = p.parse_args()
    build(args.component, args.out, board_path=args.board)
    print(f"wrote {args.out}")
