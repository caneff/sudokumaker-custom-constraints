# check-full's heavy groups run as separate CI jobs (a matrix), side by side
# with `just check`. This proves the split without re-implementing YAML
# parsing: the workflow's matrix recipe list is read with a narrow regex
# (this file's format is ours to keep simple), then the actual coverage
# claim is checked the same way gate.test.py checks it -- by running each
# recipe for real through gate_lib.commands() and diffing against
# `just check-full`.
#
#   uv run examples/_shared/ci_workflow.test.py

import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).parent))

from gate_lib import commands

WORKFLOW = ROOT / ".github/workflows/ci.yml"


def matrix_recipes(text):
    m = re.search(r"recipe:\s*\[([^\]]*)\]", text)
    assert m, "ci.yml has no `recipe: [...]` matrix to run the gate jobs from"
    return [r.strip() for r in m.group(1).split(",") if r.strip()]


def job_blocks(text):
    """Map job name -> its indented body, read from the `jobs:` section.

    A job is a two-space-indented `name:` key under a top-level `jobs:`.
    Narrow on purpose (no PyYAML here): this file's layout is ours to keep.
    """
    lines = text.splitlines()
    start = next((i for i, ln in enumerate(lines) if ln.rstrip() == "jobs:"), None)
    assert start is not None, "ci.yml has no top-level `jobs:` section"
    blocks, name = {}, None
    for ln in lines[start + 1 :]:
        if ln and not ln.startswith(" "):
            break
        m = re.match(r"  ([A-Za-z0-9_-]+):\s*$", ln)
        if m:
            name = m.group(1)
            blocks[name] = []
        elif name:
            blocks[name].append(ln)
    return {k: "\n".join(v) for k, v in blocks.items()}


def step_lines(body):
    """Each step's `uses:`/`run:` line, with the list dash stripped."""
    out = []
    for ln in body.splitlines():
        m = re.match(r"\s*(?:- )?((?:uses|run):\s.*?)\s*$", ln)
        if m:
            out.append(m.group(1))
    return out


if __name__ == "__main__":
    text = WORKFLOW.read_text()

    recipes = matrix_recipes(text)
    assert recipes, "ci.yml's gate matrix lists no recipes"

    # Shared setup: one steps template for every matrix leg, not one copied
    # per job. The gate job's own steps hold each setup step exactly once, and
    # no other job repeats it.
    jobs = job_blocks(text)
    assert "gate" in jobs, f"ci.yml has no `gate` job (jobs: {sorted(jobs)})"
    gate_steps = step_lines(jobs["gate"])
    other_steps = [
        ln for name, body in jobs.items() if name != "gate" for ln in step_lines(body)
    ]
    for step in (
        "uses: actions/checkout@v4",
        "uses: actions/setup-node@v4",
        "run: npm ci",
        "uses: astral-sh/setup-uv@v5",
        "run: uv sync",
    ):
        assert gate_steps.count(step) == 1, (
            f"expected one shared '{step}' step in the gate job, "
            f"found {gate_steps.count(step)}"
        )
        assert step not in other_steps, (
            f"'{step}' is copied into another job; the gate matrix is the one home"
        )

    # `just check` still runs alone on a push to main; the rest are PR-only.
    # The guard has to sit on the Gate *step* -- `matrix` isn't in scope for
    # a job-level `if`, so pin the guard immediately above the line that
    # actually runs `just <recipe>`, not just anywhere in the file (a
    # job-level `if:` -- which GitHub silently mis-evaluates rather than
    # rejects -- would satisfy a bare substring search).
    step_guard = re.search(
        r"if:\s*.*matrix\.recipe == 'check'.*\n\s*run: uvx --from rust-just just \$\{\{ matrix\.recipe \}\}",
        text,
    )
    assert step_guard, (
        "the push-to-main guard must be the `if:` on the Gate step itself, "
        "immediately before `run: uvx --from rust-just just ${{ matrix.recipe }}` -- "
        "a job-level `if:` can't see `matrix` and would skip every leg on push"
    )

    # The coverage claim: running every matrix recipe once, together, must
    # reproduce exactly what `just check-full` runs -- no less (a heavy test
    # dropped off the matrix and never runs in CI) and no more (a recipe
    # counted twice would hide a job that's redundant with another).
    full = set(commands("check-full"))
    split = set()
    for recipe in recipes:
        split |= set(commands(recipe))

    missing = full - split
    assert not missing, f"CI matrix does not run: {sorted(missing)}"

    extra = split - full
    assert not extra, f"CI matrix runs steps check-full does not: {sorted(extra)}"

    print(f"ci_workflow.test.py: {len(recipes)} matrix recipes cover check-full: ok")
