# Count how many times the REAL app calls a component's `update` on one
# "Find all solutions" run. The first question before any per-call
# optimisation: is this component's update hot at all? (#133 asked it of the
# skyscraper line component: 57,000 calls, so 0.1 ms per call is the lever.)
#
#   uv run --with lzstring examples/_shared/count_calls.py skyscraper \
#       examples/skyscraper/SkyscraperLineComponent.js [--ring-clues]
#   uv run --with lzstring examples/_shared/count_calls.py isofill \
#       /tmp/probe/IsofillComponent.js --board PUZZLE_LINK_28g.txt
#
# Makes a probe copy of the component whose `update` logs
# `[probe] calls=N` every 500 calls, builds the example's same-board link from
# it (build_link.py --component), empties the link so the solver searches, and
# runs app-solve.mjs once; the driver relays the `[probe]` lines. Prints the
# final count and the app's time. See docs/real-app-timing.md.
#
# The two pure halves -- `probe_source` (splice the counter in) and
# `summarize` (the report line) -- are tested directly in count_calls.test.py.
# `main` is tested there too, with `build_candidate`, `empty_link_file` and
# `subprocess.run` stubbed: what it orchestrates is a real Chromium against
# the live sudokumaker.app, so a run with the real three stays manual.

import argparse
import pathlib
import subprocess
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from time_example import APP_SOLVE, build_candidate, empty_link_file

EXAMPLES = pathlib.Path(__file__).parent.parent
HOOK = "function * update (instance, puzzle) {"
COUNTER = (
    "let _probeCalls = 0\n" + HOOK + "\n"
    "  if (++_probeCalls % 500 === 0) console.log(`[probe] calls=${_probeCalls}`)"
)


def probe_source(src):
    """The component source with a call counter spliced into its `update`.

    Raises ValueError when the source has no `update` generator to hook --
    the caller turns that into an exit, so a renamed signature fails loud
    instead of timing an unhooked component and reporting nothing.
    """
    if HOOK not in src:
        raise ValueError(f"no `{HOOK}` to hook")
    return src.replace(HOOK, COUNTER, 1)


def summarize(stdout, component_name, board=None):
    """The one-line report for a driver run's stdout.

    Raises ValueError when the run logged no `[probe]` line at all: an
    unhooked or crashed run must not print a report reading as a zero count.
    """
    probes = [ln for ln in stdout.splitlines() if ln.startswith("[probe]")]
    if not probes:
        raise ValueError("app-solve.mjs gave no [probe] lines")
    took = [ln for ln in stdout.splitlines() if "median" in ln]
    # One line per `[probe] <name>=` series, each at its own last mark.
    series = {ln.split("=")[0]: ln for ln in probes}
    where = f" on {board}" if board else ""
    line = (
        f"{component_name}{where}: {'; '.join(series.values())} "
        "(each at its own last mark)"
    )
    # A run can log probe marks and no median (the app never finished). Say
    # nothing rather than end the report on a dangling separator.
    return f"{line}; {took[-1]}" if took else line


def main(example, component, ring_clues, board=None):
    component = pathlib.Path(component)
    try:
        hooked = probe_source(component.read_text())
    except ValueError as e:
        sys.exit(f"{component}: {e}")
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        probe = tmp / component.name  # build_link.py swaps by basename
        probe.write_text(hooked)
        link = tmp / "probe.txt"
        build_candidate(EXAMPLES / example, probe, link, board=board)
        emptied = tmp / "probe_empty.txt"
        empty_link_file(link, emptied, "empty" if ring_clues else "strip")
        cmd = ["node", str(APP_SOLVE), str(emptied), "1"]
        if ring_clues:
            cmd.append("--ring-clues")
        out = subprocess.run(cmd, capture_output=True, text=True)
    if out.returncode != 0:
        sys.exit(f"app-solve.mjs failed:\n{out.stdout[-800:]}{out.stderr[-800:]}")
    try:
        print(summarize(out.stdout, component.name, board))
    except ValueError as e:
        sys.exit(f"{e}:\n{out.stdout[-800:]}{out.stderr[-800:]}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("example")
    p.add_argument("component")
    p.add_argument("--ring-clues", action="store_true")
    p.add_argument(
        "--board", help="link file in the example dir, instead of PUZZLE_LINK.txt"
    )
    a = p.parse_args()
    main(a.example, a.component, a.ring_clues, a.board)
