"""Time the PySAT uniqueness check against the CP-SAT one on the 15 fixture
puzzles (#776). Run by hand; no gate runs it.

    uv run finders/ubahn/time_sat.py [--reps N] [--time-limit SECONDS]

Prints a Markdown table: per puzzle, each check's verdict and its fastest of
N runs in milliseconds, model build included, one core. A run the time limit
stopped prints as "timeout" and its time is the cap, not a solve time.
"""

import argparse
import json
import sys
import time
from functools import partial
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import model
import sat_model
from network import BLANK, BRANCH, CROSS, KINDS, STRAIGHT, TURN

FIXTURE = HERE.parents[1] / "docs/research/2026-10-10-u-bahn-timing-puzzles.json"
# The order the fixture writes a line's four numbers in; it leaves blank out.
FIXTURE_ORDER = (CROSS, BRANCH, STRAIGHT, TURN)


def fixture_numbers(puzzle):
    """One fixture puzzle's outside numbers as `network.outside_numbers`
    returns them: a blank count added to each line, the kinds in `KINDS`
    order."""

    def line(counts, length):
        by_kind = dict(zip(FIXTURE_ORDER, counts, strict=True))
        by_kind[BLANK] = length - sum(counts)
        return tuple(by_kind[k] for k in KINDS)

    return (
        tuple(line(counts, puzzle["cols"]) for counts in puzzle["row_numbers"]),
        tuple(line(counts, puzzle["rows"]) for counts in puzzle["col_numbers"]),
    )


def fixture_puzzles():
    """The fixture's puzzles, as the file holds them."""
    return json.loads(FIXTURE.read_text())["puzzles"]


def fastest(check, reps):
    """`check()`'s result and the fastest of `reps` runs, in milliseconds.
    Raises if two runs give different verdicts."""
    results, times = [], []
    for _ in range(reps):
        started = time.perf_counter()
        results.append(check())
        times.append((time.perf_counter() - started) * 1000)
    if len({result[0] for result in results}) != 1:
        raise RuntimeError(f"verdicts differ between runs: {results}")
    return results[0], min(times)


def main(argv):
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--reps", type=int, default=3)
    parser.add_argument("--time-limit", type=float, default=60.0)
    args = parser.parse_args(argv)

    print("| Puzzle | PySAT | ms | Cuts | CP-SAT flow | ms | Agree |")
    print("| --- | --- | --- | --- | --- | --- | --- |")
    agree = True
    for puzzle in fixture_puzzles():
        rows, cols = puzzle["rows"], puzzle["cols"]
        numbers = fixture_numbers(puzzle)
        (sat, _, cuts), sat_ms = fastest(
            partial(
                sat_model.uniqueness, rows, cols, numbers, time_limit=args.time_limit
            ),
            args.reps,
        )
        (flow, _), flow_ms = fastest(
            partial(
                model.uniqueness,
                rows,
                cols,
                numbers,
                "flow",
                time_limit=args.time_limit,
                workers=1,
            ),
            args.reps,
        )
        agree = agree and sat == flow
        print(
            f"| {puzzle['name']} | {sat} | {sat_ms:.1f} | {cuts} "
            f"| {flow} | {flow_ms:.1f} | {'yes' if sat == flow else 'NO'} |"
        )
    return 0 if agree else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
