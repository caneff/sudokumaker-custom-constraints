# Shared helper for tests that need to know what a `just` recipe or the seam
# runner (`tests/all.sh`) actually runs. Used by gate.test.py (check vs
# check-full), ci_workflow.test.py (the CI matrix vs check-full),
# recipe_discovery.test.py and seam_runner.test.py, so all of them compare
# against the same ground truth.

import os
import pathlib
import shutil
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]

STUB = '#!/bin/sh\necho "$(basename "$0") $*" >> "$GATE_LOG"\n'


def run_stubbed(argv, root=ROOT, real=()):
    """Run `argv` from `root` with node, npx, uv and uvx replaced by stubs that
    log their argv and exit 0, except the names in `real`. Returns the finished
    process and the logged commands, one string each, in order."""
    with tempfile.TemporaryDirectory() as tmp:
        bin_dir = pathlib.Path(tmp) / "bin"
        bin_dir.mkdir()
        for name in ("node", "npx", "uv", "uvx"):
            if name in real:
                continue
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
        r = subprocess.run(argv, cwd=root, env=env, capture_output=True, text=True)
        return r, log.read_text().splitlines()


def commands(recipe, root=ROOT):
    """The commands `just <recipe>` runs from `root`, one string each, in order."""
    just = os.environ.get("JUST") or shutil.which("just")
    assert just, "no just executable: set JUST or put just on PATH"
    r, ran = run_stubbed([just, "--justfile", str(root / "justfile"), recipe], root)
    assert r.returncode == 0, f"just {recipe} failed:\n{r.stdout}{r.stderr}"
    return ran
