# Two checks on the example's links.
#
# 1. build_link.py --component --out: decode the output and assert the only
#    difference from the committed PUZZLE_LINK.txt is the swapped-in
#    component's code. Prior art: the check in build_original.py, and
#    examples/_shared/probe_link.test.py.
# 2. The committed local links, built by `build_size.py <n> --paths`: each must
#    ship the bent paths as drawn groups on the main.js lane, derive every clue
#    from the solution in its gen JSON, and carry at least one path whose digits
#    repeat -- the property that makes it a bare-line board rather than a frame
#    board in disguise (#238).
#
#   uv run --with lzstring examples/numbered-rooms/build_link.test.py

import json
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import CONSTRAINT_NAME, build, constraint_with
from frame import ring_cell
from link_codec import decode_puzzle, encode_link
from link_swap import blanked, find_constraint
from minify import minify_js

# Must match framebuild.RULES_PREFIX. Written out rather than imported for the
# same reason as the rule below: an assertion that imports what it checks
# against cannot disagree with it.
RULES_PREFIX = "Normal sudoku rules apply on the inner grid. "


def numbered_room(values):
    """The Numbered Rooms clue for one line of digits: the first cell holds a
    1-based index k, and the clue is the digit in the k-th cell.

    A fourth statement of the rule, restated here rather than imported from
    build_size: this is what proves the committed board's clues really follow
    the rule, and importing build_size.numbered_room would only prove they
    follow whatever build_size says today. It must agree with
    build_size.numbered_room, add_numbered_room, and NumberedRoomsComponent --
    change the rule, change all four (CODING_STANDARDS.md, "The rule has one
    home").
    """
    return values[values[0] - 1]


def check_local_link(tag):
    """A committed local board: drawn bent paths, clues off the solution."""
    spec = json.loads((HERE / f"gen_{tag}.json").read_text())
    n, (bh, bw) = spec["n"], spec["box"]
    grid = spec["grid"]
    paths = {k: [tuple(c) for c in v] for k, v in spec["paths"].items()}
    W = n + 2

    def idx(r, c):
        return r * W + c

    doc = decode_puzzle((HERE / f"PUZZLE_LINK_{tag}.txt").read_text().strip())
    p = doc["puzzle"]
    assert p["comment"].startswith(RULES_PREFIX), "rules text must open with the prefix"
    assert (p["minDigit"], p["maxDigit"]) == (1, n)
    # a cell holds a value only when it is a given -- never the solution, never
    # a hidden clue
    assert not [c for c in p["cells"] if "value" in c and not c.get("given")]

    lc = find_constraint(doc, constraint_with(doc, "NumberedRoomsComponent"))
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
        assert spec["clue"][key] == numbered_room([grid[r][c] for r, c in cells]), key

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


def check_shipped_link():
    """The shipped board runs the GLOBAL lane: main-global.js as the backend
    and no drawn groups, so the backend builds the 4n frame lines itself
    (docs/example-layout.md, "Which lane a link runs")."""
    doc = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
    lc = find_constraint(doc, CONSTRAINT_NAME)
    assert lc["definition"]["backend"]["code"] == minify_js(
        (HERE / "main-global.js").read_text()
    ), "PUZZLE_LINK.txt must run main-global.js"
    assert lc["definition"]["input"] == [] and lc["input"] == {}, (
        "the global board reads no drawn groups"
    )


