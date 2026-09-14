# The two gate tiers (#411): `just check` is the fast loop, `just check-full`
# is everything and runs on every pull request. This runs both recipes with
# node, npx, uv and uvx replaced by stubs that log their argv and exit 0, then
# checks what each tier would have run against the files on disk:
#
#   - check-full runs every *.test.mjs, *.test.py and soundness-harness.mjs
#     under examples/, lint, and the two plain scripts the gate runs, so a new
#     or renamed test cannot drop out of both tiers;
#   - what check-full adds over check is exactly the heavy tests the ruling
#     names and the soundness harnesses -- nothing heavy runs in check, and
#     nothing light is moved out of it;
#   - every command check runs, check-full runs too;
#   - lint runs `uv lock --check`, which fails when uv.lock no longer matches
#     pyproject.toml;
#   - no Python step passes --with, so every call uses the one synced project
#     environment and nothing resolves per call.
#
#   uv run examples/_shared/gate.test.py

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).parent))

from gate_lib import commands

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
    "uvx ruff check finders",
    "uvx ruff format --check examples",
    "uvx ruff format --check finders",
    "uv lock --check",
}

SCRIPTS = {
    "uv run examples/_shared/check_layout.py",
    "uv run examples/skyscraper/verify.py",
}


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

    harnesses = {c for c in on_disk() if c.endswith("soundness-harness.mjs")}
    added = set(full) - set(fast)
    assert added == HEAVY | harnesses, (
        f"check-full adds {sorted(added)}, not the heavy tests and harnesses"
    )

    only_fast = set(fast) - set(full)
    assert not only_fast, f"check runs steps check-full skips: {sorted(only_fast)}"

    print(f"gate.test.py: check {len(fast)} steps, check-full {len(full)} steps: ok")
