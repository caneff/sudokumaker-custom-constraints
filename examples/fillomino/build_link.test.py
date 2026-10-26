import pathlib
import re
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import CONSTRAINT_NAME, RULE, TIMED_COMPONENT, build, check
from minify import minify_js
from sm_document import find_constraint

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
        HERE / f"{TIMED_COMPONENT}.js", HERE / "gen_15g.json"
    )
    check(rect, rect_doc, rect_clues)
    assert rect == (HERE / "PUZZLE_LINK_15g.txt").read_text().strip(), (
        "the committed component must reproduce PUZZLE_LINK_15g.txt exactly"
    )

    # The annotated twin: the shipped board and givens, with the embedded code's
    # comments kept for a reader in the app's own code box.
    ann, ann_doc, ann_clues = build(
        HERE / f"{TIMED_COMPONENT}.js", HERE / "gen.json", keep_comments=True
    )
    check(ann, ann_doc, ann_clues)
    assert ann == (HERE / "PUZZLE_LINK_annotated.txt").read_text().strip(), (
        "PUZZLE_LINK_annotated.txt is not what build_link.py --keep-comments writes"
    )
    plain = find_constraint(doc, CONSTRAINT_NAME)["definition"]
    kept = find_constraint(ann_doc, CONSTRAINT_NAME)["definition"]
    assert {**ann_doc["puzzle"], "constraints": None} == {
        **doc["puzzle"],
        "constraints": None,
    }, "the annotated link must carry the shipped board and givens"
    codes = {"main": kept["backend"]["code"]}
    codes.update({c["name"]: c["code"] for c in kept["components"]})
    plain_codes = {"main": plain["backend"]["code"]}
    plain_codes.update({c["name"]: c["code"] for c in plain["components"]})
    for name, code in codes.items():
        assert minify_js(code) == plain_codes[name], (
            f"{name}: the annotated code differs from the shipped code"
        )
        assert code.startswith("// "), f"{name}: the annotated link lost its header"
        # a reader of the pasted code cannot open a repo file or a ticket, has
        # no use for a lint directive, and has never met this repo's words
        assert "eslint" not in code, f"{name}: a lint directive reached the link"
        assert not re.search(r"#\d", code), f"{name}: annotated code names a ticket"
        assert "//!" not in code, f"{name}: annotated code keeps a repo comment marker"
        for jargon in (
            ".js",
            "isofill",
            "door",
            "starve",
            "seal",
            "stamp",
            "dominat",
            "rung",
        ):
            assert jargon not in code.lower(), (
                f"{name}: annotated code names {jargon!r}"
            )
    component = codes[TIMED_COMPONENT]
    for word in ("ISLAND", "REGION"):
        assert component.count(f"  {word}  ") == 1, f"{word} is not defined once"
    print("ok")
