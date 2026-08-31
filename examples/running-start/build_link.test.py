# Two checks on the example's links.
#
# 1. build_link.py --component --out: decode the output and assert the only
#    difference from the committed PUZZLE_LINK.txt is the swapped-in
#    component's code, and that swapping one of the two Running Start Lines
#    components leaves the other component and the backend untouched. Mirrors
#    examples/skyscraper/build_link.test.py.
# 2. The committed local link, PUZZLE_LINK_local.txt, built by
#    `build_size.py 9 3 3 --paths`: it must ship the bent paths as drawn groups
#    on the main.js lane, derive every clue from the solution in
#    gen_local.json, and carry at least one path whose digits repeat -- the
#    property that makes it a bare-line board rather than a frame board in
#    disguise (#239).
#
#   uv run --with lzstring examples/running-start/build_link.test.py

import json
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import CONSTRAINT_NAME, build
from frame import ring_cell
from link_codec import decode_puzzle
from link_swap import blanked, find_constraint
from minify import minify_js

# Must match framebuild.RULES_PREFIX; duplicated so this test needs no ortools.
RULES_PREFIX = "Normal sudoku rules apply on the inner grid. "

SWAPPED = "RunningStartComponent"
SIBLING = "RunningStartPairComponent"


def running_start(values):
    """The Running Start clue for one line of digits: the length of the first
    ascending run read inward, with a tie ending the run.

    A fourth statement of the rule, restated here rather than imported: this
    test runs under `just test` with lzstring alone, and build_size.rs sits
    behind framebuild's ortools import. It must agree with build_size.rs,
    add_running_start, and RunningStartComponent -- change the rule, change all
    four (CODING_STANDARDS.md, "The rule has one home"). The tie reading is the
    component's shipped `ALLOW_TIES = false`.
    """
    k = 1
    for i in range(1, len(values)):
        if values[i] > values[i - 1]:
            k += 1
        else:
            break
    return k


def check_local_link():
    """The committed local board: drawn bent paths, clues off the solution."""
    spec = json.loads((HERE / "gen_local.json").read_text())
    n, (bh, bw) = spec["n"], spec["box"]
    grid = spec["grid"]
    paths = {k: [tuple(c) for c in v] for k, v in spec["paths"].items()}
    W = n + 2

    def idx(r, c):
        return r * W + c

    p = decode_puzzle((HERE / "PUZZLE_LINK_local.txt").read_text().strip())["puzzle"]
    assert p["comment"].startswith(RULES_PREFIX), "rules text must open with the prefix"
    # a cell holds a value only when it is a given -- never the solution, never
    # a hidden clue
    assert not [c for c in p["cells"] if "value" in c and not c.get("given")]

    names = [c.get("name") for c in p["constraints"]]
    lc = p["constraints"][names.index(CONSTRAINT_NAME)]
    assert lc["definition"]["backend"]["code"] == minify_js(
        (HERE / "main.js").read_text()
    ), "the local board runs the main.js lane, not main-global.js"

    # the paths ship as drawn groups: clue cell first, then the path inward
    groups = lc["input"]["groups"]
    assert len(groups) == 4 * n, f"expected {4 * n} groups, got {len(groups)}"
    want = {
        tuple([idx(*ring_cell(key, W))] + [idx(r + 1, c + 1) for r, c in cells])
        for key, cells in paths.items()
    }
    assert {tuple(g["cells"]) for g in groups} == want, (
        "the drawn groups must be exactly the paths in gen_local.json"
    )

    # every clue is derived from the solution, not invented
    for key, cells in paths.items():
        assert spec["clue"][key] == running_start([grid[r][c] for r, c in cells]), key

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
    assert repeats, "no path carries a repeated digit"


if __name__ == "__main__":
    check_local_link()

    base = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        out = tmp / "candidate.txt"

        # a candidate file for the same registered component name, the shape a
        # real edit-and-retime loop uses
        candidate = tmp / f"{SWAPPED}.js"
        candidate.write_text(
            (HERE / f"{SWAPPED}.js").read_text() + "\n//! candidate edit\n"
        )

        link = build(candidate, out)
        doc = decode_puzzle(link)
        assert decode_puzzle(out.read_text().strip()) == doc, "did not write --out"

        # only the constraint's code differs from the committed link
        assert blanked(doc, CONSTRAINT_NAME) == blanked(base, CONSTRAINT_NAME)

        base_components = {
            c["name"]: c["code"]
            for c in find_constraint(base, CONSTRAINT_NAME)["definition"]["components"]
        }
        new_components = {
            c["name"]: c["code"]
            for c in find_constraint(doc, CONSTRAINT_NAME)["definition"]["components"]
        }
        assert new_components.keys() == base_components.keys()
        assert new_components[SWAPPED] != base_components[SWAPPED]
        # the sibling component and the backend are untouched
        assert new_components[SIBLING] == base_components[SIBLING]
        assert (
            find_constraint(doc, CONSTRAINT_NAME)["definition"]["backend"]["code"]
            == find_constraint(base, CONSTRAINT_NAME)["definition"]["backend"]["code"]
        )

        # swapping the currently-shipped component back in reproduces
        # PUZZLE_LINK.txt exactly
        same = decode_puzzle(build(HERE / f"{SWAPPED}.js", out))
        assert same == base, (
            "the committed component must round-trip to PUZZLE_LINK.txt"
        )

        # an unknown component name fails loud, not silently
        unknown = tmp / "NotARegisteredComponent.js"
        unknown.write_text("// not registered on the constraint\n")
        try:
            build(unknown, out)
            raise AssertionError(
                "expected a failure for an unregistered component name"
            )
        except ValueError:
            pass

    print("ok")
