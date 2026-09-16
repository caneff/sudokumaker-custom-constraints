"""Hunt resume after a kill, black-box on the `hunt` CLI (#487).

Runs the toy finders in this directory as subprocesses and checks only what
a caller of the hunt CLI can see: exit code, stderr, and the output files --
never an internal of driver.py. Two kinds of interruption are exercised:

- A genuine `SIGKILL` mid-hunt, via a finder that sleeps a few ms per seed so
  the kill reliably lands before the range completes (no timing race).
- A hand-corrupted trailing line, for the one case a real kill can leave
  that a timing race can't reliably reproduce: a write caught mid-syscall.

    uv run finders/hunt/test_hunt_resume.py
"""

import json
import subprocess
import sys
import tempfile
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dedupe import D4, canonical_key

HERE = Path(__file__).resolve().parent
SLOW_FINDER = HERE / "toy_slow_finder.py"
STATEFUL_FINDER = HERE / "toy_stateful_finder.py"
TOY_FINDER = HERE / "toy_finder.py"

ok = True


def check(name, cond):
    global ok
    status = "ok" if cond else "FAIL"
    if not cond:
        ok = False
    print(f"{status}: {name}")


def run_cli(finder, out, seeds, extra_env=None):
    return subprocess.run(
        [sys.executable, str(finder), "--out", str(out), "--seeds", seeds],
        capture_output=True,
        text=True,
    )


def read_jsonl(path):
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines() if line.strip()]


