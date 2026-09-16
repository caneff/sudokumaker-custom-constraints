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

sys.exit(0 if ok else 1)
