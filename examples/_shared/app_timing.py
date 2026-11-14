# The app-timing driver shared by `just time`, `just time-link` and
# count_calls.py: runs app-solve.mjs on a link (app_solve), interleaves the
# reps (run_app_solve, combine_reps), and builds the paste-ready rows and the
# two-row ship verdict (build_row, build_link_row, ship_verdict). It knows
# nothing about examples or candidate components; time_example.py resolves
# those and calls it. The row format is pinned in docs/real-app-timing.md.

import json
import pathlib
import re
import statistics
import subprocess
import sys

HERE = pathlib.Path(__file__).parent
APP_SOLVE = HERE / "app-solve.mjs"
JSON_LINE = re.compile(r"^JSON: (.+)$", re.MULTILINE)
REPS = 3
INF = float("inf")


def read_app_solve_json(stdout):
    """app-solve.mjs's JSON line, parsed. Raises when there is none."""
    m = JSON_LINE.search(stdout)
    if not m:
        raise RuntimeError(f"app-solve.mjs printed no JSON line:\n{stdout}")
    return json.loads(m.group(1))


def check_app_solve_result(link_path, data):
    """`data` back, or a loud failure naming link_path: every rep timed out
    (median null), or the app version could not be read. The one owner of the
    timeout verdict: combine_reps's aggregate of interleaved one-rep calls,
    and the one-rep caller path."""
    if data["median"] is None:
        # Name app-solve.mjs's fixed 300s per-rep wait (solveOpen's default
        # timeoutMs in app-session.mjs) and the rep counts, so a reader learns
        # the app never finished a solve without opening the harness.
        raise RuntimeError(
            f"app-solve.mjs: {link_path}: all {data['repsRun']} reps hit the "
            f"300s per-rep timeout ({data['repsTimedOut']} timed out)"
        )
    if data["version"] is None:
        raise RuntimeError(
            f"app-solve.mjs could not read the app version for {link_path}"
        )
    return data


def app_solve(link_path, reps, ring_clues=False, after_logical=False):
    """Run app-solve.mjs on `link_path` and return its stdout: the one place
    the Python tools build the driver's argv (count_calls, run_app_solve).
    after_logical runs the app's logical solver to its fixpoint first. Raises
    RuntimeError naming the link when the driver exits non-zero."""
    cmd = ["node", str(APP_SOLVE), str(link_path), str(reps)]
    if ring_clues:
        cmd.append("--ring-clues")
    if after_logical:
        cmd.append("--after-logical")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(
            f"app-solve.mjs failed on {link_path}:\n"
            f"{result.stdout[-800:]}{result.stderr[-800:]}"
        )
    # The driver's busy-machine warning (#387) goes to stderr; a success must
    # not swallow it, or `just time` prints a row with no sign the box was busy.
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)
    return result.stdout


def rep_order(links, rnd):
    """The order one round times `links` in: the lead alternates by round
    (first link first in round 0), so neither always gets the colder slot."""
    return links if rnd % 2 == 0 else links[::-1]


def run_app_solve(
    baseline_link, candidate_link=None, ring_clues=False, after_logical=False
):
    """Time the links REPS times each, interleaved as docs/real-app-timing.md
    requires: every round times one rep of each link, and the lead alternates
    (baseline first in round 1) so neither always gets the colder slot. Returns
    (baseline, candidate): each combine_reps's result over that link's own reps,
    candidate None when `candidate_link` is None. A rep that times out is left
    out of its link's median, and a link whose every rep timed out raises."""
    links = [baseline_link] + ([candidate_link] if candidate_link else [])
    data = {link: [] for link in links}
    for rnd in range(REPS):
        for link in rep_order(links, rnd):
            stdout = app_solve(link, 1, ring_clues, after_logical)
            data[link].append(read_app_solve_json(stdout))
    timed = [combine_reps(link, data[link]) for link in links]
    return timed[0], (timed[1] if candidate_link else None)


def combine_reps(link_path, reps):
    """One link's {median, version, repsRun, repsTimedOut} from its one-rep
    driver results, judged by check_app_solve_result: every rep that finished
    must carry the app version, and a link with none finished is a timeout. The
    median is the upper middle, matching `median` in app-solve-lib.mjs,
    recomputed here because the driver only ever sees one rep per call."""
    finished = [r for r in reps if r["median"] is not None]
    for r in finished:
        check_app_solve_result(link_path, r)
    done = [r["median"] for r in finished]
    data = {
        "median": statistics.median_high(done) if done else None,
        "version": finished[0]["version"] if finished else None,
        "repsRun": len(reps),
        "repsTimedOut": len(reps) - len(finished),
        # The driver's machine-load verdict (#387): any rep read busy, and the
        # worst reading, so the pasted row can say the box was not quiet.
        "busy": any(r.get("busy") for r in reps),
        "maxLoad": max(
            (
                v
                for r in reps
                for pair in r.get("loads", [])
                for v in (pair.get("before"), pair.get("after"))
                if v is not None
            ),
            default=None,
        ),
        "loadThreshold": next(
            (r["loadThreshold"] for r in reps if "loadThreshold" in r), None
        ),
    }
    return check_app_solve_result(link_path, data)


