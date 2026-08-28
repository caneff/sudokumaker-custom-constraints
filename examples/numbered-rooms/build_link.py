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
# definition's input list becomes [] and main.js builds the 4n frame lines
# itself. Omit it to keep the drawn (local) groups.

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
CONSTRAINT_NAME = "Custom Numbered Rooms"
TIMED_COMPONENT = "NumberedRoomsComponent"


def build(component_path, out_path, backend_path=None, global_mode=False):
    """Swap in the component's code; with backend_path, the main code too.
    global_mode strips the groups so the main code builds the frame itself."""
    component_path = pathlib.Path(component_path)
    code = minify_js(component_path.read_text())
    base = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
    doc = swap_component_code(base, CONSTRAINT_NAME, component_path.stem, code)
    if backend_path is not None:
        backend = minify_js(pathlib.Path(backend_path).read_text())
        doc = replace_constraint_code(doc, CONSTRAINT_NAME, backend_code=backend)
    if global_mode:
        lc = find_constraint(doc, CONSTRAINT_NAME)
        lc["definition"]["input"] = []
        lc["input"] = {}
        base = copy.deepcopy(base)
        blc = find_constraint(base, CONSTRAINT_NAME)
        blc["definition"]["input"], blc["input"] = [], {}
    return check_and_write(base, doc, CONSTRAINT_NAME, out_path)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--component", required=True)
    p.add_argument("--backend", help="main-code file to swap in as well (main.js)")
    p.add_argument("--out", required=True)
    p.add_argument("--global", dest="global_mode", action="store_true")
    args = p.parse_args()
    build(args.component, args.out, args.backend, args.global_mode)
    print(f"wrote {args.out}")
