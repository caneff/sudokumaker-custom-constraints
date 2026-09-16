"""Box-safe defaults for the hunt CLI: `--workers` and the load gate (#488).

Black-box through the `hunt` CLI in a subprocess, same style as
test_toy_hunt.py: exit codes and output files only, never an internal of
driver.py. A finder that records `self.workers` into its own output is how
"the finder receives N" is observed from outside. The 1-minute load is
injected via the `HUNT_FAKE_LOAD1` env var rather than a CLI flag, so
production argv never carries a test-only knob.
"""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent

WORKERS_FINDER = f"""
import sys
sys.path.insert(0, {str(HERE)!r})
from driver import run
from protocol import Verdict

class WorkersFinder:
    def propose(self, rng):
        return (0,)

    def verify(self, candidate):
        return Verdict(ok=True)

    def record(self, candidate):
        return {{"workers": self.workers}}

    def key(self, candidate):
        return candidate

sys.exit(run(WorkersFinder(), sys.argv[1:]))
"""

ok = True


def check(name, cond):
    global ok
    status = "ok" if cond else "FAIL"
    if not cond:
        ok = False
    print(f"{status}: {name}")


def run_cli(out, extra_args, env=None):
    full_env = dict(os.environ)
    if env:
        full_env.update(env)
    return subprocess.run(
        [
            sys.executable,
            "-c",
            WORKERS_FINDER,
            "--out",
            str(out),
            "--seeds",
            "0:1",
            *extra_args,
        ],
        capture_output=True,
        text=True,
        env=full_env,
    )


with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "hunt-out"
    result = run_cli(out, [])
    check(
        f"no --workers exits 0 (stderr: {result.stderr[-500:]})", result.returncode == 0
    )
    examples = [
        json.loads(line)
        for line in (out / "examples.jsonl").read_text().splitlines()
        if line
    ]
check("without --workers, the finder receives 3", examples[0]["workers"] == 3)

with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "hunt-out"
    result = run_cli(out, ["--workers", "8"])
    check(
        f"--workers 8 exits 0 (stderr: {result.stderr[-500:]})", result.returncode == 0
    )
    examples = [
        json.loads(line)
        for line in (out / "examples.jsonl").read_text().splitlines()
        if line
    ]
    check("--workers 8 passes 8 to the finder", examples[0]["workers"] == 8)

with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "hunt-out"
    result = run_cli(out, [], env={"HUNT_FAKE_LOAD1": "25"})
    check(
        f"load 25 exits nonzero (stderr: {result.stderr[-500:]})",
        result.returncode != 0,
    )
    check("load 25 refuses before any seed runs", not (out / "progress.jsonl").exists())

with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "hunt-out"
    result = run_cli(out, ["--force-load"], env={"HUNT_FAKE_LOAD1": "25"})
    check(
        f"load 25 with --force-load exits 0 (stderr: {result.stderr[-500:]})",
        result.returncode == 0,
    )
    check("load 25 with --force-load runs the seed", (out / "progress.jsonl").exists())

sys.exit(0 if ok else 1)
