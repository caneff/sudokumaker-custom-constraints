# Two checks on the example's links.
#
# 1. build_link.py --component --out: decode the output and assert the only
#    difference from the committed PUZZLE_LINK.txt is the swapped-in
#    component's code, and that swapping one Skyscraper Lines component leaves
#    any other component and the backend untouched. Prior art: the check in
#    build_original.py, and examples/_shared/probe_link.test.py.
# 2. The committed local links, built by `build_size.py <n> ... --paths`: each
#    must ship the bent paths as drawn groups on the main.js lane, derive every
#    clue from the solution in its gen JSON, and carry at least one path whose
#    digits repeat -- the property that makes it a bare-line board rather than
#    a frame board in disguise (#237, #240).
#
#   uv run --with lzstring examples/skyscraper/build_link.test.py

import json
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import CONSTRAINT_NAME, build
from frame import ring_cell
from link_codec import decode_puzzle, encode_link
from link_swap import blanked, find_constraint
from minify import minify_js

# Must match framebuild.RULES_PREFIX; duplicated so this test needs no ortools.
RULES_PREFIX = "Normal sudoku rules apply on the inner grid. "


def visible(values):
    """The Skyscrapers clue for one line of digits: buildings that top every
    building before them, reading inward. A tie is hidden, which is what
    SkyscraperOneSidedComponent's ALLOW_TIES = false says.

    A fourth statement of the rule, restated here rather than imported: this
    test runs under `just test` with lzstring alone, and build_size.sky sits
    behind framebuild's ortools import. It must agree with build_size.sky,
    add_visibility, and the components -- change the rule, change all four
    (CODING_STANDARDS.md, "The rule has one home").
    """
    count = 0
    tallest = 0
    for v in values:
        if v > tallest:
            count += 1
            tallest = v
    return count


def check_local_link(tag):
    """A committed local board: drawn bent paths, clues off the solution."""
    spec = json.loads((HERE / f"gen_{tag}.json").read_text())
    n, (bh, bw) = spec["n"], spec["box"]
    grid = spec["grid"]
    paths = {k: [tuple(c) for c in v] for k, v in spec["paths"].items()}
    W = n + 2

    def idx(r, c):
        return r * W + c

    p = decode_puzzle((HERE / f"PUZZLE_LINK_{tag}.txt").read_text().strip())["puzzle"]
    assert p["comment"].startswith(RULES_PREFIX), "rules text must open with the prefix"
    assert (p["minDigit"], p["maxDigit"]) == (1, n)
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
        f"the drawn groups must be exactly the paths in gen_{tag}.json"
    )

    # every clue is derived from the solution, not invented
    for key, cells in paths.items():
        assert spec["clue"][key] == visible([grid[r][c] for r, c in cells]), key

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


if __name__ == "__main__":
    base = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        out = tmp / "candidate.txt"

        # a candidate file for the same registered component name, the shape
        # a real edit-and-retime loop uses
        candidate = tmp / "SkyscraperLineComponent.js"
        candidate.write_text(
            (HERE / "SkyscraperLineComponent.js").read_text() + "\n//! candidate edit\n"
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
        assert (
            new_components["SkyscraperLineComponent"]
            != base_components["SkyscraperLineComponent"]
        )
        # the backend is untouched
        assert (
            find_constraint(doc, CONSTRAINT_NAME)["definition"]["backend"]["code"]
            == find_constraint(base, CONSTRAINT_NAME)["definition"]["backend"]["code"]
        )

        # swapping the currently-shipped component back in reproduces
        # PUZZLE_LINK.txt exactly
        same = decode_puzzle(build(HERE / "SkyscraperLineComponent.js", out))
        assert same == base, (
            "the committed component must round-trip to PUZZLE_LINK.txt"
        )

        # --board: swap against a different committed link, not just
        # PUZZLE_LINK.txt. Build one from a copy of the base doc with a
        # harmless field changed, so it is distinguishable from base but
        # still a valid "Skyscraper Lines" board.
        other_doc = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
        other_doc["puzzle"]["name"] = other_doc["puzzle"]["name"] + " (other board)"
        other_board = tmp / "other_board.txt"
        other_board.write_text(encode_link(other_doc) + "\n")

        board_link = build(candidate, out, board_path=other_board)
        board_doc = decode_puzzle(board_link)
        assert board_doc["puzzle"]["name"] == other_doc["puzzle"]["name"], (
            "--board must swap against the given board, not PUZZLE_LINK.txt"
        )
        assert blanked(board_doc, CONSTRAINT_NAME) == blanked(
            other_doc, CONSTRAINT_NAME
        )

        # omitting --board keeps default behaviour byte-identical
        default_link = build(candidate, out)
        assert default_link == link

        # an unknown component name fails loud, not silently
        try:
            build(HERE / "original" / "CustomSkyscraperLineComponent.js", out)
            raise AssertionError(
                "expected a failure for an unregistered component name"
            )
        except ValueError:
            pass

    check_local_link("local")
    check_local_link("6x6_local")

    print("ok")
