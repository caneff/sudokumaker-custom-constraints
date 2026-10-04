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
    """A fourth statement of the rule, kept here rather than imported: a test
    that read the rule off the generator would agree with it by construction.
    It must agree with build_size.rs, add_running_start and
    RunningStartComponent (CODING_STANDARDS.md, "The rule has one home"), and
    ends the run on a tie, as the component's shipped `ALLOW_TIES = false` does.
    """
    k = 1
    for i in range(1, len(values)):
        if values[i] > values[i - 1]:
            k += 1
        else:
            break
    return k


def check_local_link():
    spec, doc = check_local_board(HERE, "local", "RunningStartComponent", running_start)
    W = spec["n"] + 2
    cells_of_link = doc["puzzle"]["cells"]

    # The shared checks read gen_local.json alone, so without this a link built
    # with the wrong ring values would pass them all.
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
    link, doc = build_from_template()
    check(link, doc)

    committed = (HERE / "PUZZLE_LINK.txt").read_text().strip()
    assert link == committed, (
        "build_link.py with no args must reproduce the committed "
        "PUZZLE_LINK.txt -- regenerate it, or the shipped link has drifted "
        "from main-global.js / the components / gen.json"
    )

    p = doc["puzzle"]
    assert (p["minDigit"], p["maxDigit"]) == (1, 9)
    assert p["author"] == "", "the template's author must not ship"
    assert [c for c in p["cells"] if c.get("given")], "the board ships some givens"
    assert [c for c in p["constraints"] if c.get("type") == 2000]

    wrong = json.loads(json.dumps(doc))
    wrong["puzzle"]["comment"] = "not what was encoded"
    try:
        check(link, wrong)
    except AssertionError as e:
        assert "does not decode" in str(e), e
    else:
        raise AssertionError("check accepted a doc the link does not decode to")

    dropped = json.loads(json.dumps(doc))
    for c in dropped["puzzle"]["constraints"]:
        if c.get("definition", {}).get("name") == CONSTRAINT_NAME:
            del c["definition"]["components"][-1]
    try:
        check(encode_link(dropped), dropped)
    except AssertionError as e:
        assert "components wrong" in str(e), e
    else:
        raise AssertionError("check accepted a constraint missing a component")


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