def check_wrapper_links():
    """`PUZZLE_LINK.txt` ships no groups, so build_original.py builds the
    ones the original wrapper reads. Each `_original` link must therefore
    carry exactly the 36 frame lines, clue cell first -- a wrong or drifted
    set would make the ~100x comparison a different puzzle, silently.

    The expected set is written out here rather than imported from
    build_original: an assertion that imports what it checks against cannot
    disagree with it (see numbered_room above).
    """
    n = 9
    W = n + 2
    lines = {f"L{i}": [(i, c) for c in range(n)] for i in range(n)}
    lines |= {f"R{i}": [(i, c) for c in range(n - 1, -1, -1)] for i in range(n)}
    lines |= {f"T{i}": [(r, i) for r in range(n)] for i in range(n)}
    lines |= {f"B{i}": [(r, i) for r in range(n - 1, -1, -1)] for i in range(n)}
    want = {
        tuple(
            [W * ring_cell(key, W)[0] + ring_cell(key, W)[1]]
            + [(r + 1) * W + c + 1 for r, c in cells]
        )
        for key, cells in lines.items()
    }

    for name in ("PUZZLE_LINK_original.txt", "PUZZLE_LINK_clued_original.txt"):
        doc = decode_puzzle((HERE / name).read_text().strip())
        lc = find_constraint(doc, CONSTRAINT_NAME)
        assert lc["definition"]["backend"]["code"] == minify_js(
            (HERE / "original" / "main.js").read_text()
        ), f"{name} must run the original wrapper's main.js"
        groups = lc["input"]["groups"]
        assert {tuple(g["cells"]) for g in groups} == want, (
            f"{name}: the drawn groups must be the 36 frame lines, clue first"
        )


if __name__ == "__main__":
    check_shipped_link()
    check_wrapper_links()
    base = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        out = tmp / "candidate.txt"

        # a candidate file for the same registered component name
        # (NumberedRoomsComponent), the shape a real edit-and-retime loop uses
        candidate = tmp / "NumberedRoomsComponent.js"
        candidate.write_text(
            (HERE / "NumberedRoomsComponent.js").read_text() + "\n//! candidate edit\n"
        )

        link = build(candidate, out)
        doc = decode_puzzle(link)
        assert decode_puzzle(out.read_text().strip()) == doc, "did not write --out"

        # only the constraint's code differs from the committed link
        assert blanked(doc, CONSTRAINT_NAME) == blanked(base, CONSTRAINT_NAME)
        base_components = find_constraint(base, CONSTRAINT_NAME)["definition"][
            "components"
        ]
        new_components = find_constraint(doc, CONSTRAINT_NAME)["definition"][
            "components"
        ]
        assert [c["name"] for c in new_components] == [
            c["name"] for c in base_components
        ]
        assert new_components != base_components, "component code did not change"
        assert (
            find_constraint(doc, CONSTRAINT_NAME)["definition"]["backend"]["code"]
            == find_constraint(base, CONSTRAINT_NAME)["definition"]["backend"]["code"]
        )

        # swapping the currently-shipped component back in reproduces
        # PUZZLE_LINK.txt exactly; so does the committed main code
        same = decode_puzzle(build(HERE / "NumberedRoomsComponent.js", out))
        assert same == base, (
            "the committed component must round-trip to PUZZLE_LINK.txt"
        )
        same = decode_puzzle(
            build(HERE / "NumberedRoomsComponent.js", out, HERE / "main-global.js")
        )
        assert same == base, (
            "PUZZLE_LINK.txt runs the global lane, so the committed "
            "main-global.js must round-trip to it"
        )

        # --board swaps against a link other than PUZZLE_LINK.txt, which is how
        # `just time numbered-rooms --board PUZZLE_LINK_local.txt` reaches the
        # local board. Build a distinguishable board from the base doc.
        other_doc = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
        other_doc["puzzle"]["name"] = other_doc["puzzle"]["name"] + " (other board)"
        other_board = tmp / "other_board.txt"
        other_board.write_text(encode_link(other_doc) + "\n")

        board_doc = decode_puzzle(build(candidate, out, board_path=other_board))
        assert board_doc["puzzle"]["name"] == other_doc["puzzle"]["name"], (
            "--board must swap against the given board, not PUZZLE_LINK.txt"
        )
        assert blanked(board_doc, CONSTRAINT_NAME) == blanked(
            other_doc, CONSTRAINT_NAME
        )
        # omitting --board keeps the default byte-identical
        assert build(candidate, out) == link

        # a component whose name is not registered on the constraint fails
        # loud, not silently -- e.g. the differently-named original wrapper
        try:
            build(HERE / "original" / "CustomIndexComponent.js", out)
            raise AssertionError(
                "expected a failure for an unregistered component name"
            )
        except ValueError:
            pass

    # the 9x9 stress board and the 6x6 twin that carries the local timing row
    for tag in ("local", "6x6_local"):
        check_local_link(tag)
    print("ok")
