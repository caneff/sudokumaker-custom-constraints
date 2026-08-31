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
# --global drops the drawn groups and makes the constraint global: the
# definition's input list becomes [] and the backend switches to
# main-global.js, which builds the 4n frame lines itself. Pass --backend to
# swap in a different file instead. Omit --global to keep the drawn (local)
# groups and main.js.
#
# --board swaps against a different committed link instead of PUZZLE_LINK.txt,
# which is how `just time numbered-rooms --board PUZZLE_LINK_local.txt` reaches
# the local board.

import argparse
import copy
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from link_codec import decode_puzzle
from link_swap import (
    check_and_write,
    find_constraint,
    replace_constraint_code,
    swap_component_code,
)
from minify import minify_js

HERE = pathlib.Path(__file__).parent
# The shipped board is hand-built and calls its constraint this; the generated
# boards (build_size.py, PUZZLE_LINK_local.txt among them) call it "Numbered
# Rooms". So build() finds the constraint by the component it registers, not by
# name, and this constant names only the shipped board's.
CONSTRAINT_NAME = "Custom Numbered Rooms"
TIMED_COMPONENT = "NumberedRoomsComponent"


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


def build(
    component_path, out_path, backend_path=None, global_mode=False, board_path=None
):
    """Swap in the component's code; with backend_path, the main code too.
    global_mode strips the groups and, absent an explicit backend_path,
    swaps in main-global.js -- the file that builds the frame itself.
    board_path swaps against a committed link other than PUZZLE_LINK.txt."""
    component_path = pathlib.Path(component_path)
    board_path = pathlib.Path(board_path) if board_path else HERE / "PUZZLE_LINK.txt"
    code = minify_js(component_path.read_text())
    base = decode_puzzle(board_path.read_text().strip())
    name = constraint_with(base, component_path.stem)
    doc = swap_component_code(base, name, component_path.stem, code)
    if global_mode and backend_path is None:
        backend_path = HERE / "main-global.js"
    if backend_path is not None:
        backend = minify_js(pathlib.Path(backend_path).read_text())
        doc = replace_constraint_code(doc, name, backend_code=backend)
    if global_mode:
        lc = find_constraint(doc, name)
        lc["definition"]["input"] = []
        lc["input"] = {}
        base = copy.deepcopy(base)
        blc = find_constraint(base, name)
        blc["definition"]["input"], blc["input"] = [], {}
    return check_and_write(base, doc, name, out_path)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--component", required=True)
    p.add_argument("--backend", help="main-code file to swap in as well (main.js)")
    p.add_argument("--out", required=True)
    p.add_argument("--global", dest="global_mode", action="store_true")
    p.add_argument("--board")
    args = p.parse_args()
    build(args.component, args.out, args.backend, args.global_mode, args.board)
    print(f"wrote {args.out}")
