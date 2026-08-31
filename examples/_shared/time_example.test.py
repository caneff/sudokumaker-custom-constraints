# time_example.py: the offline seams — the paste-ready row builder plus its
# PASS/FAIL verdict, and the loud-fail behavior for a missing PUZZLE_LINK.txt
# or build_link.py. Fake medians only; no live browser. The CLI's real run
# against numbered-rooms is a manual check recorded in the PR, not here — see
# docs/real-app-timing.md.
#
#   uv run --with lzstring examples/_shared/time_example.test.py

import pathlib
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

from link_codec import decode_puzzle, encode_link
from minify import minify_js
from time_example import (
    build_candidate,
    build_candidate_doc,
    build_row,
    find_component_file,
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
    encode_link/decode_puzzle the way a build_link.py stub needs."""
    return {
        "puzzle": {
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
            ]
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

    print("ok")
