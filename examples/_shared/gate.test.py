# The two gate tiers (#411): `just check` is the fast loop, `just check-full`
# is everything and runs on every pull request. This runs both recipes with
# node, npx, uv and uvx replaced by stubs that log their argv and exit 0, then
# checks what each tier would have run against the files on disk:
#
#   - check-full runs every *.test.mjs, *.test.py and soundness-harness.mjs
#     under examples/, lint, and the two plain scripts the gate runs, so a new
#     or renamed test cannot drop out of both tiers;
#   - check runs none of the heavy tests the ruling moved out, and no
#     soundness harness;
#   - every command check runs, check-full runs too;
#   - no Python step passes --with, so every call uses the one synced project
#     environment and nothing resolves per call.
#
#   uv run examples/_shared/gate.test.py

import os
import pathlib
import shutil
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]

# The heavy tier, as the #411 ruling names it.
HEAVY = {
    "uv run examples/fillomino/pipeline.test.py",
    "uv run examples/fillomino/generate.test.py",
    "node examples/skyscraper/recovery-probe.test.mjs",
    "node examples/hit-counts/recovery-probe.test.mjs",
}

LINT = {
    "npx standard",
    "uvx ruff check examples",
    "uvx ruff format --check examples",
}

SCRIPTS = {
    "uv run examples/_shared/check_layout.py",
    "uv run examples/skyscraper/verify.py",
}

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


def on_disk():
    """The command the gate must run for every test and harness file."""
    want = set()
    for pattern, runner in (
        ("*.test.mjs", "node"),
        ("*.test.py", "uv run"),
        ("soundness-harness.mjs", "node"),
    ):
        for f in ROOT.glob(f"examples/*/{pattern}"):
            want.add(f"{runner} {f.relative_to(ROOT).as_posix()}")
    return want


if __name__ == "__main__":
    full = commands("check-full")
    fast = commands("check")

    with_flags = [c for c in full if "--with" in c]
    assert not with_flags, f"steps resolve their own environment: {with_flags}"

    missing = (on_disk() | LINT | SCRIPTS) - set(full)
    assert not missing, f"check-full does not run: {sorted(missing)}"

    heavy_in_fast = HEAVY & set(fast)
    assert not heavy_in_fast, f"check runs heavy tests: {sorted(heavy_in_fast)}"
    harness_in_fast = [c for c in fast if c.endswith("soundness-harness.mjs")]
    assert not harness_in_fast, f"check runs soundness harnesses: {harness_in_fast}"

    only_fast = set(fast) - set(full)
    assert not only_fast, f"check runs steps check-full skips: {sorted(only_fast)}"

    print(f"gate.test.py: check {len(fast)} steps, check-full {len(full)} steps: ok")