def busy_note(*timed):
    """` (BUSY load 27.7 > 16)` when any of the timed links' reps read a busy
    machine, else ''. It goes on the pasted row's verdict cell, so a row taken
    on a loaded box says so after the terminal is gone (#387)."""
    hot = [t for t in timed if t and t.get("busy")]
    if not hot:
        return ""
    worst = max(t["maxLoad"] for t in hot if t.get("maxLoad") is not None)
    return f" (BUSY load {worst:.1f} > {hot[0]['loadThreshold']:g})"


def _row(date, version, board, baseline, candidate, ratio, verdict):
    """The one 7-column paste-ready row, shared by build_row and
    build_link_row so the two cannot drift apart."""
    return f"| {date} | {version} | {board} | {baseline} | {candidate} | {ratio} | {verdict} |"


def ratio_cell(ratio):
    """The ratio cell of a row: the one formatter build_row and build_link_row
    share. None (a 0ms baseline against a 0ms candidate) is `—`, INF is `∞`."""
    return "—" if ratio is None else "∞" if ratio == INF else f"{ratio:.2f}"


def build_row(date, version, board, baseline_ms, candidate_ms=None, note=""):
    """The paste-ready row, its verdict and its ratio. candidate_ms=None means
    byte-equal code: baseline-only row, verdict BASELINE, ratio None. PASS
    means candidate_ms <= 0.9 x baseline_ms on this row alone; the two-row
    ship rule is ship_verdict's job, and it reads the ratio returned here. A
    0ms baseline has no ratio: NO TIME when the candidate is 0ms too, FAIL
    when it is not. `note` (busy_note, "" when the box was quiet) follows the
    verdict cell, the verdict word unchanged."""
    if candidate_ms is None:
        verdict, candidate_cell, ratio = "BASELINE", "—", None
    else:
        ratio = row_ratio(baseline_ms, candidate_ms)
        verdict = "NO TIME" if ratio is None else "PASS" if ratio <= 0.9 else "FAIL"
        candidate_cell = f"{candidate_ms}ms"
    shown = "—" if candidate_ms is None else ratio_cell(ratio)
    row = _row(
        date, version, board, f"{baseline_ms}ms", candidate_cell, shown, verdict + note
    )
    return row, verdict, ratio


def build_link_row(date, version, board, a_ms, b_ms, note):
    """`just time-link`'s paste-ready row, same columns as build_row. The
    verdict cell holds no ship verdict -- no candidate component is involved,
    so the two-row rule does not apply. With one link (b_ms None) the
    candidate and ratio cells are empty; with two, the ratio is b/a
    (row_ratio: a 0ms `a` has none, or INF). `note` (busy_note, "" when the
    box was quiet) follows the verdict cell."""
    if b_ms is None:
        b_cell, shown = "—", "—"
    else:
        b_cell, shown = f"{b_ms}ms", ratio_cell(row_ratio(a_ms, b_ms))
    return _row(date, version, board, f"{a_ms}ms", b_cell, shown, f"—{note}")


def time_modes(baseline_link, candidate_link, ring_clues, labels, make_row):
    """Both modes timed, the cold row then the after-logical row
    (docs/real-app-timing.md), and what `make_row` built for each, in that
    order. `labels` is the (cold, after-logical) board-cell pair;
    `make_row(version, label, baseline_ms, candidate_ms, note)` is a row
    builder with its date bound (build_row or build_link_row), and every row
    gets the busy note through it. The one place the two modes are looped,
    shared by `just time` and `just time-link`."""
    built = []
    for after_logical, label in zip((False, True), labels, strict=True):
        base, cand = run_app_solve(
            baseline_link, candidate_link, ring_clues, after_logical
        )
        built.append(
            make_row(
                base["version"],
                label,
                base["median"],
                cand["median"] if cand else None,
                busy_note(base, cand),
            )
        )
    return built


def row_ratio(baseline_ms, candidate_ms):
    """One row's candidate/baseline ratio. A 0ms baseline has no ratio: None
    when the candidate is 0ms too (nothing was timed on this row), INF when it
    is not -- the app used to finish this board without searching and now does
    not, which is the regression the row exists to catch, not a free pass."""
    if baseline_ms:
        return candidate_ms / baseline_ms
    return None if candidate_ms == 0 else INF


def ship_verdict(ratios):
    """The two-row rule (docs/real-app-timing.md): a change ships when it
    clears 0.9x on one of the two rows and stays within 1.1x on the other.
    A None ratio (see row_ratio) places no constraint, so the other row
    decides; INF is past 1.1x and sinks the change. All None means nothing
    was timed."""
    real = [r for r in ratios if r is not None]
    if not real:
        return "NO TIME"
    return "SHIP" if min(real) <= 0.9 and max(real) <= 1.1 else "NO SHIP"
