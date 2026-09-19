# Build the RequiredDigits-wrapper comparison boards (#534): the shipped
# Outside Sudoku board (PUZZLE_LINK.txt), with "Custom Outside Sudoku"
# replaced by RequiredDigitsWrapperComponent.js -- a wrapper that idles while
# its clue is blank, then swaps itself for a required-digits rule over the
# clue's window (docs/gotchas.md #1's edge-clue shape). Only that
# constraint's backend, components and input change; grid, givens and every
# other constraint are the shipped board's.
#
# The two links this writes are not this example's own board -- they exist
# only to time RequiredDigitsGacComponent in the real app
# (docs/real-app-timing.md), the way docs/research/required-digits-gac/'s
# soundness-harness.mjs and bench-required-digits.mjs already do offline --
# so they, and the component/backend source they are built from, are written
# and read from that directory, not committed as a PUZZLE_LINK*.txt of this
# example: examples/_shared/check_layout.py's fixed link-naming convention
# and its "every shipped component is one the backend registers" check both
# assume a real example's own board, neither of which this is (the second
# component here, RequiredDigitsGacComponent, is reachable only through the
# wrapper's own `customComponents.RequiredDigitsGacComponent`
# (docs/gotchas.md #1), never `new`'d by the backend itself). This script
# stays in examples/outside-sudoku/ because a .py file under docs/research/
# is refused by that gate (check_research_python, #469/#474) -- finder code
# goes in finders/, and everything else research goes through an example's
# own build script instead.
#
#   uv run examples/outside-sudoku/build_required_digits.py
#
# Writes, into docs/research/required-digits-gac/:
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
#
# --out names a directory to write into instead; omitting it keeps the
# default of docs/research/required-digits-gac/.

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from link_codec import decode_puzzle, encode_link
from link_swap import frame_only, replace_constraint_code
from minify import minify_file

HERE = pathlib.Path(__file__).parent
RESEARCH_DIR = HERE.parent.parent / "docs" / "research" / "required-digits-gac"
CONSTRAINT_NAME = "Custom Outside Sudoku"
TIMED_COMPONENT = "RequiredDigitsWrapperComponent"


def _backend_code():
    return minify_file(RESEARCH_DIR / "main-required-digits-global.js")


def _build(base, components):
    """`base` with "Custom Outside Sudoku"'s backend and components replaced
    -- everything else, checked against `base` itself, is the shipped
    board's. Shared tail of build_gac/build_original: only the components
    list differs between the two swap-target variants."""
    doc = replace_constraint_code(
        base, CONSTRAINT_NAME, backend_code=_backend_code(), components=components
    )
    assert frame_only(base, CONSTRAINT_NAME) == frame_only(doc, CONSTRAINT_NAME), (
        "frames differ beyond the constraint's own code and input"
    )
    return doc


def build_gac(base):
    """`base` with the wrapper registered alongside RequiredDigitsGacComponent
    itself, swapped to GAC."""
    host_code = minify_file(RESEARCH_DIR / "RequiredDigitsWrapperComponent.js")
    gac_code = minify_file(RESEARCH_DIR / "RequiredDigitsGacComponent.js")
    assert host_code and gac_code, "component code empty"
    return _build(
        base,
        [
            {"type": "code", "name": TIMED_COMPONENT, "code": host_code},
            {"type": "code", "name": "RequiredDigitsGacComponent", "code": gac_code},
        ],
    )


def build_original(base):
    """`base` with the wrapper's baseline variant -- the built-in
    RequiredDigitsComponent as the swap target, no second component needed."""
    host_code = minify_file(RESEARCH_DIR / "RequiredDigitsWrapperComponentBuiltin.js")
    assert host_code, "component code empty"
    return _build(base, [{"type": "code", "name": TIMED_COMPONENT, "code": host_code}])


def write(doc, out_path):
    link = encode_link(doc)
    assert decode_puzzle(link) == doc, "link does not round-trip"
    pathlib.Path(out_path).write_text(link + "\n")
    return link


def build(out_dir=RESEARCH_DIR):
    """Rebuild both derived links into `out_dir`. Reads the shipped
    PUZZLE_LINK.txt and every source file from its own fixed locations
    regardless of `out_dir`; only the written links move."""
    base = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
    gac_link = write(build_gac(base), out_dir / "PUZZLE_LINK_required_digits.txt")
    original_link = write(
        build_original(base), out_dir / "PUZZLE_LINK_required_digits_original.txt"
    )
    return gac_link, original_link


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument(
        "--out",
        help="directory to write into (default: docs/research/required-digits-gac/)",
    )
    args = p.parse_args()
    gac_link, original_link = build(
        pathlib.Path(args.out) if args.out else RESEARCH_DIR
    )
    print(
        f"wrote PUZZLE_LINK_required_digits.txt ({len(gac_link)} chars) "
        f"and PUZZLE_LINK_required_digits_original.txt ({len(original_link)} chars)"
    )
