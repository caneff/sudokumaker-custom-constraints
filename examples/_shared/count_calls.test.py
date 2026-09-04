# count_calls.py: the two pure seams -- splicing the call counter into a
# component's `update`, and turning the driver's stdout into the one report
# line -- plus main()'s orchestration, run against stubbed `build_candidate`,
# `empty_link_file` and `subprocess.run`. Only a real Chromium against the
# live sudokumaker.app is out of reach here; every decision main() makes
# about what to build and what argv to hand the driver is not.
#
#   uv run --with lzstring examples/_shared/count_calls.test.py

import contextlib
import pathlib
import subprocess
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import count_calls
from count_calls import COUNTER, HOOK, main, probe_source, summarize

WIDGET = f"class Widget {{\n  {HOOK}\n    yield 1\n  }}\n}}\n"


@contextlib.contextmanager
def _stubbed(stdout, returncode=0):
    """Replace main's three impure dependencies and record how it called them.

    Yields a dict with the `build_candidate` and `empty_link_file` argument
    tuples and the `node` argv, so a case can assert on what main decided
    rather than on a browser it cannot run. `build_candidate` writes the file
    main hands it, because main goes on to read that path.
    """
    real = (
        count_calls.build_candidate,
        count_calls.empty_link_file,
        count_calls.subprocess.run,
    )
    seen = {}

    def fake_build(example_dir, probe, link, board=None):
        seen["build"] = (example_dir, pathlib.Path(probe).read_text(), board)
        pathlib.Path(link).write_text("LINK")

    def fake_empty(src, out, mode):
        seen["empty"] = (pathlib.Path(src).read_text(), mode)
        pathlib.Path(out).write_text("EMPTIED")

    def fake_run(cmd, **kwargs):
        seen["cmd"] = list(cmd)
        return subprocess.CompletedProcess(cmd, returncode, stdout, "")

    count_calls.build_candidate = fake_build
    count_calls.empty_link_file = fake_empty
    count_calls.subprocess.run = fake_run
    try:
        yield seen
    finally:
        (
            count_calls.build_candidate,
            count_calls.empty_link_file,
            count_calls.subprocess.run,
        ) = real


if __name__ == "__main__":
    # the hook lands once, keeps the original body, and the counter it splices
    # in still opens the same generator the app calls
    src = f"class Foo {{\n  {HOOK}\n    yield 1\n  }}\n}}\n"
    hooked = probe_source(src)
    assert COUNTER in hooked
    assert "yield 1" in hooked
    assert hooked.count(HOOK) == 1, "the counter must not double the signature"

    # only the first `update` is hooked: a component with two generators still
    # reports one series, not two interleaved counts
    two = src + src
    assert probe_source(two).count("_probeCalls = 0") == 1

    # a renamed or reformatted signature fails loud rather than timing an
    # unhooked component and reporting nothing
    try:
        probe_source("function* update (instance, puzzle) {}\n")
        raise AssertionError("expected a failure for an unhookable source")
    except ValueError as e:
        assert "hook" in str(e), e

    # one line per `[probe] <name>=` series, each at its own last mark, with
    # the driver's last median line appended
    stdout = "\n".join(
        [
            "starting",
            "[probe] calls=500",
            "[probe] calls=1000",
            "[probe] pair=500",
            "median 1200ms",
            "median 900ms",
        ]
    )
    line = summarize(stdout, "WidgetComponent.js")
    assert line.startswith("WidgetComponent.js: ")
    assert "[probe] calls=1000" in line, "a series must report its LAST mark"
    assert "[probe] calls=500" not in line, "an earlier mark must not be reported"
    assert "[probe] pair=500" in line, "every series must be reported"
    assert "median 900ms" in line, "the report carries the driver's last median"

    # --board names the link timed, so the report says which board it was
    assert " on PUZZLE_LINK_28g.txt: " in summarize(
        stdout, "WidgetComponent.js", "PUZZLE_LINK_28g.txt"
    )

    # a run that logged no [probe] line at all is a failure, not a zero count
    try:
        summarize("median 900ms\n", "WidgetComponent.js")
        raise AssertionError("expected a failure for a run with no [probe] lines")
    except ValueError as e:
        assert "[probe]" in str(e), e

    # a run that logged probe marks but no median must not end on a dangling
    # separator
    assert summarize("[probe] calls=500\n", "WidgetComponent.js").endswith(
        "(each at its own last mark)"
    )

    # ---- main(): what it builds, and the argv it hands the driver
    with tempfile.TemporaryDirectory() as tmp:
        component = pathlib.Path(tmp) / "WidgetComponent.js"
        component.write_text(WIDGET)
        stdout = "[probe] calls=1500\nmedian 900ms\n"

        with _stubbed(stdout) as seen:
            main("widget", str(component), ring_clues=False)
        # the link is built from the HOOKED copy, not the file on disk: an
        # unhooked probe would time the component and count nothing
        example_dir, probe_src, board = seen["build"]
        assert COUNTER in probe_src, "main must build from the hooked source"
        assert example_dir == count_calls.EXAMPLES / "widget"
        assert board is None
        # the built link is what gets emptied, and no ring clues means `strip`
        assert seen["empty"] == ("LINK", "strip")
        # the driver is handed the EMPTIED link, one rep, and no ring flag
        assert seen["cmd"][0] == "node"
        assert seen["cmd"][1] == str(count_calls.APP_SOLVE)
        assert pathlib.Path(seen["cmd"][2]).name == "probe_empty.txt"
        assert seen["cmd"][3] == "1"
        assert "--ring-clues" not in seen["cmd"]

        # --ring-clues reaches both the empty mode and the driver argv: an
        # edge-clue board stripped to its givens loses the clues it is timing
        with _stubbed(stdout) as seen:
            main("widget", str(component), ring_clues=True, board="PUZZLE_LINK_28g.txt")
        assert seen["empty"][1] == "empty", "--ring-clues must keep the ring"
        assert seen["cmd"][-1] == "--ring-clues"
        assert seen["build"][2] == "PUZZLE_LINK_28g.txt", "--board must reach the build"

        # a driver that failed exits, never prints a report off partial output
        with _stubbed(stdout, returncode=1):
            try:
                main("widget", str(component), ring_clues=False)
                raise AssertionError("expected an exit on a failed driver run")
            except SystemExit as e:
                assert "app-solve.mjs failed" in str(e), e

        # a driver that ran but logged no [probe] line exits too -- a component
        # whose `update` the app never called must not read as a zero count
        with _stubbed("median 900ms\n"):
            try:
                main("widget", str(component), ring_clues=False)
                raise AssertionError("expected an exit on a run with no probes")
            except SystemExit as e:
                assert "[probe]" in str(e), e

        # an unhookable component fails before any link is built
        plain = pathlib.Path(tmp) / "PlainComponent.js"
        plain.write_text("// no update generator\n")
        with _stubbed(stdout) as seen:
            try:
                main("widget", str(plain), ring_clues=False)
                raise AssertionError("expected an exit for an unhookable component")
            except SystemExit as e:
                assert "hook" in str(e), e
        assert not seen, "main must fail before building anything"

    print("count_calls self-check OK")