def kill_partway(finder, out, seeds, min_seed_done_events=3):
    """Start `finder` on `seeds`, SIGKILL it once progress.jsonl has grown,
    and return once the process has exited. The finder must sleep per seed
    (see toy_slow_finder.py) so this doesn't race a hunt that finishes
    before the kill lands."""
    proc = subprocess.Popen(
        [sys.executable, str(finder), "--out", str(out), "--seeds", seeds],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    progress_path = out / "progress.jsonl"
    deadline = time.time() + 10
    while time.time() < deadline:
        if (
            progress_path.exists()
            and len(read_jsonl(progress_path)) >= min_seed_done_events
        ):
            break
        if proc.poll() is not None:
            break
        time.sleep(0.005)
    proc.kill()
    proc.wait(timeout=10)
    return proc


with tempfile.TemporaryDirectory() as tmp:
    # Reference: an uninterrupted hunt over the same seed range, to compare
    # the resumed hunt's final output against.
    ref = Path(tmp) / "ref"
    ref_result = run_cli(TOY_FINDER, ref, "0:60")
    check(
        f"reference hunt exits 0 (stderr: {ref_result.stderr[-300:]})",
        ref_result.returncode == 0,
    )
    ref_examples = read_jsonl(ref / "examples.jsonl")
    ref_summary = json.loads((ref / "summary.json").read_text())

    out = Path(tmp) / "killed"
    kill_partway(SLOW_FINDER, out, "0:60")
    progress_before = read_jsonl(out / "progress.jsonl")
    check(
        "the kill left a genuine partial hunt (some seeds done, not all)",
        0 < len(progress_before) < 60,
    )

    resumed = run_cli(SLOW_FINDER, out, "0:60")
    check(
        f"resume after a kill exits 0 (stderr: {resumed.stderr[-300:]})",
        resumed.returncode == 0,
    )

    progress_after = read_jsonl(out / "progress.jsonl")
    seeds_seen = [e["seed"] for e in progress_after if e.get("event") == "seed_done"]
    check(
        "exactly one seed_done event per seed, no seed runs twice",
        sorted(seeds_seen) == list(range(60)),
    )

    resumed_examples = read_jsonl(out / "examples.jsonl")
    resumed_keys = [canonical_key(tuple(e["grid"]), D4) for e in resumed_examples]
    check(
        "no duplicate example after resume",
        len(resumed_keys) == len(set(resumed_keys)),
    )
    ref_keys = {canonical_key(tuple(e["grid"]), D4) for e in ref_examples}
    check(
        "resume finds the same examples as an uninterrupted hunt over the same range",
        set(resumed_keys) == ref_keys,
    )

    resumed_summary = json.loads((out / "summary.json").read_text())
    check(
        "summary.json after resume matches the uninterrupted reference",
        resumed_summary == ref_summary,
    )

with tempfile.TemporaryDirectory() as tmp:
    # A toy finder that saves state (#487 AC: "gets it back on resume").
    # seeds_seen is a counter this finder can only get right by continuing
    # from a saved value, not by restarting at zero and only counting the
    # seeds this process itself re-ran.
    out = Path(tmp) / "stateful"
    kill_partway(STATEFUL_FINDER, out, "0:40")
    progress_before = read_jsonl(out / "progress.jsonl")
    check(
        "the kill left a genuine partial stateful hunt",
        0 < len(progress_before) < 40,
    )
    state_before = json.loads((out / "state.json").read_text())
    check(
        "state.json was written before the kill",
        state_before.get("seeds_seen") == len(progress_before),
    )

    resumed = run_cli(STATEFUL_FINDER, out, "0:40")
    check(
        f"resume of a stateful hunt exits 0 (stderr: {resumed.stderr[-300:]})",
        resumed.returncode == 0,
    )
    state_after = json.loads((out / "state.json").read_text())
    check(
        "state.json's counter reflects every seed, not just the ones re-run after resume",
        state_after.get("seeds_seen") == 40,
    )

    examples = read_jsonl(out / "examples.jsonl")
    check(
        "an example found after resume was stamped with a counter value carried from before the kill",
        any(e.get("seeds_seen_at_find", 0) > len(progress_before) for e in examples)
        or len(examples) == 0,
    )
    progress_after = read_jsonl(out / "progress.jsonl")
    seeds_seen = [e["seed"] for e in progress_after if e.get("event") == "seed_done"]
    check(
        "stateful resume: exactly one seed_done event per seed",
        sorted(seeds_seen) == list(range(40)),
    )

with tempfile.TemporaryDirectory() as tmp:
    # A half-written trailing line, as a real kill mid-write() can leave --
    # not reproducible via timing, so it's hand-corrupted here.
    out = Path(tmp) / "corrupted"
    result = run_cli(TOY_FINDER, out, "0:100")
    check(
        f"base hunt for corruption test exits 0 (stderr: {result.stderr[-300:]})",
        result.returncode == 0,
    )

    progress_path = out / "progress.jsonl"
    examples_path = out / "examples.jsonl"
    progress_text = progress_path.read_text()
    progress_path.write_text(
        progress_text[: -(len(progress_text.splitlines()[-1]) // 2)]
    )
    if examples_path.read_text().strip():
        examples_text = examples_path.read_text()
        examples_path.write_text(
            examples_text[: -(len(examples_text.splitlines()[-1]) // 2)]
        )

    rerun = run_cli(TOY_FINDER, out, "0:100")
    check(
        f"resume after a half-written trailing line exits 0 (stderr: {rerun.stderr[-300:]})",
        rerun.returncode == 0,
    )

    final_progress = read_jsonl(out / "progress.jsonl")
    seeds_seen = [e["seed"] for e in final_progress if e.get("event") == "seed_done"]
    check(
        "a half-written trailing line doesn't break resume: every seed still runs exactly once",
        sorted(seeds_seen) == list(range(100)),
    )
    final_examples = read_jsonl(out / "examples.jsonl")
    final_keys = [canonical_key(tuple(e["grid"]), D4) for e in final_examples]
    check(
        "no duplicate example after resuming past a half-written line",
        len(final_keys) == len(set(final_keys)),
    )

with tempfile.TemporaryDirectory() as tmp:
    # Argv mismatch refuses to start and writes nothing.
    out = Path(tmp) / "mismatch"
    result = run_cli(TOY_FINDER, out, "0:30")
    check(
        f"base hunt for argv-mismatch test exits 0 (stderr: {result.stderr[-300:]})",
        result.returncode == 0,
    )

    before = {
        name: (out / name).read_bytes()
        for name in ("examples.jsonl", "summary.json", "progress.jsonl", "run.json")
    }

    rerun = run_cli(TOY_FINDER, out, "0:99")
    check("a differing argv (seeds) exits non-zero", rerun.returncode != 0)

    after = {name: (out / name).read_bytes() for name in before}
    check(
        "a differing argv writes nothing -- every output file is untouched",
        before == after,
    )

with tempfile.TemporaryDirectory() as tmp:
    # Git sha mismatch warns but proceeds.
    out = Path(tmp) / "sha-mismatch"
    result = run_cli(TOY_FINDER, out, "0:30")
    check(
        f"base hunt for sha-mismatch test exits 0 (stderr: {result.stderr[-300:]})",
        result.returncode == 0,
    )

    run_info = json.loads((out / "run.json").read_text())
    run_info["git_sha"] = "0" * 40
    (out / "run.json").write_text(json.dumps(run_info))

    rerun = run_cli(TOY_FINDER, out, "0:30")
    check(
        f"a differing git sha proceeds (exit 0, stderr: {rerun.stderr[-300:]})",
        rerun.returncode == 0,
    )
    check("a differing git sha prints a warning", "sha" in rerun.stderr.lower())

sys.exit(0 if ok else 1)
