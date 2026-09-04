# time_example.py: the offline seams — the paste-ready row builder plus its
# PASS/FAIL verdict, the loud-fail behavior for a missing PUZZLE_LINK.txt or
# build_link.py, and run()'s own orchestration with the browser call faked out
# (time_example.run_app_solve reassigned to a canned-median stub, which is the
# only thing in run() that needs the live site). Fake medians only; no live
# browser. The CLI's real run against numbered-rooms is a manual check
# recorded in the PR, not here — see docs/real-app-timing.md.
#
#   uv run --with lzstring examples/_shared/time_example.test.py

import contextlib
import pathlib
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

import time_example
from link_codec import decode_puzzle, encode_link
from minify import minify_js
from time_example import (
    build_candidate,
    build_candidate_doc,
    build_row,
    find_component_file,
    parse_app_solve_output,
    row_ratio,
    run,
    ship_verdict,
)

STUB_BUILD_LINK_PY = f"""\
import argparse
import pathlib
import sys

sys.path.insert(0, {str(HERE)!r})
from link_codec import decode_puzzle
from link_swap import check_and_write, swap_component_code
from minify import minify_js

HERE = pathlib.Path(__file__).parent
CONSTRAINT_NAME = "Widget Lines"


def build(component_path, out_path, board=None):
    component_path = pathlib.Path(component_path)
    board_path = pathlib.Path(board) if board else HERE / "PUZZLE_LINK.txt"
    code = minify_js(component_path.read_text())
    base = decode_puzzle(board_path.read_text().strip())
    doc = swap_component_code(base, CONSTRAINT_NAME, component_path.stem, code)
    return check_and_write(base, doc, CONSTRAINT_NAME, out_path)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--component", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--board")
    a = p.parse_args()
    build(a.component, a.out, board=a.board)
"""


def _widget_doc(backend_code, component_code):
    """A minimal decode_puzzle()-shaped doc: one constraint ("Widget Lines")
    with a code backend and one component, real enough to round-trip through
    encode_link/decode_puzzle the way a build_link.py stub needs.

    It carries a 4x4 board too -- one ring clue, one interior given, one
    entered interior digit -- because the timing driver strips a link to its
    givens before probing it (probe_link.py), and a doc with no `cells` never
    reaches that step.
    """
    cells = [{} for _ in range(16)]
    cells[1] = {"value": 3}  # a ring clue: kept by `empty`, cleared by `strip`
    cells[5] = {"value": 1, "given": True}  # an interior given: always kept
    cells[6] = {"value": 4}  # an entered interior digit: always cleared
    return {
        "puzzle": {
            "width": 4,
            "height": 4,
            "cells": cells,
            "constraints": [
                {
                    "definition": {
                        "name": "Widget Lines",
                        "backend": {"type": "code", "code": backend_code},
                        "components": [
                            {
                                "type": "code",
                                "name": "WidgetComponent",
                                "code": component_code,
                            }
                        ],
                    }
                }
            ],
        }
    }


def _git_commit_all(example_dir):
    """Commit every file in example_dir as its own tiny repo -- resolve_backend_file
    reads a backend file's *last-committed* content (git HEAD), so a fixture
    needs real git history: a plain temp file has none, and a working-tree
    edit made after this call is exactly what a test then exercises."""
    subprocess.run(["git", "init", "-q"], cwd=example_dir, check=True)
    subprocess.run(["git", "add", "-A"], cwd=example_dir, check=True)
    subprocess.run(
        [
            "git",
            "-c",
            "user.email=t@t",
            "-c",
            "user.name=t",
            "commit",
            "-q",
            "-m",
            "init",
        ],
        cwd=example_dir,
        check=True,
    )


