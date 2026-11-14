# app_timing.py: the paste-ready row builder and its PASS/FAIL verdict, the
# two-row ship rule, the app-solve.mjs adapter and its result checks, and the
# rep aggregation (combine_reps, run_app_solve) with the browser call faked out
# (app_timing_fake.fake_solve). Fake medians only; no live browser. app_timing
# has no CLI of its own: its real run is `just time` or `just time-link` on the
# recorded app, a manual check -- see docs/real-app-timing.md.
#
#   uv run examples/_shared/app_timing.test.py

import contextlib
import functools
import io
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

import app_timing
from app_timing import (
    app_solve,
    build_row,
    check_app_solve_result,
    read_app_solve_json,
    row_ratio,
    ship_verdict,
)
from app_timing_fake import fake_solve

R = app_timing.REPS
B, C = "baseline_searchable.txt", "candidate_searchable.txt"


if __name__ == "__main__":
    # candidate under the 0.9x bar -> PASS
    row, verdict, _ratio = build_row(
        "2026-08-26", "v2026.08.14-d47fc4b", "numbered-rooms", 1000, 800
    )
    assert verdict == "PASS"
    assert row == (
        "| 2026-08-26 | v2026.08.14-d47fc4b | numbered-rooms | 1000ms | 800ms | 0.80 | PASS |"
    )

    # candidate at exactly the 0.9x bar -> PASS (bar is <=, not <)
    row, verdict, _ratio = build_row(
        "2026-08-26", "v2026.08.14-d47fc4b", "numbered-rooms", 1000, 900
    )
    assert verdict == "PASS"
    assert "0.90" in row and "PASS" in row

    # candidate over the bar -> FAIL
    row, verdict, _ratio = build_row(
        "2026-08-26", "v2026.08.14-d47fc4b", "numbered-rooms", 1000, 950
    )
    assert verdict == "FAIL"
    assert row == (
        "| 2026-08-26 | v2026.08.14-d47fc4b | numbered-rooms | 1000ms | 950ms | 0.95 | FAIL |"
    )

    # byte-equal code -> baseline-only row, no candidate/ratio
    row, verdict, _ratio = build_row(
        "2026-08-26", "v2026.08.14-d47fc4b", "numbered-rooms", 1000
    )
    assert verdict == "BASELINE"
    assert (
        row
        == "| 2026-08-26 | v2026.08.14-d47fc4b | numbered-rooms | 1000ms | — | — | BASELINE |"
    )

    # build_row hands back the ratio its own cell shows: the one place a
    # row's ratio is computed, which ship_verdict then reads (spec #953).
    assert build_row("d", "v", "x", 1000, 800)[2] == 0.8
    assert build_row("d", "v", "x", 1000)[2] is None
    assert build_row("d", "v", "x", 0, 0)[2] is None
    assert build_row("d", "v", "x", 0, 5)[2] == float("inf")

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
    row, verdict, _ratio = build_row(
        "2026-08-26", "v2026.08.14-d47fc4b", "isofill after-logical", 0, 0
    )
    assert verdict == "NO TIME"
    assert row == (
        "| 2026-08-26 | v2026.08.14-d47fc4b | isofill after-logical | 0ms | 0ms | — | NO TIME |"
    )

    # 0ms baseline, candidate slower: a FAIL row with an infinite ratio, not a
    # NO TIME row that quietly excuses it
    row, verdict, _ratio = build_row(
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

    # all reps timed out: the failure names the fixed 300s per-rep timeout
    # and the rep counts
    stdout = (
        "some app-solve.mjs log lines\n"
        'JSON: {"median": null, "version": "v2026.08.14-d47fc4b", '
        '"repsRun": 3, "repsTimedOut": 3}\n'
    )
    try:
        check_app_solve_result("PUZZLE_LINK_local.txt", read_app_solve_json(stdout))
        raise AssertionError("expected an all-reps-timed-out failure")
    except RuntimeError as e:
        assert str(e) == (
            "app-solve.mjs: PUZZLE_LINK_local.txt: all 3 reps hit the 300s "
            "per-rep timeout (3 timed out)"
        )

    # mixed outcome (median present) still returns the data
    stdout = (
        'JSON: {"median": 220, "version": "v2026.08.14-d47fc4b", '
        '"repsRun": 3, "repsTimedOut": 1}\n'
    )
    data = check_app_solve_result("PUZZLE_LINK.txt", read_app_solve_json(stdout))
    assert data["median"] == 220
    assert data["repsTimedOut"] == 1

    # no JSON line at all -- loud failure
    try:
        check_app_solve_result("PUZZLE_LINK.txt", read_app_solve_json("no json here\n"))
        raise AssertionError("expected a no-JSON-line failure")
    except RuntimeError as e:
        assert "printed no JSON line" in str(e)

    # unreadable app version -- loud failure
    stdout = 'JSON: {"median": 100, "version": null, "repsRun": 3, "repsTimedOut": 0}\n'
    try:
        check_app_solve_result("PUZZLE_LINK.txt", read_app_solve_json(stdout))
        raise AssertionError("expected a could-not-read-version failure")
    except RuntimeError as e:
        assert "could not read the app version" in str(e)

    # app_solve: the one adapter that builds app-solve.mjs's argv
    real_run = app_timing.subprocess.run
    seen = []

    def fake_run(cmd, **kwargs):
        seen.append(list(cmd))
        code = 1 if "fail.txt" in cmd[2] else 0
        return subprocess.CompletedProcess(cmd, code, "OUT\n", "ERR\n")

    app_timing.subprocess.run = fake_run
    try:
        # A successful run forwards the driver's stderr (its busy-machine
        # warning, #387) instead of swallowing it.
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            assert app_solve("board.txt", 3) == "OUT\n"
        assert err.getvalue() == "ERR\n", err.getvalue()
        assert app_solve("board.txt", 1, ring_clues=True, after_logical=True) == "OUT\n"
        try:
            app_solve("fail.txt", 1)
            raise AssertionError("a failed driver run must raise")
        except RuntimeError as e:
            assert "app-solve.mjs failed on fail.txt" in str(e) and "ERR" in str(e), e
    finally:
        app_timing.subprocess.run = real_run
    node = ["node", str(app_timing.APP_SOLVE)]
    assert seen[0] == [*node, "board.txt", "3"]
    assert seen[1] == [*node, "board.txt", "1", "--ring-clues", "--after-logical"]

    # Machine load (#387): the driver's busy verdict survives combine_reps and
    # reaches busy_note; time_example.test.py drives it into run()'s rows.
    def rep(median, loads, busy):
        return {
            "median": median,
            "version": "v1",
            "loads": loads,
            "busy": busy,
            "loadThreshold": 16,
        }

    quiet = app_timing.combine_reps(
        "b.txt", [rep(100, [{"before": 1.0, "after": 2.0}], False)]
    )
    hot = app_timing.combine_reps(
        "b.txt",
        [
            rep(100, [{"before": 1.0, "after": 2.0}], False),
            rep(100, [{"before": 27.7, "after": 3.0}], True),
        ],
    )
    assert quiet["busy"] is False and hot["busy"] is True
    assert hot["maxLoad"] == 27.7 and hot["loadThreshold"] == 16
    assert app_timing.busy_note(quiet, quiet) == ""
    assert app_timing.busy_note(quiet, hot) == " (BUSY load 27.7 > 16)"
    # A driver without load fields (an older JSON line) is not busy.
    assert (
        app_timing.combine_reps("b.txt", [{"median": 5, "version": "v1"}])["busy"]
        is False
    )

    # combine_reps's median is the upper middle (app-solve-lib.mjs `median`):
    # two reps -> the larger, four reps -> the third smallest, a timed-out rep
    # left out
    def medians(*values):
        reps = [{"median": v, "version": "v1"} for v in values]
        return app_timing.combine_reps("b.txt", reps)["median"]

    assert medians(300, 100) == 300
    assert medians(400, 100, 300, 200) == 300
    assert medians(100, 300, 200) == 200
    assert medians(None, 300, 100) == 300

    # one timed-out rep is left out of its link's median; a link whose reps all
    # timed out raises, naming the link
    with fake_solve({B: [1000, None, 3000], C: [500, 600, 700]}):
        base, cand = app_timing.run_app_solve(B, C)
    assert (base["median"], cand["median"]) == (3000, 600)
    with fake_solve({B: [1000, 1000, 1000], C: [None] * R}):
        try:
            app_timing.run_app_solve(B, C)
        except RuntimeError as e:
            assert str(e) == (
                f"app-solve.mjs: {C}: all {R} reps hit the 300s per-rep timeout "
                f"({R} timed out)"
            ), e
        else:
            raise AssertionError("an all-timeout link must raise")

    # an unreadable app version on any rep that finished fails the link, not
    # only on the first one
    ok = {"median": 100, "version": "v1", "repsRun": 1, "repsTimedOut": 0}
    no_version = {**ok, "median": 200, "version": None}
    for reps in ([ok, no_version, ok], [no_version, ok]):
        try:
            app_timing.combine_reps(B, reps)
        except RuntimeError as e:
            assert "could not read the app version" in str(e) and B in str(e), e
        else:
            raise AssertionError("a finished rep with no version must raise")
    assert app_timing.combine_reps(B, [ok, ok, ok])["version"] == "v1"

    # build_row takes the busy note as build_link_row does: it follows the
    # verdict cell on every row shape, the verdict word unchanged.
    note = " (BUSY load 9.0 > 4)"
    for args, tail in (
        ((1000, 800), "| 1000ms | 800ms | 0.80 | PASS" + note + " |"),
        ((1000,), "| 1000ms | — | — | BASELINE" + note + " |"),
        ((0, 0), "| 0ms | 0ms | — | NO TIME" + note + " |"),
        ((0, 5), "| 0ms | 5ms | ∞ | FAIL" + note + " |"),
    ):
        row, verdict, _ratio = build_row("d", "v", "x", *args, note=note)
        assert row.endswith(tail), row
        assert verdict == tail.split("|")[-2].strip().split(" (")[0], verdict

    # time_modes: both rows (cold, then after-logical) from one place, the busy
    # note on both, for a baseline-only run and a candidate run.
    hot = {"loads": [{"before": 27.7, "after": 3.0}], "busy": True, "loadThreshold": 16}
    labels = ("x", "x after-logical")
    make_row = functools.partial(build_row, "d")
    with fake_solve({B: [(1000, hot), 1000, 1000] + [(0, hot)] * R}) as calls:
        rows = app_timing.time_modes(B, None, False, labels, make_row)
    assert calls == [(B, False, False)] * R + [(B, False, True)] * R
    assert [r[1] for r in rows] == ["BASELINE", "BASELINE"]
    assert [r[2] for r in rows] == [None, None]
    assert (
        rows[0][0]
        == "| d | v2026.08.14-d47fc4b | x | 1000ms | — | — | BASELINE (BUSY load 27.7 > 16) |"
    )
    assert rows[1][0].endswith("| BASELINE (BUSY load 27.7 > 16) |"), rows[1][0]

    with fake_solve(
        {B: [1000] * R + [1000] * R, C: [(800, hot), 800, 800] + [(500, hot)] * R}
    ):
        rows = app_timing.time_modes(B, C, True, labels, make_row)
    assert [r[1] for r in rows] == ["PASS", "PASS"]
    assert [r[2] for r in rows] == [0.8, 0.5]
    for row, _verdict, _ratio in rows:
        assert row.endswith("| PASS (BUSY load 27.7 > 16) |"), row
    assert "| x after-logical |" in rows[1][0]
