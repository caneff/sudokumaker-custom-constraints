"""One end-to-end test for spec #898: the example builders and shipped
components after the 2026-11-06 audit sweep (slices #916-#920).

Driven here on the real tree, in the order the spec states its decisions:

  1. the testing decision: every link the spec rebuilt or kept rebuilds byte
     for byte (each touched builder's own test, run as is), and the layout
     gate finds no stale backend in any committed link;
  2. the count-digits builders share one retry loop (ARCH-3) and one counter
     pick (DUP-1): `board_kit.draw_groups` raises at its cap, and no builder
     raises its own "only drew";
  3. isofill says visit marks (DOM-1): `stamp` is left only in the include of
     `_shared/stamp.js`;
  4. fillomino says region and pocket rule (DOM-2, DOM-3);
  5. hunt_link.py reads every fixture in one process (ARCH-10);
  6. fillomino's and isofill's digit range is the board model's (DUP-4);
  7. the dutch-flatmates comment and its read counter (Q4 a, TEST-13);
  8. the RequiredDigits wrapper test runs in the gate (Q1).

WHAT A GREEN RUN DOES NOT COVER (this seam, `just check-full`, is blind to it):
  - the app: whether the regenerated isofill, isofill-skyscraper and
    dutch-flatmates annotated links open, render and solve in sudokumaker.app,
    and solve time (`just time isofill`, `just time isofill-skyscraper`).
  - the refusal tests TEST-7 tightened: each one's mutation is recorded on its
    slice's PR, not repeated here.

    uv run examples/_shared/spec_898_closing.test.py
"""

import json
import pathlib
import re
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
EXAMPLES = HERE.parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(EXAMPLES / "count-digits-gac"))

import check_layout
from board_kit import draw_groups
from gate_lib import runner_listing

BUILDER_TESTS = [
    "count-digits-gac/build_count_digits_demo.test.py",
    "count-digits-gac/build_count_digits_selfcount.test.py",
    "count-digits-gac/build_sparse_count_digits.test.py",
    "count-digits-gac/build_sparse_required_digits.test.py",
    "dutch-flatmates/build_link.test.py",
    "fillomino/build_link.test.py",
    "isofill/build_link.test.py",
]


def run(*args):
    done = subprocess.run(args, capture_output=True, text=True, timeout=600)
    assert done.returncode == 0, (args, done.stdout + done.stderr)
    return done.stdout


def links_rebuild_and_none_is_stale():
    for test in BUILDER_TESTS:
        run(sys.executable, str(EXAMPLES / test))
    violations = check_layout.check_tree(EXAMPLES)
    assert violations == [], violations


def the_count_digits_builders_share_one_loop():
    try:
        draw_groups(2, lambda taken, index: None, lambda g: set(), 5)
    except RuntimeError as e:
        assert str(e) == "only drew 0 of 2 groups", e
    else:
        raise AssertionError("draw_groups must raise at its cap")
    builders = sorted((EXAMPLES / "count-digits-gac").glob("build_*.py"))
    builders = [p for p in builders if ".test." not in p.name]
    own_loop = [p.name for p in builders if "only drew" in p.read_text()]
    assert not own_loop, own_loop
    pickers = [p.name for p in builders if "finish_group" in p.read_text()]
    assert pickers == ["build_count_digits_demo.py", "build_sparse_count_digits.py"], (
        pickers
    )


def isofill_says_visit_marks():
    for name in (
        "isofill/IsofillComponent.js",
        "isofill/pooling.test.mjs",
        "count-digits-gac/required-digits-soundness.mjs",
    ):
        lines = (EXAMPLES / name).read_text().splitlines()
        hits = [line for line in lines if "stamp" in line.lower()]
        allowed = ["// #include ../_shared/stamp.js"]
        assert hits == (allowed if name.endswith(".js") else []), (name, hits)


def fillomino_says_region_and_pocket_rule():
    generate = (EXAMPLES / "fillomino" / "generate.py").read_text()
    assert not re.search(r"\bblob\b", generate)
    for path in (EXAMPLES / "fillomino").glob("*.mjs"):
        assert "component bound" not in path.read_text().lower(), path.name


def hunt_link_reads_every_fixture_at_once():
    fixtures = sorted((EXAMPLES / "fillomino").glob("timing-fixture-*-rung25.txt"))
    assert len(fixtures) == 19, len(fixtures)
    read = json.loads(
        run(
            sys.executable,
            str(EXAMPLES / "fillomino" / "hunt_link.py"),
            *map(str, fixtures),
        )
    )
    assert sorted(read) == sorted(map(str, fixtures))
    assert all(board["givens"] for board in read.values())


def the_digit_range_is_the_board_models():
    sys.path.insert(0, str(EXAMPLES / "fillomino"))
    import build_link as fillomino

    sys.path.remove(str(EXAMPLES / "fillomino"))
    del sys.modules["build_link"]
    tall = {"grid": [[0] * 3 for _ in range(5)]}
    assert fillomino.digit_range(tall, 3)[1] == 5
    sys.path.insert(0, str(EXAMPLES / "isofill"))
    import build_link as isofill
    from isofill_model import Board

    gens = sorted((EXAMPLES / "isofill").glob("gen*.json"))
    assert gens, "no isofill gen*.json matched: the digit-range loop checked nothing"
    for gen in gens:
        spec = json.loads(gen.read_text())
        board = Board.of_doc(spec)
        lo, hi, _ = isofill.digit_range(spec, len(spec["grid"][0]))
        assert (lo, hi) == (board.lo, board.lo + board.digits - 1), gen.name


def the_dutch_flatmates_comment_and_counter():
    main = (EXAMPLES / "dutch-flatmates" / "main.js").read_text()
    assert "only make sense on a square grid" not in main
    test = (EXAMPLES / "dutch-flatmates" / "build_link.test.py").read_text()
    assert "counting_read_text" not in test


def the_wrapper_test_runs_in_the_gate():
    moved = EXAMPLES / "count-digits-gac" / "required-digits-wrapper.test.mjs"
    assert moved.exists()
    assert "node examples/count-digits-gac/required-digits-wrapper.test.mjs" in (
        runner_listing()
    )
    assert (
        "required-digits-wrapper.test.mjs"
        in (EXAMPLES / "count-digits-gac" / "BUILD").read_text()
    )
    run("node", str(moved))


if __name__ == "__main__":
    links_rebuild_and_none_is_stale()
    the_count_digits_builders_share_one_loop()
    isofill_says_visit_marks()
    fillomino_says_region_and_pocket_rule()
    hunt_link_reads_every_fixture_at_once()
    the_digit_range_is_the_board_models()
    the_dutch_flatmates_comment_and_counter()
    the_wrapper_test_runs_in_the_gate()
    print("spec #898 closing check: ok")
