# The seam runner, `tests/all.sh`: the one listing of the gate's suites, which
# the justfile's recipes and a worker's narrowed run both read. Checked at its
# own interface -- a tree in, a list of suites out; a run's exit status and
# last line -- on the real tree and on scratch trees built here.
#
#   uv run examples/_shared/seam_runner.test.py

import os
import pathlib
import re
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).parent))

from gate_lib import commands, gate_tree, run_stubbed
from gate_lib import runner_listing as listing

RUNNER = "tests/all.sh"


def full_listing_is_check_full():
    """With no flag the runner covers exactly the steps `just check-full` runs."""
    listed = listing()
    full = commands("check-full")
    assert len(listed) == len(set(listed)), "tests/all.sh --list repeats a suite"
    missing = set(full) - set(listed)
    assert not missing, f"tests/all.sh does not run: {sorted(missing)}"
    extra = set(listed) - set(full)
    assert not extra, f"tests/all.sh runs steps check-full does not: {sorted(extra)}"
    return len(listed)


TIERS = ["lint", "test", "heavy-fillomino", "heavy-recovery", "soundness"]

# A stand-in for the runner that logs how it was called and runs nothing.
LOGGING_RUNNER = '#!/bin/sh\necho "all.sh $*" >> "$GATE_LOG"\n'


def the_recipes_call_the_runner():
    """The justfile keeps no listing of its own: `just check-full` is the
    runner called once per tier, the tiers split the whole seam with no suite
    in two of them, and the slow finder tests are a tier outside it."""
    whole = listing()
    split = [suite for tier in TIERS for suite in listing("--tier", tier)]
    assert sorted(split) == sorted(whole), "the tiers do not split the whole seam"

    with tempfile.TemporaryDirectory() as tmp:
        tree = gate_tree(tmp)
        (tree / RUNNER).write_text(LOGGING_RUNNER)
        assert commands("check-full", root=tree) == [
            f"all.sh --tier {tier}" for tier in TIERS
        ], "just check-full runs something other than the runner's tiers"
        assert commands("test-finders-slow", root=tree) == [
            "all.sh --tier finders-slow"
        ]

    with tempfile.TemporaryDirectory() as tmp:
        tree = scratch_tree(tmp, dict.fromkeys(FIXTURE, ""))
        assert listing("--tier", "finders-slow", root=tree) == [
            "uv run finders/renbanana/tools/test_probe_circle_pattern_accepts_known_grids.py",
            "uv run finders/renbanana/tools/test_probe_finds_known_grids.py",
            "uv run finders/renbanana/tools/test_prove_two_stage_slow.py",
        ]
        r, ran = run_stubbed(["bash", RUNNER, "--tier", "soundness"], root=tree)
        assert ran == [c for c in WHOLE if c.endswith("soundness-harness.mjs")], ran
        assert r.stdout.splitlines()[-1] == "3 of 3 suites passed (tier: soundness)"

        r = subprocess.run(
            ["bash", RUNNER, "--tier", "fast"], cwd=tree, capture_output=True, text=True
        )
        assert r.returncode == 2, f"an unknown tier exits {r.returncode}, not 2"
        assert "no tier named fast" in r.stderr, r.stderr


def scratch_tree(tmp, files):
    """A tree holding the gate and `files` (path -> text), nothing else."""
    tree = gate_tree(tmp)
    for rel, text in files.items():
        (tree / rel).parent.mkdir(parents=True, exist_ok=True)
        (tree / rel).write_text(text)
    return tree


def a_run_covers_its_listing():
    """A run executes the suites `--list` names, in that order, and its last
    line counts them."""
    listed = listing()
    r, ran = run_stubbed(["bash", RUNNER])
    assert r.returncode == 0, f"a stubbed full run failed:\n{r.stdout}{r.stderr}"
    assert ran == listed, "a full run does not execute its own --list, in order"
    last = r.stdout.splitlines()[-1]
    assert last == f"{len(listed)} of {len(listed)} suites passed", last


