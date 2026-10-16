# CI's gate: a push or pull request runs one `narrowed` leg (`bash tests/all.sh
# --changed <base>`), and the full `check-full` coverage runs nightly as four
# legs (and by hand). This proves both without a YAML parser (this file's
# layout is ours to keep simple) and without trusting text a comment could
# supply: comment lines are dropped first, the matrix expression is evaluated
# for each event, each step's `if:` guard is read, and the Narrowed seam step's
# script is run for real against a stub `tests/all.sh` for each kind of base.
# The coverage claim is checked the way gate.test.py checks it -- by running
# each scheduled recipe through gate_lib.commands() and diffing against
# `just check-full`.
#
#   uv run examples/_shared/ci_workflow.test.py

import json
import os
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).parent))

from gate_lib import commands

WORKFLOW = ROOT / ".github/workflows/ci.yml"


ZEROS = "0" * 40
EVENTS = ("push", "pull_request", "schedule", "workflow_dispatch")


def code_of(text):
    """The workflow without its full-line comments."""
    return "\n".join(ln for ln in text.splitlines() if not ln.lstrip().startswith("#"))


def matrix_for(text, event):
    """The `recipe` list the matrix expression yields for an event.

    The expression is `fromJSON(<cond> && '[..]' || '[..]')`; GitHub's `&&`
    and `||` return their operands like Python's `and` and `or`, so the
    expression is evaluated as Python with the event comparisons filled in.
    """
    m = re.search(r"recipe:\s*\$\{\{\s*fromJSON\((.*)\)\s*\}\}", text)
    assert m, "ci.yml has no `recipe: ${{ fromJSON(...) }}` matrix"
    expr = re.sub(
        r"github\.event_name == '(\w+)'",
        lambda g: str(g.group(1) == event),
        m.group(1),
    )
    assert re.fullmatch(r"[\w\s()&|'\[\]\",-]*", expr), f"unreadable matrix: {expr}"
    return json.loads(eval(expr.replace("&&", " and ").replace("||", " or ")))


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


def steps_of(body):
    """The job's steps as dicts of `name`, `if`, `uses`, `run`, `env`, `with`.

    A step starts at a `      - ` line; a key holds its inline value, or for
    a `|` block, `env:` and `with:` the more-indented lines under it.
    """
    steps, cur, key = [], None, None
    for ln in body.splitlines():
        m = re.match(r"      - (\w+):\s*(.*)$", ln)
        if m:
            cur = {}
            steps.append(cur)
            key, cur[m.group(1)] = m.group(1), m.group(2)
            continue
        m = re.match(r"        (\w+):\s*(.*)$", ln)
        if m and cur is not None:
            key, cur[m.group(1)] = m.group(1), m.group(2)
        elif cur is not None and key and ln.startswith("          "):
            cur[key] = cur[key].removeprefix("|") + "\n" + ln[10:]
    return steps


def step(steps, name):
    found = [s for s in steps if s.get("name", "").startswith(name)]
    assert len(found) == 1, f"expected one '{name}' step, found {len(found)}"
    return found[0]


def run_narrowed(script, event, base_ref, before):
    """Run the Narrowed seam script against a stub `tests/all.sh`; the stub
    prints its argv, so what the script chose to call is the output."""
    with tempfile.TemporaryDirectory() as d:
        env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}

        def git(*a):
            return subprocess.run(
                ["git", *a], cwd=d, env=env, check=True, capture_output=True, text=True
            ).stdout.strip()

        git("init", "-q")
        git("config", "user.email", "t@example.com")
        git("config", "user.name", "t")
        (pathlib.Path(d) / "tests").mkdir()
        (pathlib.Path(d) / "tests/all.sh").write_text('echo "ALL $*"\n')
        git("add", "-A")
        git("commit", "-qm", "base")
        head = git("rev-parse", "HEAD")
        git("update-ref", "refs/remotes/origin/main", head)
        env.update(BASE_REF=base_ref, BEFORE=before.replace("<HEAD>", head))
        out = subprocess.run(
            ["bash", "-c", script.replace("${{ github.event_name }}", event)],
            cwd=d,
            env=env,
            capture_output=True,
            text=True,
        )
        assert out.returncode == 0, f"{event}: {out.stderr}"
        return out.stdout, head


