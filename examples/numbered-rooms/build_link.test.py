# Two checks on the example's links.
#
# 1. The shipped board and its wrapper twins run the lanes they claim, --refresh
#    refuses another board, and swapping the committed component and
#    main-global.js back into PUZZLE_LINK.txt reproduces it byte for byte. What
#    a swap may change is link_swap.test.py's.
# 2. The committed local links, built by `build_size.py <n> --paths`, pass
#    board_checks.check_local_board under this example's clue rule (#238).
#
#   uv run --with lzstring examples/numbered-rooms/build_link.test.py

import pathlib
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
from link_swap import find_constraint, swap_build
from minify import minify_file


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
    """The shipped board runs the GLOBAL lane: main-global.js as the backend
    and no drawn groups, so the backend builds the 4n frame lines itself
    (docs/example-layout.md, "Which lane a link runs")."""
    doc = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
    lc = find_constraint(doc, CONSTRAINT_NAME)
    assert lc["definition"]["backend"]["code"] == minify_file(
        HERE / "main-global.js"
    ), "PUZZLE_LINK.txt must run main-global.js"
    assert lc["definition"]["input"] == [] and lc["input"] == {}, (
        "the global board reads no drawn groups"
    )


def check_refresh_rejects_another_board():
    """`--refresh` stamps DIGITS and COMMENT, and both are written for this one
    hand-built 9x9 board. Aimed at any other committed link it would hand a
    smaller interior a 1..9 range -- nine digits against six-cell lines, the
    silent HouseComponent -> DifferentDigitsComponent degradation the range is
    declared to prevent -- and rules text describing a different puzzle. So the
    two flags must not combine, and the named board must come back untouched.
    """
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
        assert run.returncode != 0, f"--refresh --board was accepted: {run.stdout}"
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

    # the 9x9 stress board and the 6x6 twin that carries the local timing row
    for tag in ("local", "6x6_local"):
        spec, doc = check_local_board(
            HERE, tag, "NumberedRoomsComponent", numbered_room
        )
        p = doc["puzzle"]
        assert (p["minDigit"], p["maxDigit"]) == (1, spec["n"])
    print("ok")
