# Build the RequiredDigits-wrapper comparison boards: the shipped
# Outside Sudoku board (PUZZLE_LINK.txt), with "Custom Outside Sudoku"
# replaced by RequiredDigitsWrapperComponent.js -- a wrapper that idles while
# its clue is blank, then swaps itself for a required-digits rule over the
# clue's window (the edge-clue shape of gotcha 1 in docs/gotchas.md). Only that
# constraint's backend, components and input change; grid, givens and every
# other constraint are the shipped board's.
#
# The two links are not this example's own board -- they exist only to time
# RequiredDigitsGacComponent in the real app (docs/real-app-timing.md) -- so
# they and their component/backend source live in required-digits/, not as a
# PUZZLE_LINK*.txt here: check_layout.py's link naming and its "every shipped
# component is one the backend registers" check both assume an example's own
# board, and RequiredDigitsGacComponent is reached only through the wrapper's
# `customComponents`, never `new`'d by the backend.
#
# Writes, into required-digits/:
#   PUZZLE_LINK_required_digits.txt          -- ours: RequiredDigitsGacComponent
#   PUZZLE_LINK_required_digits_original.txt -- baseline: built-in RequiredDigitsComponent
#
# Timed directly through examples/_shared/app-solve.mjs, not
# examples/_shared/time_example.py's `just time` automation: that driver
# resolves an example's backend against BACKEND_FILES ("main.js",
# "main-global.js") inside the named example directory, which
# main-required-digits-global.js -- deliberately not either of those names,
# so it can never be mistaken for the real Outside Sudoku backend -- does not
# match. See docs/research/required-digits-gac/ for the reproduce commands
# and the recorded rows.

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from link_codec import decode_puzzle
from link_swap import frame_only, replace_constraint_code
from minify import minify_file
from sm_document import write_link

HERE = pathlib.Path(__file__).parent
LINK_DIR = HERE / "required-digits"
OUTSIDE_SUDOKU = HERE.parent / "outside-sudoku"
CONSTRAINT_NAME = "Custom Outside Sudoku"
TIMED_COMPONENT = "RequiredDigitsWrapperComponent"


def _backend_code():
    return minify_file(LINK_DIR / "main-required-digits-global.js")


def _build(base, components):
    doc = replace_constraint_code(
        base, CONSTRAINT_NAME, backend_code=_backend_code(), components=components
    )
    assert frame_only(base, CONSTRAINT_NAME) == frame_only(doc, CONSTRAINT_NAME), (
        "frames differ beyond the constraint's own code and input"
    )
    return doc


def build_gac(base):
    host_code = minify_file(LINK_DIR / "RequiredDigitsWrapperComponent.js")
    gac_code = minify_file(HERE / "RequiredDigitsGacComponent.js")
    assert host_code and gac_code, "component code empty"
    return _build(
        base,
        [
            {"type": "code", "name": TIMED_COMPONENT, "code": host_code},
            {"type": "code", "name": "RequiredDigitsGacComponent", "code": gac_code},
        ],
    )


def build_original(base):
    host_code = minify_file(LINK_DIR / "RequiredDigitsWrapperComponentBuiltin.js")
    assert host_code, "component code empty"
    return _build(base, [{"type": "code", "name": TIMED_COMPONENT, "code": host_code}])


def build(out_dir=LINK_DIR):
    base = decode_puzzle((OUTSIDE_SUDOKU / "PUZZLE_LINK.txt").read_text().strip())
    gac_link = write_link(build_gac(base), out_dir / "PUZZLE_LINK_required_digits.txt")
    original_link = write_link(
        build_original(base), out_dir / "PUZZLE_LINK_required_digits_original.txt"
    )
    return gac_link, original_link


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument(
        "--out",
        help="directory to write into (default: required-digits/)",
    )
    args = p.parse_args()
    gac_link, original_link = build(pathlib.Path(args.out) if args.out else LINK_DIR)
    print(
        f"wrote PUZZLE_LINK_required_digits.txt ({len(gac_link)} chars) "
        f"and PUZZLE_LINK_required_digits_original.txt ({len(original_link)} chars)"
    )
