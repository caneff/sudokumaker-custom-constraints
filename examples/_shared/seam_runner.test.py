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


GROUPS = ["lint", "test", "heavy-fillomino", "heavy-recovery", "soundness"]

# A stand-in for the runner that logs how it was called and runs nothing.
LOGGING_RUNNER = '#!/bin/sh\necho "all.sh $*" >> "$GATE_LOG"\n'


def the_recipes_call_the_runner():
    """The justfile keeps no listing of its own: `just check-full` is the
    runner called once per group, the groups split the whole seam with no suite
    in two of them, and the slow finder tests are a group outside it."""
    whole = listing()
    split = [suite for group in GROUPS for suite in listing("--group", group)]
    assert sorted(split) == sorted(whole), "the groups do not split the whole seam"

    with tempfile.TemporaryDirectory() as tmp:
        tree = gate_tree(tmp)
        (tree / RUNNER).write_text(LOGGING_RUNNER)
        assert commands("check-full", root=tree) == [
            f"all.sh --group {group}" for group in GROUPS
        ], "just check-full runs something other than the runner's groups"
        assert commands("test-finders-slow", root=tree) == [
            "all.sh --group finders-slow"
        ]

    with tempfile.TemporaryDirectory() as tmp:
        tree = scratch_tree(tmp, dict.fromkeys(FIXTURE, ""))
        assert listing("--group", "finders-slow", root=tree) == [
            "uv run finders/renbanana/tools/test_probe_circle_pattern_accepts_known_grids.py",
            "uv run finders/renbanana/tools/test_probe_finds_known_grids.py",
            "uv run finders/renbanana/tools/test_prove_two_stage_slow.py",
        ]
        r, ran = run_stubbed(["bash", RUNNER, "--group", "soundness"], root=tree)
        assert ran == [c for c in WHOLE if c.endswith("soundness-harness.mjs")], ran
        assert r.stdout.splitlines()[-1] == "3 of 3 suites passed (group: soundness)"

        bare = gate_tree(tempfile.mkdtemp(dir=tmp))
        r, ran = run_stubbed(["bash", RUNNER, "--group", "soundness"], root=bare)
        assert (r.returncode, ran) == (0, []), f"a group with no suite:\n{r.stderr}"
        assert r.stdout.splitlines()[-1] == "0 of 0 suites passed (group: soundness)"

        assert "no group named fast" in refusal(tree, "--group", "fast")
        assert "no group named lint test" in refusal(tree, "--group", "lint test")
        assert "--frobnicate" in refusal(tree, "--frobnicate")
        assert "--changed needs a value" in refusal(tree, "--list", "--changed")


def refusal(tree, *args):
    """What the runner says on stderr when it refuses `args` with exit 2."""
    r = subprocess.run(
        ["bash", RUNNER, *args], cwd=tree, capture_output=True, text=True
    )
    assert r.returncode == 2, (
        f"{args} exits {r.returncode}, not 2:\n{r.stdout}{r.stderr}"
    )
    assert not r.stdout, f"a refused run printed a listing: {r.stdout}"
    return r.stderr


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
    assert len(listed) == len(set(listed)), "tests/all.sh --list repeats a suite"
    r, ran = run_stubbed(["bash", RUNNER])
    assert r.returncode == 0, f"a stubbed full run failed:\n{r.stdout}{r.stderr}"
    assert ran == listed, "a full run does not execute its own --list, in order"
    last = r.stdout.splitlines()[-1]
    assert last == f"{len(listed)} of {len(listed)} suites passed", last
    return len(listed)


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

# What every narrowed run of the fixture keeps: lint and the tree checks.
ALWAYS = [
    *LINT,
    "uv run examples/_shared/gate.test.py",
    "uv run examples/_shared/check_layout.py",
]
# The fixture's shared example-code test: in every narrowed run but one whose
# diff lies wholly inside finders.
SHARED = ["uv run examples/_shared/s.test.py"]

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
    + SHARED
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
    "docs/boards/data.json",
    "examples/_shared/s.test.py",
    "examples/_shared/gate.test.py",
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
    (["finders/ff/x.py", "finders/gg/notes.md"], ALWAYS + FF + GG),
    (["examples/fillomino/Component.js"], ALWAYS + SHARED + FILLOMINO),
    (["examples/skyscraper/SkyscraperComponent.js"], ALWAYS + SHARED + SKYSCRAPER),
    (["examples/aa/README.md", "finders/gg/notes.md"], ALWAYS + SHARED + AA + GG),
    (
        ["examples/bb/new.test.mjs", "finders/gg/test_new.py"],
        ALWAYS
        + SHARED
        + BB
        + GG
        + ["node examples/bb/new.test.mjs", "uv run finders/gg/test_new.py"],
    ),
    (["examples/_shared/s.test.py"], ALWAYS + SHARED),
    (["examples/_shared/gate.test.py"], ALWAYS + SHARED),
    (["docs/notes.md", "README.md", "finders/AGENTS.md"], ALWAYS + SHARED),
    (["finders/ff/x.py", "docs/notes.md"], ALWAYS + SHARED + FF),
    ([], ALWAYS + SHARED),
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
    (["tests/tree-checks.txt"], "every suite depends on tests/tree-checks.txt"),
    (["docs/boards/data.json"], "no rule places docs/boards/data.json"),
    (["docs/two words.md"], "no rule places docs/two words.md"),
    (
        ["docs/builtin-components.md"],
        "every suite depends on docs/builtin-components.md",
    ),
    (["finders/top.py", "finders/ff/x.py"], "no rule places finders/top.py"),
]


