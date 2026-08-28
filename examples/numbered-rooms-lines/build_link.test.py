# build_link.py: the committed sources must reproduce PUZZLE_LINK.txt exactly,
# --component/--out must swap only the component's code, and the shipped link
# must stay share-ready -- a cell holds a value only when it is a given.
# Mirrors examples/isofill/build_link.test.py.
#
#   uv run --with lzstring examples/numbered-rooms-lines/build_link.test.py

import json
import pathlib
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import CONSTRAINT_NAME, RULES_PREFIX, TIMED_COMPONENT, build, check
from frame import ring_cell
from link_codec import decode_puzzle
from link_swap import blanked, find_constraint
from minify import minify_js

SPEC = json.loads((HERE / "gen.json").read_text())


def entered_values(doc):
    """Cells that ship a value without being a given -- the bug check_links.py
    gates: such a value opens on the recipient's board as a typed-in digit."""
    return [c for c in doc["puzzle"]["cells"] if "value" in c and not c.get("given")]


def solution_holds(spec):
    """The grid in gen.json must satisfy sudoku and every line's clue, or the
    board and the drawn geometry have drifted apart."""
    n, (bh, bw), grid = spec["n"], spec["box"], spec["grid"]
    houses = [[grid[r][c] for c in range(n)] for r in range(n)]
    houses += [[grid[r][c] for r in range(n)] for c in range(n)]
    houses += [
        [grid[br + dr][bc + dc] for dr in range(bh) for dc in range(bw)]
        for br in range(0, n, bh)
        for bc in range(0, n, bw)
    ]
    for house in houses:
        assert sorted(house) == list(range(1, n + 1)), f"not a sudoku: {house}"
    for key, cells in spec["lines"].items():
        k = grid[cells[0][0]][cells[0][1]]
        assert 1 <= k <= len(cells), (
            f"{key}: index {k} runs off a {len(cells)}-cell line"
        )
        r, c = cells[k - 1]
        assert grid[r][c] == spec["clue"][key], f"{key}: clue does not match the grid"


if __name__ == "__main__":
    solution_holds(SPEC)

    base_text = (HERE / "PUZZLE_LINK.txt").read_text().strip()
    base = decode_puzzle(base_text)

    # the committed sources reproduce the shipped link byte for byte
    link, doc, spec = build(HERE / f"{TIMED_COMPONENT}.js", HERE / "gen.json")
    check(link, doc, spec)
    assert link == base_text, (
        "the committed component and main.js must reproduce PUZZLE_LINK.txt exactly"
    )

    # share-ready: no cell ships a value it is not given
    assert entered_values(base) == [], "PUZZLE_LINK.txt ships entered values"
    n = SPEC["n"]
    assert sum(1 for c in base["puzzle"]["cells"] if not c.get("given")) == (
        (n + 2) ** 2 - 4 - len(SPEC["active"]) - len(SPEC["givens"])
    ), "the hidden clues and the whole interior must ship empty"

    # the rules text opens with the project's required sentence
    assert base["puzzle"]["comment"].startswith(RULES_PREFIX)

    # the constraint carries the committed code, not a stale copy
    lc = find_constraint(base, CONSTRAINT_NAME)
    assert lc["definition"]["backend"]["code"] == minify_js(
        (HERE / "main.js").read_text()
    )
    assert [c["name"] for c in lc["definition"]["components"]] == [TIMED_COMPONENT]
    assert lc["definition"]["components"][0]["code"] == minify_js(
        (HERE / f"{TIMED_COMPONENT}.js").read_text()
    )

    # every group is a clue cell followed by its line, in gen.json's own order
    W = n + 2
    groups = lc["input"]["groups"]
    assert len(groups) == 4 * n, f"expected {4 * n} groups, one per ring cell"
    for key, group in zip(sorted(SPEC["lines"]), groups, strict=True):
        r, c = ring_cell(key, W)
        want = [r * W + c] + [(r + 1) * W + (c + 1) for r, c in SPEC["lines"][key]]
        assert group["cells"] == want, f"{key}: group cells do not match gen.json"

    # The point of this example: some lines are not a whole row or column --
    # they bend, run diagonally, or stop short. The straight ones are the same
    # shape examples/numbered-rooms ships.
    def whole_house(cells):
        one_row = len({r for r, _ in cells}) == 1
        one_col = len({c for _, c in cells}) == 1
        return len(cells) == n and (one_row or one_col)

    drawn = [k for k, cells in SPEC["lines"].items() if not whole_house(cells)]
    assert sorted(drawn) == SPEC["drawn"], (
        f"gen.json lists {SPEC['drawn']} as drawn, but {sorted(drawn)} are not "
        "a whole row or column"
    )

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        # a candidate file for the same registered component name, the shape a
        # real edit-and-retime loop uses
        candidate = tmp / f"{TIMED_COMPONENT}.js"
        candidate.write_text(
            (HERE / f"{TIMED_COMPONENT}.js").read_text() + "\n//! candidate edit\n"
        )
        cand_link, cand_doc, cand_spec = build(candidate, HERE / "gen.json")
        check(cand_link, cand_doc, cand_spec)

        # the command line `just time` drives, run as a command line: argument
        # parsing and the write are part of what this test covers
        out = tmp / "candidate.txt"
        subprocess.run(
            [
                sys.executable,
                str(HERE / "build_link.py"),
                "--component",
                str(candidate),
                "--out",
                str(out),
            ],
            check=True,
            capture_output=True,
        )
        assert decode_puzzle(out.read_text().strip()) == cand_doc, (
            "--component/--out did not write the candidate link"
        )

        # only the component's code differs from the committed link
        assert blanked(cand_doc, CONSTRAINT_NAME) == blanked(base, CONSTRAINT_NAME)
        cand_lc = find_constraint(cand_doc, CONSTRAINT_NAME)
        assert (
            cand_lc["definition"]["components"][0]["code"]
            != lc["definition"]["components"][0]["code"]
        ), "component code did not change"
        assert (
            cand_lc["definition"]["backend"]["code"]
            == lc["definition"]["backend"]["code"]
        ), "the backend must be untouched"
        assert entered_values(cand_doc) == []

    print("ok")
