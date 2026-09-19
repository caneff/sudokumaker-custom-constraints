# Two checks on the example's links.
#
# 1. Swapping each shipped component back into PUZZLE_LINK.txt reproduces it
#    byte for byte. What a swap may change is link_swap.test.py's.
# 1b. build_from_template + check: the no-args rebuild path. It must
#    reproduce the committed PUZZLE_LINK.txt byte for byte from gen.json and
#    the current source files, and fail loud when the document it is handed is
#    not the one that was built.
# 2. The committed local link, PUZZLE_LINK_local.txt, built by
#    `build_size.py 9 3 3 --paths`, passes board_checks.check_local_board under
#    this example's clue rule (#239) and ships the clues gen_local.json
#    records.
#
#   uv run --with lzstring examples/running-start/build_link.test.py

import json
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from board_checks import check_local_board
from build_link import CONSTRAINT_NAME, build_from_template, check
from frame import ring_cell
from link_codec import encode_link
from link_swap import swap_build


def running_start(values):
    """The Running Start clue for one line of digits: the length of the first
    ascending run read inward, with a tie ending the run.

    A fourth statement of the rule, restated here rather than imported: a
    test that read the rule off the generator would agree with it by
    construction and catch no drift. It must agree with build_size.rs,
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
    """The committed local board: check_local_board, and the clues the link
    ships are the ones gen_local.json records."""
    spec, doc = check_local_board(HERE, "local", "RunningStartComponent", running_start)
    W = spec["n"] + 2
    cells_of_link = doc["puzzle"]["cells"]

    # Without this the shared checks read gen_local.json alone, and a link
    # built with the wrong ring values would pass them all. Only the shown
    # clues carry a value; the rest are the interactive ones the solver reads
    # off the line.
    shown = 0
    for key, value in spec["clue"].items():
        r, c = ring_cell(key, W)
        cell = cells_of_link[r * W + c]
        if "value" not in cell:
            continue
        assert cell.get("given"), f"{key} ships as an entered digit, not a given"
        assert cell["value"] == value, f"{key} ships {cell['value']}, clue is {value}"
        shown += 1
    assert 0 < shown < len(spec["clue"]), (
        f"{shown} of {len(spec['clue'])} clues shown -- a board with every ring "
        "cell filled leaves the solver nothing to read off a line"
    )


def check_template_rebuild():
    """The no-args rebuild: source files in, the committed link out."""
    link, doc = build_from_template()
    check(link, doc)  # the same check the CLI runs before writing the file

    committed = (HERE / "PUZZLE_LINK.txt").read_text().strip()
    assert link == committed, (
        "build_link.py with no args must reproduce the committed "
        "PUZZLE_LINK.txt -- regenerate it, or the shipped link has drifted "
        "from main-global.js / the components / gen.json"
    )

    p = doc["puzzle"]
    assert (p["minDigit"], p["maxDigit"]) == (1, 9)
    assert p["author"] == "", "the template's author must not ship"
    # the ring is not fully specified: the interactive clues are what the
    # solver reads off each line
    assert [c for c in p["cells"] if c.get("given")], "the board ships some givens"
    # the generated cosmetics replace the template's hand-drawn ones
    assert [c for c in p["constraints"] if c.get("type") == 2000]

    # check() fails loud on a doc the link does not encode
    wrong = json.loads(json.dumps(doc))
    wrong["puzzle"]["comment"] = "not what was encoded"
    try:
        check(link, wrong)
        raise AssertionError("check accepted a doc the link does not decode to")
    except AssertionError as e:
        assert "does not decode" in str(e), e

    # and on a board whose constraint lost a component
    dropped = json.loads(json.dumps(doc))
    for c in dropped["puzzle"]["constraints"]:
        if c.get("definition", {}).get("name") == CONSTRAINT_NAME:
            del c["definition"]["components"][-1]
    try:
        check(encode_link(dropped), dropped)
        raise AssertionError("check accepted a constraint missing a component")
    except AssertionError as e:
        assert "components wrong" in str(e), e


if __name__ == "__main__":
    check_local_link()
    check_template_rebuild()

    board = HERE / "PUZZLE_LINK.txt"
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "candidate.txt"
        for name in ("RunningStartComponent", "RunningStartPairComponent"):
            assert swap_build(board, HERE / f"{name}.js", out) == (
                board.read_text().strip()
            ), f"the committed {name} must round-trip to PUZZLE_LINK.txt"

    print("ok")
