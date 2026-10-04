import pathlib
import re
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from board_checks import check_local_board
from build_link import CONSTRAINT_NAME
from frame import ring_cell
from link_codec import decode_puzzle
from link_swap import swap_build
from minify import minify_file
from sm_document import find_constraint


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


def check_shipped_link():
    doc = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
    lc = find_constraint(doc, CONSTRAINT_NAME)
    assert lc["definition"]["backend"]["code"] == minify_file(
        HERE / "main-global.js"
    ), "PUZZLE_LINK.txt must run main-global.js"
    assert lc["definition"]["input"] == [] and lc["input"] == {}, (
        "the global board reads no drawn groups"
    )


def check_refresh_rejects_another_board():
    """`--refresh` stamps DIGITS and COMMENT, both written for the one
    hand-built 9x9. On a smaller board the 1..9 range would silently degrade
    every HouseComponent to a DifferentDigitsComponent, and the rules text
    would describe a different puzzle."""
    with tempfile.TemporaryDirectory() as tmp:
        copy = pathlib.Path(tmp) / "PUZZLE_LINK_6x6.txt"
        before = (HERE / "PUZZLE_LINK_6x6.txt").read_text()
        copy.write_text(before)
        run = subprocess.run(
            [
                sys.executable,
                str(HERE / "build_link.py"),
                "--refresh",
                "--board",
                str(copy),
            ],
            capture_output=True,
            text=True,
        )
        # argparse's usage error, exit 2, naming --board: a crash for some other
        # reason does not pass as the refusal. Either guard's message will do:
        # the shared swap_main refuses first, `rebuild`'s own guard behind it.
        assert run.returncode == 2, (run.returncode, run.stdout, run.stderr)
        assert re.search(r"error: .*--board", run.stderr), run.stderr
        assert copy.read_text() == before, "--refresh rewrote the board it was given"


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
        assert lc["definition"]["backend"]["code"] == minify_file(
            HERE / "original" / "main.js"
        ), f"{name} must run the original wrapper's main.js"
        groups = lc["input"]["groups"]
        assert {tuple(g["cells"]) for g in groups} == want, (
            f"{name}: the drawn groups must be the 36 frame lines, clue first"
        )


if __name__ == "__main__":
    check_shipped_link()
    check_wrapper_links()
    check_refresh_rejects_another_board()

    board = HERE / "PUZZLE_LINK.txt"
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "candidate.txt"
        component = HERE / "NumberedRoomsComponent.js"
        assert swap_build(board, component, out) == board.read_text().strip(), (
            "the committed component must round-trip to PUZZLE_LINK.txt"
        )
        assert (
            swap_build(board, component, out, backend=HERE / "main-global.js")
            == board.read_text().strip()
        ), (
            "PUZZLE_LINK.txt runs the global lane, so the committed "
            "main-global.js must round-trip to it"
        )

    for tag in ("local", "6x6_local"):
        spec, doc = check_local_board(
            HERE, tag, "NumberedRoomsComponent", numbered_room
        )
        p = doc["puzzle"]
        assert (p["minDigit"], p["maxDigit"]) == (1, spec["n"])
    print("ok")
