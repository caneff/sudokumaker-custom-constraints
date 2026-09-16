"""The `hunt` CLI's render hook, in a subprocess (#490).

A finder that offers `render` gets one PNG per examples.jsonl line; a finder
that doesn't gets none. Black-box: only what a caller of the hunt CLI can
see -- files on disk and exit code, never a driver.py internal.

    uv run finders/hunt/test_render_hook.py
"""

import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
TOY_FINDER = HERE / "toy_finder.py"
TOY_RENDER_FINDER = HERE / "toy_render_finder.py"

ok = True


def check(name, cond):
    global ok
    status = "ok" if cond else "FAIL"
    if not cond:
        ok = False
    print(f"{status}: {name}")


with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "hunt-out"
    result = subprocess.run(
        [sys.executable, str(TOY_RENDER_FINDER), "--out", str(out), "--seeds", "0:200"],
        capture_output=True,
        text=True,
    )
    check(f"exit code 0 (stderr: {result.stderr[-500:]})", result.returncode == 0)

    examples = [
        json.loads(line)
        for line in (out / "examples.jsonl").read_text().splitlines()
        if line
    ]
    check("at least one example was found over 200 seeds", len(examples) > 0)

    renders_dir = out / "renders"
    check(
        "a renders/ directory exists when the finder offers render",
        renders_dir.is_dir(),
    )

    png_files = sorted(renders_dir.glob("*.png")) if renders_dir.is_dir() else []
    check(
        "one PNG exists per examples.jsonl line",
        len(png_files) == len(examples),
    )

    progress = [
        json.loads(line)
        for line in (out / "progress.jsonl").read_text().splitlines()
        if line
    ]
    accepted_seeds = {e["seed"] for e in progress if e.get("outcome") == "example"}
    check(
        "each PNG is named after the seed it belongs to, not a running index",
        {p.stem for p in png_files} == {str(s) for s in accepted_seeds},
    )

with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "hunt-out"
    result = subprocess.run(
        [sys.executable, str(TOY_FINDER), "--out", str(out), "--seeds", "0:200"],
        capture_output=True,
        text=True,
    )
    check(
        f"render-less finder still exits 0 (stderr: {result.stderr[-500:]})",
        result.returncode == 0,
    )
    check(
        "a finder with no render writes no renders/ directory",
        not (out / "renders").exists(),
    )

with tempfile.TemporaryDirectory() as tmp:
    # A finder whose render() raises must not take the whole hunt down with
    # it (#490 correctness review C1): the example itself is still real and
    # already durable in examples.jsonl by the time render() runs, so a
    # presentation-layer fault gets recorded on the seed's event, not
    # treated as a search failure.
    out = Path(tmp) / "hunt-out"
    raising_render_script = f"""
import sys
sys.path.insert(0, {str(HERE)!r})
from driver import run
from protocol import Verdict

class RaisingRenderFinder:
    symmetry = "IDENTITY"

    def propose(self, rng):
        return tuple(rng.randint(0, 1) for _ in range(4))

    def verify(self, candidate):
        return Verdict(ok=True)

    def record(self, candidate):
        return {{"grid": list(candidate)}}

    def key(self, candidate):
        return candidate

    def render(self, candidate):
        raise RuntimeError("boom")

sys.exit(run(RaisingRenderFinder(), sys.argv[1:]))
"""
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            raising_render_script,
            "--out",
            str(out),
            "--seeds",
            "0:5",
        ],
        capture_output=True,
        text=True,
    )
    check(
        f"a raising render() still exits 0 (stderr: {result.stderr[-500:]})",
        result.returncode == 0,
    )
    examples = [
        json.loads(line)
        for line in (out / "examples.jsonl").read_text().splitlines()
        if line
    ]
    progress = [
        json.loads(line)
        for line in (out / "progress.jsonl").read_text().splitlines()
        if line
    ]
    example_events = [e for e in progress if e.get("outcome") == "example"]
    check(
        "at least one example is still written despite render() raising",
        len(examples) > 0 and len(examples) == len(example_events),
    )
    check(
        "every example's event records the render failure instead of silently dropping it",
        all(e.get("render_error") for e in example_events),
    )

sys.exit(0 if ok else 1)