def a_failing_suite_stops_the_run():
    """The first failing suite ends the run non-zero with its output shown, and
    no later suite starts."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = scratch_tree(
            tmp,
            {
                "examples/aa/first.test.mjs": "console.log('first ran')\n",
                "examples/aa/second.test.mjs": (
                    "console.log('planted reason 797')\nprocess.exit(3)\n"
                ),
                "examples/bb/third.test.mjs": "console.log('third ran')\n",
            },
        )
        r, _ = run_stubbed(["bash", RUNNER], root=tree, real=("node",))
        out = r.stdout.splitlines()
        assert r.returncode == 1, f"exit {r.returncode}, not 1:\n{r.stdout}{r.stderr}"
        assert "PASS node examples/aa/first.test.mjs" in out, r.stdout
        assert "FAIL node examples/aa/second.test.mjs" in out, r.stdout
        assert "planted reason 797" in out, "the failing suite's output is not shown"
        assert "first ran" not in out, "a passing suite's output is shown"
        assert not any("third" in line for line in out), "a suite ran after the failure"
        total = len(listing(root=tree))
        passed = out.index("FAIL node examples/aa/second.test.mjs")
        assert out[-1] == (
            f"{passed} of {total} suites passed before "
            "node examples/aa/second.test.mjs failed"
        ), out[-1]


LINT = [
    "npx standard",
    "uvx ruff check examples",
    "uvx ruff check finders",
    "uvx ruff format --check examples",
    "uvx ruff format --check finders",
    "uv lock --check",
]

# What every narrowed run of the fixture keeps: lint and the shared checks.
ALWAYS = [
    *LINT,
    "uv run examples/_shared/s.test.py",
    "uv run examples/_shared/check_layout.py",
]

AA = ["node examples/aa/a.test.mjs", "node examples/aa/soundness-harness.mjs"]
BB = ["uv run examples/bb/b.test.py", "node examples/bb/soundness-harness.mjs"]
FILLOMINO = [
    "node examples/fillomino/x.test.mjs",
    "uv run examples/fillomino/pipeline.test.py",
    "uv run examples/fillomino/generate.test.py",
    "node examples/fillomino/soundness-harness.mjs",
]
# Named by path in the runner, so they are in every tree's seam.
SKYSCRAPER = [
    "uv run examples/skyscraper/verify.py",
    "node examples/skyscraper/recovery-probe.test.mjs",
]
HIT_COUNTS = ["node examples/hit-counts/recovery-probe.test.mjs"]
FF = ["uv run finders/ff/test_f.py", "uv run finders/ff/deep/test_g.py"]
GG = ["uv run finders/gg/test_h.py"]
HUNT = ["uv run finders/hunt/test_hunt.py"]
COUNTING = ["uv run pytest finders/counting_shaded/test_counting_shaded.py -q"]
RENBANANA = ["uv run finders/renbanana/tools/test_probe_finds_known_grids.py --cover"]

# The fixture's whole seam. The slow renbanana test is in the tree and in no run.
WHOLE = (
    ALWAYS
    + AA
    + BB
    + FILLOMINO
    + FF
    + GG
    + HUNT
    + COUNTING
    + RENBANANA
    + SKYSCRAPER
    + HIT_COUNTS
)

FIXTURE = [
    "justfile",
    "uv.lock",
    "docs/notes.md",
    "docs/research/data.json",
    "examples/_shared/s.test.py",
    "examples/_shared/lib.py",
    "examples/aa/a.test.mjs",
    "examples/aa/soundness-harness.mjs",
    "examples/aa/README.md",
    "examples/bb/b.test.py",
    "examples/bb/soundness-harness.mjs",
    "examples/fillomino/x.test.mjs",
    "examples/fillomino/pipeline.test.py",
    "examples/fillomino/generate.test.py",
    "examples/fillomino/soundness-harness.mjs",
    "examples/skyscraper/recovery-probe.test.mjs",
    "examples/hit-counts/recovery-probe.test.mjs",
    "finders/top.py",
    "finders/ff/test_f.py",
    "finders/ff/deep/test_g.py",
    "finders/gg/test_h.py",
    "finders/hunt/test_hunt.py",
    "finders/counting_shaded/test_counting_shaded.py",
    "finders/renbanana/tools/test_prove_two_stage_slow.py",
    "finders/renbanana/tools/test_probe_finds_known_grids.py",
]

# A diff (the files one commit adds or edits) and the suites it must select.
NARROWED = [
    (["finders/ff/deep/model.py"], ALWAYS + FF),
    (["finders/counting_shaded/filter.c"], ALWAYS + COUNTING),
    (["finders/renbanana/tools/probe.py"], ALWAYS + RENBANANA),
    (["examples/fillomino/Component.js"], ALWAYS + FILLOMINO),
    (["examples/skyscraper/SkyscraperComponent.js"], ALWAYS + SKYSCRAPER),
    (["examples/aa/README.md", "finders/gg/notes.md"], ALWAYS + AA + GG),
    (
        ["examples/bb/new.test.mjs", "finders/gg/test_new.py"],
        ALWAYS
        + BB
        + GG
        + ["node examples/bb/new.test.mjs", "uv run finders/gg/test_new.py"],
    ),
    (["examples/_shared/s.test.py"], ALWAYS),
    (["docs/notes.md", "README.md", "finders/AGENTS.md"], ALWAYS),
    ([], ALWAYS),
]

# A diff that widens to the whole seam, and the reason the last line gives.
WIDENED = [
    (
        ["examples/_shared/lib.py"],
        "shared example code changed: examples/_shared/lib.py",
    ),
    (["finders/hunt/driver.py"], "finders/hunt/ changed: finders/hunt/driver.py"),
    (["justfile"], "every suite depends on justfile"),
    (["uv.lock"], "every suite depends on uv.lock"),
    (["tests/all.sh"], "every suite depends on tests/all.sh"),
    (["tests/suite-edges.txt"], "every suite depends on tests/suite-edges.txt"),
    (["docs/research/data.json"], "no rule places docs/research/data.json"),
    (["finders/top.py", "finders/ff/x.py"], "no rule places finders/top.py"),
]


EDGES = "tests/suite-edges.txt"

# Scan hits that are not a read of the other directory, each with its reason.
NOT_EDGES = {
    # A rules-text test's list of jargon words the text must not contain.
    ("examples/dutch-flatmates", "examples/isofill"),
}


def edges(root=ROOT):
    """The (directory read, unit that reads it) pairs the runner widens by."""
    lines = (root / EDGES).read_text().splitlines()
    return {tuple(ln.split()[:2]) for ln in lines if ln.strip() and ln[0] != "#"}


def cross_unit_reads():
    """(unit, other unit) for every tracked code line under an example or a
    finder that names another one's directory: a relative or repo path into
    it, or its bare name as a string. Comment lines are skipped, `#include`
    directives are not. finders/hunt/ and examples/_shared/ are not targets:
    a change to either runs the whole seam."""
    tracked = subprocess.run(
        ["git", "ls-files", "examples", "finders"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.splitlines()
    units = sorted({"/".join(f.split("/")[:2]) for f in tracked if f.count("/") >= 2})
    targets = {
        u: re.compile(
            r"(\.\./|examples/|finders/)%s/|[\"']%s[\"']"
            % ((re.escape(u.split("/")[1]),) * 2)
        )
        for u in units
        if u not in ("examples/_shared", "finders/hunt")
    }
    found = set()
    for f in tracked:
        unit = "/".join(f.split("/")[:2])
        if unit not in units or unit == "examples/_shared":
            continue
        if not f.endswith((".py", ".mjs", ".js")):
            continue
        for line in (ROOT / f).read_text(encoding="utf-8").splitlines():
            text = line.strip()
            if text.startswith(("#", "//")) and "#include" not in text:
                continue
            found |= {
                (unit, u) for u, rx in targets.items() if u != unit and rx.search(line)
            }
    return found


def every_cross_unit_read_is_an_edge():
    """A suite that reads another example's or finder's files runs when that
    directory changes: every such read the scan finds is listed in
    tests/suite-edges.txt, and every listed edge names two directories."""
    listed = edges()
    stale = sorted(d for edge in listed for d in edge if not (ROOT / d).is_dir())
    assert not stale, f"{EDGES} names directories that do not exist: {stale}"
    unlisted = sorted(
        (read, unit)
        for unit, read in cross_unit_reads() - NOT_EDGES
        if (read, unit) not in listed
    )
    assert not unlisted, (
        f"a unit reads another's directory with no line in {EDGES} "
        f"(as '<directory read> <unit>'), or in NOT_EDGES here: {unlisted}"
    )


def agents_md_names_both_commands():
    """AGENTS.md § End-to-end seam keeps the Seam and Blind-to lines other
    skills read, and names the narrowed command beside them."""
    text = (ROOT / "AGENTS.md").read_text()
    section = text.split("## End-to-end seam\n", 1)[1].split("\n## ", 1)[0]
    lines = section.splitlines()
    assert "- **Seam**: `just check-full`" in lines, section
    assert any(ln.startswith("- **Blind to**: the app") for ln in lines), section
    assert any(
        ln.startswith("- **Narrowed**: `bash tests/all.sh --changed origin/main`")
        for ln in lines
    ), section


def git(tree, *args):
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    for who in ("AUTHOR", "COMMITTER"):
        env[f"GIT_{who}_NAME"] = "fixture"
        env[f"GIT_{who}_EMAIL"] = "fixture@example.invalid"
    r = subprocess.run(
        ["git", *args], cwd=tree, env=env, capture_output=True, text=True
    )
    assert r.returncode == 0, f"git {args} failed in the fixture:\n{r.stderr}"
    return r.stdout.strip()


def with_diff(tree, changed):
    """Commit an edit to each of `changed` on top of the fixture's base."""
    git(tree, "reset", "-q", "--hard", "base")
    git(tree, "clean", "-qfd")
    for rel in changed:
        (tree / rel).parent.mkdir(parents=True, exist_ok=True)
        with (tree / rel).open("a") as f:
            f.write("# changed\n")
    git(tree, "add", "-A")
    git(tree, "commit", "-q", "--allow-empty", "-m", "change")


