# check-full's heavy groups run as separate CI jobs (a matrix), side by side
# with `just check`. This proves the split without re-implementing YAML
# parsing: the workflow's matrix recipe list is read with a narrow regex
# (this file's format is ours to keep simple), then the actual coverage
# claim is checked the same way gate.test.py checks it -- by running each
# recipe for real through gate_lib.commands() and diffing against
# `just check-full`.
#
#   uv run examples/_shared/ci_workflow.test.py

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).parent))

from gate_lib import commands

WORKFLOW = ROOT / ".github/workflows/ci.yml"


def matrix_lists(text):
    """The matrix's two literal lists: (per-change, scheduled).

    The matrix is one `fromJSON((<events>) && '[...]' || '[...]')` expression, so
    a push or pull request and a scheduled or manual run each get their own
    list. Quoted JSON lists are read with a narrow regex.
    """
    m = re.search(r"recipe:\s*\$\{\{\s*fromJSON\(.*?&&\s*'(\[[^']*\])'\s*\|\|\s*'(\[[^']*\])'", text)
    assert m, "ci.yml has no `recipe: ${{ fromJSON(... && '[..]' || '[..]') }}` matrix"
    return json.loads(m.group(1)), json.loads(m.group(2))


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

    per_change, recipes = matrix_lists(text)
    assert per_change == ["narrowed"], (
        f"a push or pull request runs only the narrowed seam, got {per_change}"
    )
    assert recipes, "ci.yml's scheduled matrix lists no recipes"

    # Triggers: per-change runs on push and pull_request, the full matrix on a
    # nightly cron and by hand. No full run per change (Chris, 2026-10-16).
    for trigger in ("push:", "pull_request:", "schedule:", "workflow_dispatch:"):
        assert re.search(rf"^  {trigger}", text, re.M), f"ci.yml lacks `{trigger}`"
    assert re.search(r"-\s*cron:", text), "ci.yml's schedule has no cron"
    cond = re.search(r"fromJSON\((.*?)&&\s*'\[", text).group(1)
    assert "push" in cond and "pull_request" in cond, (
        "the per-change list must be chosen by the push and pull_request events"
    )

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
        # The seam runner sends wired suites through Pants, and exits 2 on a
        # leg that has none installed.
        "uses: pantsbuild/actions/init-pants@v11",
    ):
        assert gate_steps.count(step) == 1, (
            f"expected one shared '{step}' step in the gate job, "
            f"found {gate_steps.count(step)}"
        )
        assert step not in other_steps, (
            f"'{step}' is copied into another job; the gate matrix is the one home"
        )

    # The narrowed leg runs `tests/all.sh --changed <base>`, the base being the
    # PR base on a pull request and `github.event.before` on a push, and
    # widens to the bare full seam on an all-zeros `before`, saying so.
    assert "bash tests/all.sh --changed" in text, "no narrowed seam run"
    assert "github.base_ref" in text, "a pull request's base is its base_ref"
    assert "github.event.before" in text, "a push's base is github.event.before"
    assert "0000000000000000000000000000000000000000" in text, (
        "an all-zeros `before` must widen to the full seam"
    )
    assert re.search(r"widen", text, re.I), "the widening must be said in the step log"
    # The run log is a path the job uploads, so CI runs are counted (#845).
    assert "SEAM_RUNS_LOG" in text and "actions/upload-artifact" in text, (
        "the job must set SEAM_RUNS_LOG and upload it"
    )
    # Each recipe step guards on the matrix leg, not on the job.
    assert re.search(
        r"if:\s*matrix\.recipe != 'narrowed'.*\n\s*run: uvx --from rust-just just \$\{\{ matrix\.recipe \}\}",
        text,
    ), "the recipe step must be guarded by `matrix.recipe != 'narrowed'`"

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

    print(f"ci_workflow.test.py: {len(recipes)} scheduled recipes cover check-full: ok")
