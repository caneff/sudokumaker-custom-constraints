import json
import pathlib
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

import build_hard_links
from build_hard_links import FIXTURES
from build_link import build, check


def test_a_board_wider_than_nine_builds_with_digits_1_to_9():
    # The app's digit range is the board's digit count, not its longer side:
    # 12x3 (regions of 4) and 10x9 (regions of 10) both play 1-9.
    boards = {
        (12, 3): [
            "".join(str(3 * r + c // 4 + 1) for c in range(12)) for r in range(3)
        ],
        (10, 9): [str(r + 1) * 10 for r in range(9)],
    }
    with tempfile.TemporaryDirectory() as tmp:
        for (width, height), grid in boards.items():
            gen = pathlib.Path(tmp) / f"gen_{width}x{height}.json"
            gen.write_text(
                json.dumps(
                    {"grid": grid, "clues": [[0, 0]], "minDigit": 1, "digits": 9}
                )
            )
            link, doc, n_clues = build(HERE / "IsofillComponent.js", gen)
            check(link, doc, n_clues)
            p = doc["puzzle"]
            assert (p["width"], p["height"]) == (width, height)
            assert (p["minDigit"], p.get("maxDigit", 9)) == (1, 9), p


if __name__ == "__main__":
    test_a_board_wider_than_nine_builds_with_digits_1_to_9()
    link, doc, n_clues = build(HERE / "IsofillComponent.js", HERE / "gen.json")
    check(link, doc, n_clues)
    assert link == (HERE / "PUZZLE_LINK.txt").read_text().strip(), (
        "the committed component must reproduce PUZZLE_LINK.txt exactly"
    )

    def no_subprocess(*args, **kwargs):
        raise AssertionError(f"build_hard_links spawned a process: {args}")

    subprocess.run = subprocess.Popen = no_subprocess
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        build_hard_links.write_links(tmp)
        for link_name in FIXTURES.values():
            assert (tmp / link_name).read_bytes() == (HERE / link_name).read_bytes(), (
                f"build_hard_links wrote a {link_name} that differs from the committed one"
            )
        assert sorted(p.name for p in tmp.iterdir()) == sorted(FIXTURES.values()), (
            "build_hard_links left extra files behind"
        )

    print("ok")