if __name__ == "__main__":
    raw = WORKFLOW.read_text()
    text = code_of(raw)

    # Triggers: per-change runs on push and pull_request, the full matrix on a
    # nightly cron and by hand. No full run per change (Chris, 2026-10-16).
    for trigger in ("push:", "pull_request:", "schedule:", "workflow_dispatch:"):
        assert re.search(rf"^  {trigger}", text, re.M), f"ci.yml lacks `{trigger}`"
    assert re.search(r"-\s*cron:", text), "ci.yml's schedule has no cron"

    # What each event runs: one narrowed leg per change, the full recipes else.
    for event in ("push", "pull_request"):
        assert matrix_for(text, event) == ["narrowed"], (
            f"a {event} must run only the narrowed leg, got {matrix_for(text, event)}"
        )
    recipes = matrix_for(text, "schedule")
    assert recipes == matrix_for(text, "workflow_dispatch") and recipes, (
        "a scheduled and a hand run must run the same, non-empty, full recipe list"
    )
    assert "narrowed" not in recipes, (
        "the full run is the recipes, not the narrowed leg"
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
    for shared in (
        "uses: actions/checkout@v4",
        "uses: actions/setup-node@v4",
        "run: npm ci",
        "uses: astral-sh/setup-uv@v5",
        "run: uv sync",
        # The seam runner sends wired suites through Pants, and exits 2 on a
        # leg that has none installed.
        "uses: pantsbuild/actions/init-pants@v11",
    ):
        assert gate_steps.count(shared) == 1, (
            f"expected one shared '{shared}' step in the gate job, "
            f"found {gate_steps.count(shared)}"
        )
        assert shared not in other_steps, (
            f"'{shared}' is copied into another job; the gate matrix is the one home"
        )

    # Each leg-specific step guards on its own leg.
    steps = steps_of(jobs["gate"])
    narrowed = step(steps, "Narrowed seam")
    assert narrowed["if"] == "matrix.recipe == 'narrowed'", narrowed["if"]
    recipe_step = step(steps, "Gate (")
    assert recipe_step["if"] == "matrix.recipe != 'narrowed'", recipe_step["if"]
    assert recipe_step["run"] == "uvx --from rust-just just ${{ matrix.recipe }}"
    chromium = step(steps, "Install Chromium")
    for leg in ("check", "narrowed"):
        assert f"matrix.recipe == '{leg}'" in chromium["if"], (
            f"the {leg} leg can run app-session.test.mjs and needs Chromium"
        )

    # The run log of every leg lands at one path the job uploads (#845).
    pointed = step(steps, "Point the seam run log")["run"]
    m = re.search(r'SEAM_RUNS_LOG=\$RUNNER_TEMP/(\S+?)" >> "\$GITHUB_ENV"', pointed)
    assert m, f"no step sets SEAM_RUNS_LOG through GITHUB_ENV: {pointed}"
    upload = step(steps, "Upload seam run log")
    assert upload["if"] == "always()" and "actions/upload-artifact" in upload["uses"]
    assert upload["with"].count("path: ${{ runner.temp }}/" + m.group(1)) == 1, (
        "the upload must read the path SEAM_RUNS_LOG points at"
    )
    assert "if-no-files-found" not in upload["with"], (
        "a leg that wrote no run log must warn (the default), not pass silently"
    )

    # The narrowed leg's script, run for real: the base is the PR base on a
    # pull request and `before` on a push; an all-zeros or unknown `before`
    # widens to the bare full seam and says so in the log.
    script = narrowed["run"]
    out, head = run_narrowed(script, "pull_request", "main", "")
    assert out.strip() == "ALL --changed origin/main", out
    out, head = run_narrowed(script, "push", "", "<HEAD>")
    assert out.strip() == f"ALL --changed {head}", out
    for before in (ZEROS, "1" * 40):
        out, head = run_narrowed(script, "push", "", before)
        assert out.splitlines()[-1] == "ALL ", (
            f"no usable base must run the full seam: {out}"
        )
        assert "widening to the full seam" in out, (
            f"the widening must be in the log: {out}"
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

    print(f"ci_workflow.test.py: {len(recipes)} scheduled recipes cover check-full: ok")
