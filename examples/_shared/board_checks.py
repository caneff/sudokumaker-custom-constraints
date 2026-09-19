# The checks every committed local board shares, whatever its clue rule: a
# board built by `build_size.py <n> ... --paths` ships its bent paths as drawn
# groups on the main.js lane, derives every clue from the solution in its gen
# JSON, bends every path, and repeats a digit on at least one -- the property
# that makes it a bare-line board rather than a frame board in disguise (#237).
#
# The clue rule is the caller's: each example's build_link.test.py restates its
# own rather than importing the generator's (CODING_STANDARDS.md, "The rule has
# one home"). The rules-text prefix and the entered-value rule are
# check_layout's, which sweeps every committed link.

import json
import pathlib

from frame import ring_cell
from link_codec import decode_puzzle
from link_swap import constraint_with, find_constraint
from minify import minify_file


def check_local_board(example_dir, tag, component, clue):
    """Assert the committed `PUZZLE_LINK_<tag>.txt` is the local board its
    `gen_<tag>.json` records, on the constraint registering `component`, with
    `clue(values)` the example's rule for one path's digits read inward.

    Returns (spec, doc) -- the gen JSON and the decoded link -- for the
    example's own board-specific assertions."""
    example_dir = pathlib.Path(example_dir)
    spec = json.loads((example_dir / f"gen_{tag}.json").read_text())
    n, (bh, bw) = spec["n"], spec["box"]
    grid = spec["grid"]
    paths = {k: [tuple(c) for c in v] for k, v in spec["paths"].items()}
    W = n + 2

    def idx(r, c):
        return r * W + c

    link = example_dir / f"PUZZLE_LINK_{tag}.txt"
    doc = decode_puzzle(link.read_text().strip())
    lc = find_constraint(doc, constraint_with(doc, component))
    assert lc["definition"]["backend"]["code"] == minify_file(
        example_dir / "main.js"
    ), f"{link.name}: the local board runs the main.js lane, not main-global.js"

    # the paths ship as drawn groups: clue cell first, then the path inward
    groups = lc["input"]["groups"]
    assert len(groups) == 4 * n, f"expected {4 * n} groups, got {len(groups)}"
    want = {
        tuple([idx(*ring_cell(key, W))] + [idx(r + 1, c + 1) for r, c in cells])
        for key, cells in paths.items()
    }
    assert {tuple(g["cells"]) for g in groups} == want, (
        f"{link.name}: the drawn groups must be exactly the paths in gen_{tag}.json"
    )

    # every clue is derived from the solution, not invented
    for key, cells in paths.items():
        assert spec["clue"][key] == clue([grid[r][c] for r, c in cells]), key

    # every path bends: its cells are not one row, one column, or one box, so
    # the app cannot prove the digits distinct and the line reads as bare
    for key, cells in paths.items():
        rows = {r for r, _ in cells}
        cols = {c for _, c in cells}
        boxes = {(r // bh, c // bw) for r, c in cells}
        assert min(len(rows), len(cols), len(boxes)) > 1, f"{key} is a straight line"

    # at least one path really repeats a digit -- the whole point of a bent
    # path, and the property a future regeneration must not lose
    repeats = [
        key
        for key, cells in paths.items()
        if len({grid[r][c] for r, c in cells}) < len(cells)
    ]
    assert repeats, f"no path in gen_{tag}.json carries a repeated digit"
    return spec, doc
