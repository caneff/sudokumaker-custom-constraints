# time_example.py: the offline seams — the paste-ready row builder plus its
# PASS/FAIL verdict, and the loud-fail behavior for a missing PUZZLE_LINK.txt
# or build_link.py. Fake medians only; no live browser. The CLI's real run
# against numbered-rooms is a manual check recorded in the PR, not here — see
# docs/real-app-timing.md.
#
#   uv run --with lzstring examples/_shared/time_example.test.py

import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

from time_example import (
    build_candidate,
    build_row,
    find_component_file,
    run,
    ship_verdict,
)


def _doc(names):
    """A minimal decode_puzzle()-shaped doc registering the given component
    names on one constraint."""
    return {
        "puzzle": {
            "constraints": [
                {
                    "definition": {
                        "components": [{"name": n, "code": f"// {n}\n"} for n in names]
                    }
                }
            ]
        }
    }


if __name__ == "__main__":
    # candidate under the 0.9x bar -> PASS
    row, verdict = build_row(
        "2026-08-26", "v2026.08.14-d47fc4b", "numbered-rooms", 1000, 800
    )
    assert verdict == "PASS"
    assert row == (
        "| 2026-08-26 | v2026.08.14-d47fc4b | numbered-rooms | 1000ms | 800ms | 0.80 | PASS |"
    )

    # candidate at exactly the 0.9x bar -> PASS (bar is <=, not <)
    row, verdict = build_row(
        "2026-08-26", "v2026.08.14-d47fc4b", "numbered-rooms", 1000, 900
    )
    assert verdict == "PASS"
    assert "0.90" in row and "PASS" in row

    # candidate over the bar -> FAIL
    row, verdict = build_row(
        "2026-08-26", "v2026.08.14-d47fc4b", "numbered-rooms", 1000, 950
    )
    assert verdict == "FAIL"
    assert row == (
        "| 2026-08-26 | v2026.08.14-d47fc4b | numbered-rooms | 1000ms | 950ms | 0.95 | FAIL |"
    )

    # byte-equal code -> baseline-only row, no candidate/ratio
    row, verdict = build_row(
        "2026-08-26", "v2026.08.14-d47fc4b", "numbered-rooms", 1000
    )
    assert verdict == "BASELINE"
    assert (
        row
        == "| 2026-08-26 | v2026.08.14-d47fc4b | numbered-rooms | 1000ms | — | — | BASELINE |"
    )

    # missing PUZZLE_LINK.txt raises naming the file. Exact-message check,
    # not a substring: decode_puzzle() on a missing file also raises
    # FileNotFoundError mentioning the path, so a substring check would still
    # pass with the driver's own guard deleted -- a hollow witness.
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "no-baseline"
        example_dir.mkdir()
        (example_dir / "build_link.py").write_text("# stub\n")
        try:
            run(example_dir)
            raise AssertionError("expected a missing-PUZZLE_LINK.txt failure")
        except FileNotFoundError as e:
            assert str(e) == f"missing {example_dir / 'PUZZLE_LINK.txt'}"

    # missing build_link.py raises naming the file
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "no-builder"
        example_dir.mkdir()
        (example_dir / "PUZZLE_LINK.txt").write_text("stub\n")
        try:
            run(example_dir)
            raise AssertionError("expected a missing-build_link.py failure")
        except FileNotFoundError as e:
            assert str(e) == f"missing {example_dir / 'build_link.py'}"

    # board= names a different board file; the default PUZZLE_LINK.txt is not
    # consulted -- the missing-file error names the requested board, not the
    # default
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "other-board"
        example_dir.mkdir()
        (example_dir / "build_link.py").write_text("# stub\n")
        (example_dir / "PUZZLE_LINK.txt").write_text("stub\n")  # present, but unused
        try:
            run(example_dir, board="PUZZLE_LINK_timing.txt")
            raise AssertionError("expected a missing-timing-board failure")
        except FileNotFoundError as e:
            assert str(e) == f"missing {example_dir / 'PUZZLE_LINK_timing.txt'}"

    # board= against an example whose build_link.py has no --board flag fails
    # loud, naming the example, before any link is built
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "no-board-flag"
        example_dir.mkdir()
        (example_dir / "build_link.py").write_text("# stub, no board flag\n")
        try:
            build_candidate(
                example_dir, example_dir / "X.js", example_dir / "out", board="B.txt"
            )
            raise AssertionError("expected a no---board failure")
        except SystemExit as e:
            assert str(e) == "no-board-flag/build_link.py has no --board flag"

    # TIMED_COMPONENT declared -> returns that file, ignoring any other
    # matching .js file that happens to sit alongside it
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "declared"
        example_dir.mkdir()
        (example_dir / "build_link.py").write_text(
            'CONSTRAINT_NAME = "Widget Lines"\nTIMED_COMPONENT = "WidgetComponent"\n'
        )
        (example_dir / "WidgetComponent.js").write_text("// widget\n")
        (example_dir / "WidgetPairComponent.js").write_text("// pair\n")
        doc = _doc(["WidgetComponent", "WidgetPairComponent"])
        result = find_component_file(example_dir, doc)
        assert result == example_dir / "WidgetComponent.js"

    # TIMED_COMPONENT declared but no working-tree file for it -> loud
    # FileNotFoundError, even though another registered component's file
    # sits right there
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "declared-missing-file"
        example_dir.mkdir()
        (example_dir / "build_link.py").write_text(
            'TIMED_COMPONENT = "WidgetComponent"\n'
        )
        (example_dir / "WidgetPairComponent.js").write_text("// pair\n")
        doc = _doc(["WidgetComponent", "WidgetPairComponent"])
        try:
            find_component_file(example_dir, doc)
            raise AssertionError("expected a missing-component-file failure")
        except FileNotFoundError:
            pass

    # TIMED_COMPONENT declared but not a registered component -> loud
    # ValueError
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "declared-unregistered"
        example_dir.mkdir()
        (example_dir / "build_link.py").write_text(
            'TIMED_COMPONENT = "GadgetComponent"\n'
        )
        (example_dir / "GadgetComponent.js").write_text("// gadget\n")
        doc = _doc(["WidgetComponent"])
        try:
            find_component_file(example_dir, doc)
            raise AssertionError("expected an unregistered-component failure")
        except ValueError:
            pass

    # no TIMED_COMPONENT, single working-tree match -> unchanged behaviour
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "undeclared-single"
        example_dir.mkdir()
        (example_dir / "build_link.py").write_text('CONSTRAINT_NAME = "Widget"\n')
        (example_dir / "WidgetComponent.js").write_text("// widget\n")
        doc = _doc(["WidgetComponent"])
        result = find_component_file(example_dir, doc)
        assert result == example_dir / "WidgetComponent.js"

    # no TIMED_COMPONENT, several working-tree matches -> unchanged
    # fail-loud behaviour (this is the case the issue is about: an
    # undeclared multi-component example must still fail loud)
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "undeclared-multi"
        example_dir.mkdir()
        (example_dir / "build_link.py").write_text('CONSTRAINT_NAME = "Widget"\n')
        (example_dir / "WidgetComponent.js").write_text("// widget\n")
        (example_dir / "WidgetPairComponent.js").write_text("// pair\n")
        doc = _doc(["WidgetComponent", "WidgetPairComponent"])
        try:
            find_component_file(example_dir, doc)
            raise AssertionError("expected an ambiguous-match failure")
        except ValueError:
            pass

    # The two-row ship rule: a change ships when it clears 0.9x on one of the
    # two rows (cold, after-logical) and does not regress past 1.1x on the
    # other. Order of the rows does not matter.
    assert ship_verdict([0.72, 1.05]) == "SHIP"
    assert ship_verdict([1.05, 0.72]) == "SHIP"

    # both bars are inclusive
    assert ship_verdict([0.90, 1.10]) == "SHIP"

    # cleared 0.9x on one row but regressed past 1.1x on the other -> no ship
    assert ship_verdict([0.72, 1.15]) == "NO SHIP"

    # neither row clears 0.9x -> no ship, however flat the other row is
    assert ship_verdict([0.95, 0.95]) == "NO SHIP"

    # a row the app solved in 0ms places no constraint: it cannot be the row
    # that clears 0.9x, and it cannot regress. The other row decides.
    assert ship_verdict([0.72, None]) == "SHIP"
    assert ship_verdict([0.95, None]) == "NO SHIP"
    assert ship_verdict([None, None]) == "NO TIME"

    # a 0ms baseline has no ratio -- the app's logical pass finished the board,
    # so there is nothing left to time. Report it, never divide by zero.
    row, verdict = build_row(
        "2026-08-26", "v2026.08.14-d47fc4b", "isofill after-logical", 0, 0
    )
    assert verdict == "NO TIME"
    assert row == (
        "| 2026-08-26 | v2026.08.14-d47fc4b | isofill after-logical | 0ms | 0ms | — | NO TIME |"
    )

    print("ok")