EDGES = "tests/suite-edges.txt"

# Scan hits that are not a read of the other directory, each with its reason.
NOT_EDGES = {
    # A rules-text test's list of jargon words the text must not contain.
    ("examples/dutch-flatmates", "examples/isofill"),
}


def edges():
    """The (directory read, unit that reads it) pairs the runner widens by."""
    pairs = set()
    for line in (ROOT / EDGES).read_text().splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        fields = line.split()
        assert len(fields) >= 2, f"{EDGES}: not '<directory read> <unit>': {line}"
        pairs.add((fields[0], fields[1]))
    return pairs


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


TREE_CHECKS = "tests/tree-checks.txt"

# What marks a shared test as reading the tree outside examples/: a path under
# finders/, the gate helpers, or a git command.
READS_TREE = re.compile(r"""finders/|gate_lib|["']git["']""")

# Shared tests the scan hits that no finder change can break, each with its
# reason.
NOT_TREE_CHECKS = {
    "examples/_shared/check_layout.test.py": (
        "names finders/ only in the text of a violation it asserts on a scratch tree"
    ),
    "examples/_shared/spec_649_closing.test.py": (
        "its git call lists examples/, docs/ and package.json, nothing in finders/"
    ),
    "examples/_shared/time_example.test.py": "its git calls build a scratch repo",
    "examples/_shared/harness-lib.test.mjs": "its git calls build a scratch repo",
}


def tree_checks():
    """The files tests/tree-checks.txt names, in order."""
    lines = (ROOT / TREE_CHECKS).read_text().splitlines()
    return [ln.split()[0] for ln in lines if ln.strip() and not ln.startswith("#")]


def shared_suites():
    """{file: suite} for every suite the runner runs from examples/_shared/."""
    return {
        suite.split()[-1]: suite for suite in listing() if "examples/_shared/" in suite
    }


def every_shared_test_has_a_class():
    """A shared test is a tree check, listed in tests/tree-checks.txt, or a
    shared example-code test. One whose own text reads the tree outside
    examples/ (READS_TREE; the code it imports is not scanned) is listed there
    or in NOT_TREE_CHECKS here, and neither list names a file that is gone. On
    the real tree's file names, a diff inside finders/ubahn/ selects lint, the
    tree checks and the U-Bahn tests, and a diff inside one example selects
    every shared test."""
    shared = shared_suites()
    tree = tree_checks()
    assert len(tree) == len(set(tree)), f"{TREE_CHECKS} repeats a file"
    stale = sorted(f for f in [*tree, *NOT_TREE_CHECKS] if f not in shared)
    assert not stale, (
        f"{TREE_CHECKS} or NOT_TREE_CHECKS names a file that is not a shared "
        f"suite: {stale}"
    )
    both = sorted(set(tree) & set(NOT_TREE_CHECKS))
    assert not both, f"in {TREE_CHECKS} and in NOT_TREE_CHECKS: {both}"
    reads = {f for f in shared if READS_TREE.search((ROOT / f).read_text("utf-8"))}
    unclassed = sorted(reads - set(tree) - set(NOT_TREE_CHECKS))
    assert not unclassed, (
        f"a shared test reads the tree outside examples/ and is in neither "
        f"{TREE_CHECKS} nor NOT_TREE_CHECKS here: {unclassed}"
    )
    idle = sorted(set(NOT_TREE_CHECKS) - reads)
    assert not idle, f"NOT_TREE_CHECKS names a file the scan does not hit: {idle}"

    whole = listing()
    ubahn = [suite for suite in whole if "finders/ubahn/" in suite]
    example = [suite for suite in whole if "examples/up-to-n/" in suite]
    assert len(ubahn) == 5 and example, (ubahn, example)
    with tempfile.TemporaryDirectory() as tmp:
        files = [suite.split()[-1] for suite in whole if "/" in suite.split()[-1]]
        tree_dir = scratch_tree(tmp, dict.fromkeys(files, ""))
        git(tree_dir, "init", "-q")
        git(tree_dir, "add", "-A")
        git(tree_dir, "commit", "-q", "-m", "base")
        git(tree_dir, "tag", "base")
        with_diff(tree_dir, ["finders/ubahn/model.py"])
        got = listing("--changed", "base", root=tree_dir)
        want = LINT + [shared[f] for f in tree] + ubahn
        assert sorted(got) == sorted(want), f"a U-Bahn diff selects {got}"
        with_diff(tree_dir, ["examples/up-to-n/Component.js"])
        got = listing("--changed", "base", root=tree_dir)
        want = LINT + list(shared.values()) + example
        assert sorted(got) == sorted(want), f"an example diff selects {got}"


