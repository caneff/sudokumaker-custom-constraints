# Shared helper for tests that need to know what a `just` recipe actually
# runs. Used by gate.test.py (check vs check-full) and ci_workflow.test.py
# (the CI matrix vs check-full) so both compare against the same ground
# truth instead of each re-implementing the stub trick.

import os
import pathlib
import shutil
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]

STUB = '#!/bin/sh\necho "$(basename "$0") $*" >> "$GATE_LOG"\n'


def commands(recipe):
    """The commands `just <recipe>` runs, one string each, in order."""
    just = os.environ.get("JUST") or shutil.which("just")
    assert just, "no just executable: set JUST or put just on PATH"
    with tempfile.TemporaryDirectory() as tmp:
        bin_dir = pathlib.Path(tmp) / "bin"
        bin_dir.mkdir()
        for name in ("node", "npx", "uv", "uvx"):
            stub = bin_dir / name
            stub.write_text(STUB)
            stub.chmod(0o755)
        log = pathlib.Path(tmp) / "log"
        log.touch()
        env = {
            **os.environ,
            "PATH": f"{bin_dir}{os.pathsep}{os.environ['PATH']}",
            "GATE_LOG": str(log),
        }
        r = subprocess.run(
            [just, "--justfile", str(ROOT / "justfile"), recipe],
            cwd=ROOT,
            env=env,
            capture_output=True,
            text=True,
        )
        assert r.returncode == 0, f"just {recipe} failed:\n{r.stderr}"
        return log.read_text().splitlines()