def a_diff_selects_its_suites():
    """`--changed <base>` keeps lint, the shared checks and the suites of each
    example and finder the diff touches; it widens to the whole seam when the
    diff touches what every suite depends on or a path no rule places; and the
    run's last line names the units or the reason."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = scratch_tree(tmp, dict.fromkeys(FIXTURE, ""))
        git(tree, "init", "-q")
        git(tree, "add", "-A")
        git(tree, "commit", "-q", "-m", "base")
        git(tree, "tag", "base")
        assert sorted(listing(root=tree)) == sorted(WHOLE), listing(root=tree)

        for changed, want in NARROWED:
            with_diff(tree, changed)
            got = listing("--changed", "base", root=tree)
            assert sorted(got) == sorted(want), f"{changed} selects {got}"
        for changed, _ in WIDENED:
            with_diff(tree, changed)
            got = listing("--changed", "base", root=tree)
            assert sorted(got) == sorted(WHOLE), f"{changed} selects {got}"

        def last_line(changed):
            with_diff(tree, changed)
            r, ran = run_stubbed(["bash", RUNNER, "--changed", "base"], root=tree)
            assert r.returncode == 0, f"{changed}:\n{r.stdout}{r.stderr}"
            assert ran == listing("--changed", "base", root=tree), changed
            return r.stdout.splitlines()[-1]

        (tree / EDGES).write_text("# a comment\nexamples/aa finders/gg  why\n")
        git(tree, "add", "-A")
        git(tree, "commit", "-q", "-m", "an edge")
        git(tree, "tag", "-f", "base")
        with_diff(tree, ["examples/aa/Component.js"])
        got = listing("--changed", "base", root=tree)
        assert sorted(got) == sorted(ALWAYS + AA + GG), f"an edge selects {got}"
        with_diff(tree, ["finders/gg/x.py"])
        got = listing("--changed", "base", root=tree)
        assert sorted(got) == sorted(ALWAYS + GG), f"an edge runs backwards: {got}"

        m = len(WHOLE)
        got = last_line(["finders/ff/x.py", "examples/bb/y.js"])
        assert got == (
            f"{len(ALWAYS + BB + FF)} of {m} suites passed "
            "(narrowed: examples/bb finders/ff)"
        ), got
        assert last_line(["docs/notes.md"]) == (
            f"{len(ALWAYS)} of {m} suites passed (narrowed: no example or finder touched)"
        )
        for changed, why in WIDENED:
            got = last_line(changed)
            assert got == f"{m} of {m} suites passed (widened: {why})", got

        r = subprocess.run(
            ["bash", RUNNER, "--changed", "no-such-ref"],
            cwd=tree,
            capture_output=True,
            text=True,
        )
        assert r.returncode == 2, f"an unreadable base exits {r.returncode}, not 2"
        assert "cannot diff no-such-ref...HEAD" in r.stderr, r.stderr


if __name__ == "__main__":
    n = full_listing_is_check_full()
    a_diff_selects_its_suites()
    the_recipes_call_the_runner()
    every_cross_unit_read_is_an_edge()
    agents_md_names_both_commands()
    a_run_covers_its_listing()
    a_failing_suite_stops_the_run()
    print(f"seam_runner.test.py: {n} suites: ok")
