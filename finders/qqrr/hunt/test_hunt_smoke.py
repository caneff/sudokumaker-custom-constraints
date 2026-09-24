"""Smoke test for the hunt drivers: each compiles, and none hard-codes a home path.
The scripts run a hunt at import (they read sys.argv), so this test never imports them."""

import py_compile
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
scripts = sorted(p for p in HERE.glob("*.py") if p.name != Path(__file__).name)
assert len(scripts) == 6, scripts
for p in [*scripts, HERE / "scheduler4.sh"]:
    assert "/home/" not in p.read_text(), p
with tempfile.TemporaryDirectory() as d:
    for p in scripts:
        py_compile.compile(str(p), cfile=str(Path(d) / (p.name + "c")), doraise=True)
assert (HERE.parents[2] / "justfile").exists(), "parents[3] is not the repo root"
print("ok", len(scripts), "scripts", file=sys.stdout)