def agents_md_names_both_commands():
    """AGENTS.md § End-to-end seam keeps the Seam and Blind-to lines other
    skills read, names the narrowed command beside them, and says what a
    finder-only run covers."""
    text = (ROOT / "AGENTS.md").read_text()
    section = text.split("## End-to-end seam\n", 1)[1].split("\n## ", 1)[0]
    lines = section.splitlines()
    assert "- **Seam**: `just check-full`" in lines, section
    assert any(ln.startswith("- **Blind to**: the app") for ln in lines), section
    narrowed = [
        ln
        for ln in lines
        if ln.startswith("- **Narrowed**: `bash tests/all.sh --changed origin/main`")
    ]
    assert len(narrowed) == 1, section
    assert "finder-only" in narrowed[0] and TREE_CHECKS in narrowed[0], (
        f"the Narrowed line does not say what a finder-only run covers: {narrowed[0]}"
    )


def git(tree, *args):
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    for who in ("AUTHOR", "COMMITTER"):
        env[f"GIT_{who}_NAME"] = "fixture"
        env[f"GIT_{who}_EMAIL"] = "fixture@example.invalid"
    r = subprocess.run(
        ["git", *args], cwd=tree, env=env, capture_output=True, text=True
    )
    assert r.returncode == 0, f"git {args} failed in the fixture:\n{r.stderr}"


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
    """`--changed <base>` keeps lint, the tree checks and the suites of each
    example and finder the diff touches, and the shared example-code tests
    unless the diff lies wholly inside finders; it widens to the whole seam when the
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

        (tree / EDGES).write_text("# a comment\nexamples/aa finders/gg  why")
        git(tree, "add", "-A")
        git(tree, "commit", "-q", "-m", "an edge")
        git(tree, "tag", "-f", "base")
        with_diff(tree, ["examples/aa/Component.js"])
        got = listing("--changed", "base", root=tree)
        assert sorted(got) == sorted(ALWAYS + SHARED + AA + GG), (
            f"an edge selects {got}"
        )
        with_diff(tree, ["finders/gg/x.py"])
        got = listing("--changed", "base", root=tree)
        assert sorted(got) == sorted(ALWAYS + GG), f"an edge runs backwards: {got}"

        m = len(WHOLE)
        got = last_line(["finders/ff/x.py", "examples/bb/y.js"])
        assert got == (
            f"{len(ALWAYS + SHARED + BB + FF)} of {m} suites passed "
            "(narrowed: examples/bb finders/ff)"
        ), got
        got = last_line(["finders/ff/x.py"])
        assert got == (
            f"{len(ALWAYS + FF)} of {m} suites passed (narrowed: finders/ff)"
        ), got
        assert last_line(["docs/notes.md"]) == (
            f"{len(ALWAYS + SHARED)} of {m} suites passed "
            "(narrowed: no example or finder touched)"
        )
        for changed, why in WIDENED:
            got = last_line(changed)
            assert got == f"{m} of {m} suites passed (widened: {why})", got

        # A red narrowed run still says it was narrowed. The fixture's edit
        # is a `#` line, which node refuses in a .mjs file; the new file is
        # one more suite in the whole seam.
        with_diff(tree, ["examples/bb/z.test.mjs"])
        r, _ = run_stubbed(
            ["bash", RUNNER, "--changed", "base"], root=tree, real=("node",)
        )
        out = r.stdout.splitlines()
        assert r.returncode == 1, f"exit {r.returncode}, not 1:\n{r.stdout}"
        passed = sum(line.startswith("PASS ") for line in out)
        assert out[-1] == (
            f"{passed} of {m + 1} suites passed before node examples/bb/z.test.mjs "
            "failed (narrowed: examples/bb)"
        ), out[-1]

        assert "cannot diff no-such-ref...HEAD" in refusal(
            tree, "--changed", "no-such-ref"
        )
        (tree / EDGES).write_text("examples/aa\n")
        said = refusal(tree, "--list", "--changed", "base")
        assert f"{EDGES}: not '<directory read> <unit>': examples/aa" in said, said
        (tree / EDGES).unlink()
        said = refusal(tree, "--list", "--changed", "base")
        assert f"cannot read {EDGES}" in said, said
        (tree / TREE_CHECKS).unlink()
        assert f"cannot read {TREE_CHECKS}" in refusal(tree, "--list"), TREE_CHECKS


if __name__ == "__main__":
    a_diff_selects_its_suites()
    the_recipes_call_the_runner()
    every_cross_unit_read_is_an_edge()
    every_shared_test_has_a_class()
    agents_md_names_both_commands()
    n = a_run_covers_its_listing()
    a_failing_suite_stops_the_run()
    print(f"seam_runner.test.py: {n} suites: ok")