def _make_widget_example(
    example_dir, backend_src, component_src, backend_file="main.js", extra_files=None
):
    """A working example_dir for build_candidate_doc: PUZZLE_LINK.txt built
    from _widget_doc's minified backend/component, a build_link.py stub that
    swaps only the component (mirrors skyscraper/hit-counts/running-start --
    never the backend), a WidgetComponent.js source file, and backend_file
    ("main.js" or "main-global.js") holding the backend source. extra_files
    adds further committed files -- the other lane's file, for the
    local/global duality cases. Everything is committed, so a caller's
    later edit is a real working-tree change against git HEAD."""
    example_dir.mkdir()
    base_doc = _widget_doc(minify_js(backend_src), minify_js(component_src))
    (example_dir / "PUZZLE_LINK.txt").write_text(encode_link(base_doc) + "\n")
    (example_dir / "build_link.py").write_text(STUB_BUILD_LINK_PY)
    (example_dir / "WidgetComponent.js").write_text(component_src)
    (example_dir / backend_file).write_text(backend_src)
    for name, content in (extra_files or {}).items():
        (example_dir / name).write_text(content)
    _git_commit_all(example_dir)
    return base_doc


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

    # --component overrides TIMED_COMPONENT: an example whose declared
    # component is not the one a given board registers names the other one on
    # the command line. Skyscraper's local board runs the one-sided line
    # component while TIMED_COMPONENT names the two-clue DP.
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "overridden"
        example_dir.mkdir()
        (example_dir / "build_link.py").write_text(
            'TIMED_COMPONENT = "WidgetComponent"\n'
        )
        (example_dir / "WidgetComponent.js").write_text("// widget\n")
        (example_dir / "WidgetPairComponent.js").write_text("// pair\n")
        doc = _doc(["WidgetComponent", "WidgetPairComponent"])
        result = find_component_file(example_dir, doc, component="WidgetPairComponent")
        assert result == example_dir / "WidgetPairComponent.js"

    # --component naming something the board does not register -> loud
    # ValueError, the same check the declared constant gets
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "override-unregistered"
        example_dir.mkdir()
        (example_dir / "build_link.py").write_text('CONSTRAINT_NAME = "Widget"\n')
        (example_dir / "GadgetComponent.js").write_text("// gadget\n")
        doc = _doc(["WidgetComponent"])
        try:
            find_component_file(example_dir, doc, component="GadgetComponent")
            raise AssertionError("expected an unregistered-component failure")
        except ValueError:
            pass

    # --component with no working-tree file -> loud FileNotFoundError
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "override-missing-file"
        example_dir.mkdir()
        (example_dir / "build_link.py").write_text('CONSTRAINT_NAME = "Widget"\n')
        doc = _doc(["WidgetComponent"])
        try:
            find_component_file(example_dir, doc, component="WidgetComponent")
            raise AssertionError("expected a missing-component-file failure")
        except FileNotFoundError:
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

    # a row where BOTH sides read 0ms places no constraint: the app's logical
    # pass finished the board, so nothing was timed. The other row decides.
    assert ship_verdict([0.72, None]) == "SHIP"
    assert ship_verdict([0.95, None]) == "NO SHIP"
    assert ship_verdict([None, None]) == "NO TIME"

    # a 0ms baseline the candidate does NOT match is the regression this row
    # exists to catch -- five of six ISOFILL fixtures sit at 0ms after-logical,
    # so 0ms -> slow is the common way to break one. It must never ship, however
    # well the other row reads.
    assert ship_verdict([0.72, float("inf")]) == "NO SHIP"

    # a 0ms baseline has no ratio. Report it, never divide by zero.
    row, verdict = build_row(
        "2026-08-26", "v2026.08.14-d47fc4b", "isofill after-logical", 0, 0
    )
    assert verdict == "NO TIME"
    assert row == (
        "| 2026-08-26 | v2026.08.14-d47fc4b | isofill after-logical | 0ms | 0ms | — | NO TIME |"
    )

    # 0ms baseline, candidate slower: a FAIL row with an infinite ratio, not a
    # NO TIME row that quietly excuses it
    row, verdict = build_row(
        "2026-08-26", "v2026.08.14-d47fc4b", "isofill after-logical", 0, 5000
    )
    assert verdict == "FAIL"
    assert row == (
        "| 2026-08-26 | v2026.08.14-d47fc4b | isofill after-logical | 0ms | 5000ms | ∞ | FAIL |"
    )

    # the ratio the driver hands ship_verdict for each of those two cases
    assert row_ratio(0, 0) is None
    assert row_ratio(0, 5000) == float("inf")
    assert row_ratio(1000, 800) == 0.8

    # #151: build_candidate_doc's byte-equal decision must cover the
    # constraint's backend, not only registered component code --
    # build_link.py stubs here mirror skyscraper/hit-counts/running-start,
    # which never touch the backend on a --component swap. Assertions read
    # the written candidate_link, the file `just time` actually probes and
    # times, not a value the function merely returns internally.

    # main.js-only change, component untouched -> not byte-equal, and the
    # written candidate carries the working-tree backend, not the committed one
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "backend-changed"
        base_doc = _make_widget_example(
            example_dir, "console.log('old')\n", "function update(){return 1}\n"
        )
        candidate_link = pathlib.Path(tmp) / "candidate.txt"
        component_file = example_dir / "WidgetComponent.js"
        (example_dir / "main.js").write_text("console.log('new')\n")
        byte_equal = build_candidate_doc(
            example_dir, component_file, candidate_link, base_doc
        )
        assert not byte_equal, "a main.js-only change must not read byte-equal"
        candidate_doc = decode_puzzle(candidate_link.read_text().strip())
        got_backend = candidate_doc["puzzle"]["constraints"][0]["definition"][
            "backend"
        ]["code"]
        assert "new" in got_backend and "old" not in got_backend

    # truly byte-equal working tree (backend and component both match what
    # is already committed) -> byte_equal stays True
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "unchanged"
        base_doc = _make_widget_example(
            example_dir, "console.log('same')\n", "function update(){return 1}\n"
        )
        candidate_link = pathlib.Path(tmp) / "candidate.txt"
        component_file = example_dir / "WidgetComponent.js"
        byte_equal = build_candidate_doc(
            example_dir, component_file, candidate_link, base_doc
        )
        assert byte_equal, "an unchanged working tree must still read byte-equal"

    # component-only change, backend unchanged -> unchanged behaviour: not
    # byte-equal, backend stays the committed one
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "component-changed"
        base_doc = _make_widget_example(
            example_dir, "console.log('same')\n", "function update(){return 1}\n"
        )
        candidate_link = pathlib.Path(tmp) / "candidate.txt"
        component_file = example_dir / "WidgetComponent.js"
        component_file.write_text("function update(){return 2}\n")
        byte_equal = build_candidate_doc(
            example_dir, component_file, candidate_link, base_doc
        )
        assert not byte_equal, "a component-only change must not read byte-equal"
        candidate_doc = decode_puzzle(candidate_link.read_text().strip())
        got_backend = candidate_doc["puzzle"]["constraints"][0]["definition"][
            "backend"
        ]["code"]
        assert "same" in got_backend

    # local/global duality (docs/example-layout.md): a board whose committed
    # backend is main-global.js, with an untouched main.js sitting alongside
    # it (the file the board does NOT ship) -- editing the unused lane must
    # not register as a change. This is the #151 follow-up bug: naively
    # always overlaying main.js would silently swap in the wrong lane here.
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "global-lane-untouched"
        base_doc = _make_widget_example(
            example_dir,
            "console.log('global backend')\n",
            "function update(){return 1}\n",
            backend_file="main-global.js",
            extra_files={"main.js": "console.log('local backend, unused')\n"},
        )
        candidate_link = pathlib.Path(tmp) / "candidate.txt"
        component_file = example_dir / "WidgetComponent.js"
        (example_dir / "main.js").write_text("console.log('edited, but not shipped')\n")
        byte_equal = build_candidate_doc(
            example_dir, component_file, candidate_link, base_doc
        )
        assert byte_equal, (
            "editing the lane the board does not ship must not register as a change"
        )

    # same duality fixture, but the lane the board DOES ship (main-global.js)
    # is the one edited -> detected, and the written candidate carries it
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "global-lane-changed"
        base_doc = _make_widget_example(
            example_dir,
            "console.log('global backend')\n",
            "function update(){return 1}\n",
            backend_file="main-global.js",
            extra_files={"main.js": "console.log('local backend, unused')\n"},
        )
        candidate_link = pathlib.Path(tmp) / "candidate.txt"
        component_file = example_dir / "WidgetComponent.js"
        (example_dir / "main-global.js").write_text(
            "console.log('changed global backend')\n"
        )
        byte_equal = build_candidate_doc(
            example_dir, component_file, candidate_link, base_doc
        )
        assert not byte_equal, "editing the shipped lane must register as a change"
        candidate_doc = decode_puzzle(candidate_link.read_text().strip())
        got_backend = candidate_doc["puzzle"]["constraints"][0]["definition"][
            "backend"
        ]["code"]
        assert "changed" in got_backend

    # neither backend file's committed content matches the committed link's
    # backend -> loud ValueError, never a silent guess
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "mismatched-backend"
        example_dir.mkdir()
        base_doc = _widget_doc(
            "SOMETHING NEITHER FILE HAS",
            minify_js("function update(){return 1}\n"),
        )
        (example_dir / "PUZZLE_LINK.txt").write_text(encode_link(base_doc) + "\n")
        (example_dir / "build_link.py").write_text(STUB_BUILD_LINK_PY)
        (example_dir / "WidgetComponent.js").write_text("function update(){return 1}\n")
        (example_dir / "main.js").write_text("console.log('does not match')\n")
        _git_commit_all(example_dir)
        candidate_link = pathlib.Path(tmp) / "candidate.txt"
        component_file = example_dir / "WidgetComponent.js"
        try:
            build_candidate_doc(example_dir, component_file, candidate_link, base_doc)
            raise AssertionError("expected a no-backend-match failure")
        except ValueError:
            pass

    # all reps timed out: the failure names the fixed 300s per-rep timeout
    # and the rep counts
    stdout = (
        "some app-solve.mjs log lines\n"
        'JSON: {"median": null, "version": "v2026.08.14-d47fc4b", '
        '"repsRun": 3, "repsTimedOut": 3}\n'
    )
    try:
        parse_app_solve_output("PUZZLE_LINK_local.txt", stdout)
        raise AssertionError("expected an all-reps-timed-out failure")
    except RuntimeError as e:
        assert str(e) == (
            "app-solve.mjs: PUZZLE_LINK_local.txt: all 3 reps hit the 300s "
            "per-rep timeout (3 timed out)"
        )

    # mixed outcome (median present) still returns the data -- unaffected
    stdout = (
        'JSON: {"median": 220, "version": "v2026.08.14-d47fc4b", '
        '"repsRun": 3, "repsTimedOut": 1}\n'
    )
    data = parse_app_solve_output("PUZZLE_LINK.txt", stdout)
    assert data["median"] == 220
    assert data["repsTimedOut"] == 1

    # no JSON line at all -- unchanged loud failure
    try:
        parse_app_solve_output("PUZZLE_LINK.txt", "no json here\n")
        raise AssertionError("expected a no-JSON-line failure")
    except RuntimeError as e:
        assert "printed no JSON line" in str(e)

    # unreadable app version -- unchanged loud failure
    stdout = 'JSON: {"median": 100, "version": null, "repsRun": 3, "repsTimedOut": 0}\n'
    try:
        parse_app_solve_output("PUZZLE_LINK.txt", stdout)
        raise AssertionError("expected a could-not-read-version failure")
    except RuntimeError as e:
        assert "could not read the app version" in str(e)

    # ---- run()'s success path, with the one live-app call faked out.
    # `fake_solve` records how it was called, so these cases assert on the
    # driver arguments run() derives (which link, ring-clues, after-logical)
    # as well as on the rows it builds from the medians it gets back.
    @contextlib.contextmanager
    def fake_solve(medians):
        """Replace run_app_solve with a stub returning `medians` in order.
        Yields the list of (link_name, ring_clues, after_logical) calls."""
        calls = []
        real = time_example.run_app_solve
        pending = list(medians)

        def stub(link_path, ring_clues=False, after_logical=False):
            calls.append((pathlib.Path(link_path).name, ring_clues, after_logical))
            return {"median": pending.pop(0), "version": "v2026.08.14-d47fc4b"}

        time_example.run_app_solve = stub
        try:
            yield calls
        finally:
            time_example.run_app_solve = real

    # a component edit that halves the solve time: two rows (cold, then
    # after-logical), both PASS, and the two-row rule ships it
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "faster"
        _make_widget_example(
            example_dir, "console.log('same')\n", "function update(){return 1}\n"
        )
        (example_dir / "WidgetComponent.js").write_text("function update(){return 2}\n")
        with fake_solve([1000, 500, 800, 400]) as calls:
            rows, ship = run(example_dir)
        assert [r[1] for r in rows] == ["PASS", "PASS"]
        assert ship == "SHIP"
        assert "| widget-faster |" not in rows[0][0]
        assert rows[0][0].endswith("| 1000ms | 500ms | 0.50 | PASS |")
        assert "faster after-logical" in rows[1][0], "the second row is the logical one"
        # baseline and candidate are timed against separate links, cold first
        # then after-logical, and neither run asks for the ring
        assert calls == [
            ("baseline_probe.txt", False, False),
            ("candidate_probe.txt", False, False),
            ("baseline_probe.txt", False, True),
            ("candidate_probe.txt", False, True),
        ]

    # a slower candidate: 1.0x on the cold row is inside 1.1x but never
    # reaches 0.9x, so the two-row rule refuses it
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "slower"
        _make_widget_example(
            example_dir, "console.log('same')\n", "function update(){return 1}\n"
        )
        (example_dir / "WidgetComponent.js").write_text("function update(){return 2}\n")
        with fake_solve([1000, 1000, 1000, 1500]):
            rows, ship = run(example_dir)
        assert [r[1] for r in rows] == ["FAIL", "FAIL"]
        assert ship == "NO SHIP"

    # a byte-equal working tree has no candidate to judge: baseline-only rows
    # and no verdict, and the driver is never asked to time a candidate link
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "unchanged"
        _make_widget_example(
            example_dir, "console.log('same')\n", "function update(){return 1}\n"
        )
        with fake_solve([1000, 900]) as calls:
            rows, ship = run(example_dir)
        assert [r[1] for r in rows] == ["BASELINE", "BASELINE"]
        assert ship is None, "nothing to judge means no ship verdict"
        assert [c[0] for c in calls] == ["baseline_probe.txt"] * 2

    # ring_clues reaches the driver, and board= names the row's board label
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = pathlib.Path(tmp) / "ringed"
        base_doc = _make_widget_example(
            example_dir, "console.log('same')\n", "function update(){return 1}\n"
        )
        (example_dir / "PUZZLE_LINK_alt.txt").write_text(encode_link(base_doc) + "\n")
        _git_commit_all(example_dir)
        with fake_solve([1000, 900]) as calls:
            rows, _ship = run(example_dir, ring_clues=True, board="PUZZLE_LINK_alt.txt")
        assert all(ring for _name, ring, _al in calls), (
            "ring_clues must reach the driver"
        )
        assert "ringed (PUZZLE_LINK_alt.txt)" in rows[0][0]

    print("ok")
