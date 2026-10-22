import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import RULE, TIMED_COMPONENT, build, check

if __name__ == "__main__":
    assert not RULE.startswith("Normal sudoku rules apply"), (
        "fillomino rules must not open with the sudoku sentence"
    )

    link, doc, n_clues = build(HERE / f"{TIMED_COMPONENT}.js", HERE / "gen.json")
    check(link, doc, n_clues)
    assert link == (HERE / "PUZZLE_LINK.txt").read_text().strip(), (
        "the committed component must reproduce PUZZLE_LINK.txt exactly"
    )

    rect, rect_doc, rect_clues = build(
        HERE / f"{TIMED_COMPONENT}.js", HERE / "gen_7x5.json"
    )
    check(rect, rect_doc, rect_clues)
    assert rect == (HERE / "PUZZLE_LINK_7x5.txt").read_text().strip(), (
        "the committed component must reproduce PUZZLE_LINK_7x5.txt exactly"
    )

    print("ok")
