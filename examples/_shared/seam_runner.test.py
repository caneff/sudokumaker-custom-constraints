# The seam runner, `tests/all.sh`: the one listing of the gate's suites, which
# the justfile's recipes and a worker's narrowed run both read. Checked at its
# own interface -- a tree in, a list of suites out; a run's exit status and
# last line -- on the real tree and on scratch trees built here.
#
#   uv run examples/_shared/seam_runner.test.py

import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).parent))

from gate_lib import (
    by_mechanism,
    commands,
    gate_tree,
    pants,
    pants_suites,
    run_logged,
    run_stubbed,
)
from gate_lib import runner_listing as listing

RUNNER = "tests/all.sh"


GROUPS = ["lint", "test", "heavy-fillomino", "heavy-recovery", "soundness"]

# A stand-in for the runner that logs how it was called and runs nothing.
LOGGING_RUNNER = '#!/bin/sh\necho "all.sh $*" >> "$GATE_LOG"\n'


def the_recipes_call_the_runner():
    """The justfile keeps no listing of its own: `just check-full` is the
    runner called once per group, and the groups split the whole seam with no
    suite in two of them."""
    whole = listing()
    split = [suite for group in GROUPS for suite in listing("--group", group)]
    assert sorted(split) == sorted(whole), "the groups do not split the whole seam"

    with tempfile.TemporaryDirectory() as tmp:
        tree = gate_tree(tmp)
        (tree / RUNNER).write_text(LOGGING_RUNNER)
        assert commands("check-full", root=tree) == [
            f"all.sh --group {group}" for group in GROUPS
        ], "just check-full runs something other than the runner's groups"

    with tempfile.TemporaryDirectory() as tmp:
        tree = scratch_tree(tmp, dict.fromkeys(FIXTURE, ""))
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
    """A run executes the suites `--list` names, each once, and its last line
    counts them."""
    listed = listing()
    assert len(listed) == len(set(listed)), "tests/all.sh --list repeats a suite"
    r, ran = run_stubbed(["bash", RUNNER])
    assert r.returncode == 0, f"a stubbed full run failed:\n{r.stdout}{r.stderr}"
    wired = set(pants_suites().values())
    in_order = [s for s in listed if s not in wired] + [s for s in listed if s in wired]
    assert ran == in_order, (
        "a full run does not execute its own --list: the suites of its own "
        "loop in order, then the ones wired into Pants in order"
    )
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
    "uvx ruff format --check examples",
    "uv lock --check",
]

# What every narrowed run of the fixture keeps: lint and the shared tests.
ALWAYS = [
    *LINT,
    "uv run examples/_shared/gate.test.py",
    "uv run examples/_shared/s.test.py",
    "uv run examples/_shared/frame.test.py",
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
# The fixture's whole seam. The test files outside examples/ are in the tree
# and in no run.
WHOLE = ALWAYS + AA + BB + FILLOMINO + SKYSCRAPER + HIT_COUNTS

FIXTURE = [
    "justfile",
    "uv.lock",
    "docs/notes.md",
    "docs/boards/data.json",
    "examples/_shared/s.test.py",
    "examples/_shared/gate.test.py",
    "examples/_shared/frame.test.py",
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
    "outside/test_o.py",
    "outside/deep/o.test.py",
]

# A diff (the files one commit adds or edits) and the suites it must select.
NARROWED = [
    (["examples/fillomino/Component.js"], ALWAYS + FILLOMINO),
    (["examples/skyscraper/SkyscraperComponent.js"], ALWAYS + SKYSCRAPER),
    (["examples/aa/README.md", "examples/bb/notes.md"], ALWAYS + AA + BB),
    (
        ["examples/bb/new.test.mjs"],
        ALWAYS + BB + ["node examples/bb/new.test.mjs"],
    ),
    (["examples/_shared/s.test.py"], ALWAYS),
    (["examples/_shared/gate.test.py"], ALWAYS),
    (["docs/notes.md", "README.md", "outside/AGENTS.md"], ALWAYS),
    (["examples/aa/x.py", "docs/notes.md"], ALWAYS + AA),
    ([], ALWAYS),
]

# A diff that widens to the whole seam, and the reason the last line gives.
WIDENED = [
    (
        ["examples/_shared/lib.py"],
        "shared example code changed: examples/_shared/lib.py",
    ),
    (["justfile"], "every suite depends on justfile"),
    (["uv.lock"], "every suite depends on uv.lock"),
    (["tests/all.sh"], "every suite depends on tests/all.sh"),
    (["tests/suite-edges.txt"], "every suite depends on tests/suite-edges.txt"),
    (["docs/boards/data.json"], "no rule places docs/boards/data.json"),
    (["docs/two words.md"], "no rule places docs/two words.md"),
    (
        ["docs/builtin-components.md"],
        "every suite depends on docs/builtin-components.md",
    ),
    (["outside/test_o.py", "examples/aa/x.py"], "no rule places outside/test_o.py"),
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
    """(unit, other unit) for every tracked code line under an example that
    names another one's directory: a relative or repo path into it, or its
    bare name as a string. Comment lines are skipped, `#include` directives
    are not. examples/_shared/ is not a target: a change to it runs the whole
    seam."""
    tracked = subprocess.run(
        ["git", "ls-files", "examples"],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout.splitlines()
    units = sorted({"/".join(f.split("/")[:2]) for f in tracked if f.count("/") >= 2})
    targets = {
        u: re.compile(
            r"(\.\./|examples/)%s/|[\"']%s[\"']" % ((re.escape(u.split("/")[1]),) * 2)
        )
        for u in units
        if u != "examples/_shared"
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
    """A suite that reads another example's files runs when that
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
    narrowed = [
        ln
        for ln in lines
        if ln.startswith("- **Narrowed**: `bash tests/all.sh --changed origin/main`")
    ]
    assert len(narrowed) == 1, section


def git(tree, *args):
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    for who in ("AUTHOR", "COMMITTER"):
        env[f"GIT_{who}_NAME"] = "fixture"
        env[f"GIT_{who}_EMAIL"] = "fixture@example.invalid"
    r = subprocess.run(
        ["git", *args], cwd=tree, env=env, capture_output=True, text=True
    )
    assert r.returncode == 0, f"git {args} failed in the fixture:\n{r.stderr}"


def with_diff(tree, changed, deleted=()):
    """Commit an edit to each of `changed`, and the removal of each of
    `deleted`, on top of the fixture's base."""
    git(tree, "reset", "-q", "--hard", "base")
    git(tree, "clean", "-qfd")
    for rel in changed:
        (tree / rel).parent.mkdir(parents=True, exist_ok=True)
        with (tree / rel).open("a") as f:
            f.write("# changed\n")
    for rel in deleted:
        (tree / rel).unlink()
    git(tree, "add", "-A")
    git(tree, "commit", "-q", "--allow-empty", "-m", "change")


def a_diff_selects_its_suites():
    """`--changed <base>` keeps lint, the shared tests and the suites of each
    example the diff touches; it widens to the whole seam when the diff
    touches what every suite depends on or a path no rule places; and the
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

        (tree / EDGES).write_text("# a comment\nexamples/aa examples/bb  why")
        git(tree, "add", "-A")
        git(tree, "commit", "-q", "-m", "an edge")
        git(tree, "tag", "-f", "base")
        with_diff(tree, ["examples/aa/Component.js"])
        got = listing("--changed", "base", root=tree)
        assert sorted(got) == sorted(ALWAYS + AA + BB), f"an edge selects {got}"
        with_diff(tree, ["examples/bb/x.py"])
        got = listing("--changed", "base", root=tree)
        assert sorted(got) == sorted(ALWAYS + BB), f"an edge runs backwards: {got}"

        m = len(WHOLE)
        got = last_line(["examples/fillomino/x.py", "examples/bb/y.js"])
        assert got == (
            f"{len(ALWAYS + BB + FILLOMINO)} of {m} suites passed "
            "(narrowed: examples/bb examples/fillomino)"
        ), got
        assert last_line(["docs/notes.md"]) == (
            f"{len(ALWAYS)} of {m} suites passed (narrowed: no example touched)"
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


UP_TO_N = [
    "uv run examples/up-to-n/build_link.test.py",
    "node examples/up-to-n/end-to-end.test.mjs",
    "node examples/up-to-n/marker-contract.test.mjs",
    "node examples/up-to-n/update-strength.test.mjs",
]
UP_TO_N_HARNESS = "node examples/up-to-n/soundness-harness.mjs"


def wired_suites_go_through_pants():
    """On the real tree a full run and `--group test` send the up-to-n suites
    through Pants and print `PASS <suite>` for each, the last line keeps its
    format, and `--list` names the same suites with no Pants to ask."""
    for args, want, note in (
        ((), [*UP_TO_N, UP_TO_N_HARNESS], ""),
        (("--group", "test"), UP_TO_N, " (group: test)"),
    ):
        r, log = run_logged(["bash", RUNNER, *args])
        assert r.returncode == 0, f"{args}:\n{r.stdout}{r.stderr}"
        loop, pants = by_mechanism(log)
        out = r.stdout.splitlines()
        for suite in want:
            assert suite in pants, f"{args}: {suite} is not run through Pants"
            assert suite not in loop, f"{args}: {suite} also runs outside Pants"
            assert f"PASS {suite}" in out, f"{args}: no PASS line for {suite}"
        if args:
            assert UP_TO_N_HARNESS not in loop + pants, "--group test ran a harness"
        n = len(listing(*args))
        assert out[-1] == f"{n} of {n} suites passed{note}", out[-1]

    r, log = run_logged(["bash", RUNNER, "--list"], absent=("pants",))
    assert r.returncode == 0, f"--list with no pants:\n{r.stderr}"
    assert r.stdout.splitlines() == listing(), "--list changes with no pants"
    r, log = run_logged(["bash", RUNNER, "--list"])
    assert not log, f"--list called a tool: {log}"

    # Lint holds no test file, so it has nothing to ask Pants about.
    r, log = run_logged(["bash", RUNNER, "--group", "lint"], absent=("pants",))
    assert r.returncode == 0, f"--group lint with no pants:\n{r.stderr}"


def wired_suites_run_in_one_pants_call():
    """A run starts Pants once for every wired suite it holds, and a wired
    suite Pants does not report as passed is a failure: it gets a FAIL line,
    no PASS line, and the run exits 1."""
    r, log = run_logged(["bash", RUNNER, "--group", "test"])
    assert r.returncode == 0, f"{r.stdout}{r.stderr}"
    calls = [line for line in log if line.startswith("pants ") and " test " in line]
    assert len(calls) == 1, f"{len(calls)} `pants test` calls, not one"
    _, pants = by_mechanism(calls)
    assert set(UP_TO_N) < set(pants), f"the one call holds {pants}"

    silent = UP_TO_N[2]
    r, _ = run_logged(
        ["bash", RUNNER, "--group", "test"],
        unreported="examples/up-to-n:marker-contract.test.mjs",
    )
    out = r.stdout.splitlines()
    assert r.returncode == 1, f"exit {r.returncode}, not 1:\n{r.stdout}{r.stderr}"
    assert f"FAIL {silent}" in out, f"no FAIL line for {silent}:\n{r.stdout}"
    assert f"PASS {silent}" not in out, f"{silent} passed with no result"
    n = len(listing("--group", "test"))
    assert out[-1] == (
        f"{n - 1} of {n} suites passed before {silent} failed (group: test)"
    ), out[-1]


READS = "import fs from 'node:fs'\nfs.readFileSync('examples/aa/%s.txt')\n"

# A unit wired into Pants: two suites, each reading one file of its unit, and
# only one of the two files declared as an input.
WIRED_UNIT = {
    "pyproject.toml": "",
    "uv.lock": "",
    "BUILD": 'files(name="uvproject", sources=["pyproject.toml", "uv.lock"])\n',
    "examples/aa/BUILD": (
        'javascript_sources(name="js", sources=["*.mjs"])\n'
        'files(name="data", sources=["declared.txt"])\n'
        'suite("declared.test.mjs", needs=[":data"])\n'
        'suite("undeclared.test.mjs", needs=[":data"])\n'
    ),
    "examples/aa/declared.txt": "",
    "examples/aa/undeclared.txt": "",
    "examples/aa/declared.test.mjs": READS % "declared",
    "examples/aa/undeclared.test.mjs": READS % "undeclared",
    # The runner names these two by path, and its own loop runs them, for
    # real where node is real, before Pants runs the wired ones.
    "examples/skyscraper/recovery-probe.test.mjs": "",
    "examples/hit-counts/recovery-probe.test.mjs": "",
}


def wired_tree(tmp):
    """A scratch tree with one unit wired into Pants. Its node_modules and
    .venv are absolute symlinks, as in a worktree that borrows another
    checkout's: Pants stops on one it reads, so it must ignore both."""
    borrowed = pathlib.Path(tmp) / "borrowed"
    (pathlib.Path(tmp) / "tree").mkdir()
    tree = scratch_tree(pathlib.Path(tmp) / "tree", WIRED_UNIT)
    shutil.copy(ROOT / "pants.toml", tree / "pants.toml")
    for name in ("node_modules", ".venv"):
        (borrowed / name).mkdir(parents=True)
        (tree / name).symlink_to(borrowed / name)
    return tree


def an_undeclared_read_fails_the_suite():
    """A wired suite that reads a file its unit did not declare fails, with
    its output shown, and the failure is that file missing from the sandbox:
    the file is in the tree, and the suite passes when run from the tree."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = wired_tree(tmp)
        declared, undeclared = (
            f"node examples/aa/{name}.test.mjs" for name in ("declared", "undeclared")
        )
        direct = subprocess.run(undeclared.split(), cwd=tree, capture_output=True)
        assert direct.returncode == 0, f"the suite fails outside Pants: {direct.stderr}"

        r, _ = run_logged(["bash", RUNNER], root=tree, real=("node", "pants"))
        out = r.stdout.splitlines()
        assert r.returncode == 1, f"exit {r.returncode}, not 1:\n{r.stdout}{r.stderr}"
        assert f"PASS {declared}" in out, r.stdout
        assert f"FAIL {undeclared}" in out, r.stdout
        shown = out[out.index(f"FAIL {undeclared}") :]
        assert any(
            "ENOENT" in line and "examples/aa/undeclared.txt" in line for line in shown
        ), f"the failure shown is not the undeclared file missing:\n{r.stdout}"
        assert out[-1].endswith(f"suites passed before {undeclared} failed"), out[-1]

        # Neither the run nor this file's own question to Pants leaves Pants's
        # work directory in the tree.
        assert pants_suites(tree), "the fixture wires no suite"
        left = sorted(p.name for p in tree.iterdir() if p.name.startswith(".pants"))
        assert not left, f"Pants's work directory is left in the tree: {left}"


def the_sandbox_gets_the_trees_python():
    """uv builds a wired suite's environment inside the sandbox, from the
    interpreter the tree's own environment was built from: the runner names
    it, so uv does not pick another one (or download one) in there. A node
    suite finds it in UV_PYTHON, for the `uv run` it starts. A Python suite
    runs on it and does not hand UV_PYTHON on: a second `uv run` under it,
    of a script outside the project, would lose the project's environment."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = wired_tree(tmp)
        (tree / "examples/aa/BUILD").write_text(
            'javascript_sources(name="js", sources=["*.mjs"])\n'
            'python_sources(name="py", sources=["*.py"])\n'
            'suite("python.test.mjs")\n'
            'suite("python.test.py")\n'
        )
        (tree / "examples/aa/python.test.mjs").write_text(
            "console.log('UV_PYTHON=' + process.env.UV_PYTHON)\nprocess.exit(1)\n"
        )
        (tree / "examples/aa/python.test.py").write_text(
            "import os, sys\n"
            "print('runs on', os.path.realpath(sys.executable))\n"
            "print('hands on', os.environ.get('UV_PYTHON'))\n"
            "sys.exit(1)\n"
        )
        # A project uv can read: the Python suite runs the real uv.
        (tree / "pyproject.toml").write_text(
            '[project]\nname = "fixture"\nversion = "0"\nrequires-python = ">=3.11"\n'
        )
        (tree / "uv.lock").write_text(
            'version = 1\nrequires-python = ">=3.11"\n\n[[package]]\n'
            'name = "fixture"\nversion = "0"\nsource = { virtual = "." }\n'
        )
        base = pathlib.Path(sys.executable).resolve()
        (tree / ".venv/bin").mkdir()
        (tree / ".venv/bin/python").symlink_to(base)
        r, _ = run_logged(["bash", RUNNER], root=tree, real=("node", "pants"))
        out = r.stdout.splitlines()
        assert "FAIL node examples/aa/python.test.mjs" in out, r.stdout + r.stderr
        assert f"UV_PYTHON={base}" in out, f"not the tree's interpreter:\n{r.stdout}"

        # The Python suite, with the real uv, as the runner starts it.
        r = pants(
            "test",
            "examples/aa:python.test.py",
            root=tree,
            env={"UV_PYTHON": str(base)},
        )
        out = r.stderr.splitlines()
        assert f"runs on {base}" in out, f"not the tree's interpreter:\n{r.stderr}"
        assert "hands on None" in out, f"UV_PYTHON reaches the suite:\n{r.stderr}"


def no_pants_runs_no_suite():
    """A tree with a pants.toml and no working Pants exits 2 naming the
    install, and reports no suite as passed: a wired suite never falls back to
    running outside the sandbox."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = wired_tree(tmp)
        r, log = run_logged(
            ["bash", RUNNER], root=tree, real=("node",), absent=("pants",)
        )
        assert r.returncode == 2, f"exit {r.returncode}, not 2:\n{r.stdout}{r.stderr}"
        assert "Install the Pants launcher" in r.stderr, r.stderr
        assert (r.stdout, log) == ("", []), (
            f"a suite ran with no pants: {r.stdout}{log}"
        )

        (tree / "pants.toml").write_text("[GLOBAL\n")
        r, log = run_logged(["bash", RUNNER], root=tree, real=("node", "pants"))
        assert r.returncode == 2, f"exit {r.returncode}, not 2:\n{r.stdout}{r.stderr}"
        assert "`pants list` failed" in r.stderr, r.stderr
        assert (r.stdout, log) == ("", []), f"a suite ran on a broken pants: {r.stdout}"


# A tree where Pants decides: the shared directory and two units wired, one
# unit (cc) not. `lib` is imported by the shared test and by one suite of aa;
# `other` by bb's suite only; every suite of aa declares aa's board.
SELECTION_TREE = {
    "pyproject.toml": "",
    "uv.lock": "",
    "docs/notes.md": "",
    "BUILD": 'files(name="uvproject", sources=["pyproject.toml", "uv.lock"])\n',
    "tests/suite-edges.txt": "examples/bb examples/cc  cc reads bb's files\n",
    "examples/_shared/BUILD": (
        'python_sources(name="py", sources=["*.py"])\nsuite("s.test.py")\n'
    ),
    "examples/_shared/lib.py": "",
    "examples/_shared/other.py": "",
    "examples/_shared/s.test.py": "import lib\n",
    "examples/aa/BUILD": (
        'python_sources(name="py", sources=["*.py"])\n'
        'javascript_sources(name="js", sources=["*.mjs"])\n'
        'files(name="data", sources=["*.txt"])\n'
        'suite("a.test.py", needs=[":data"])\n'
        'suite("a2.test.mjs", needs=[":data"])\n'
        'suite("soundness-harness.mjs", needs=[":data"])\n'
    ),
    "examples/aa/board.txt": "",
    "examples/aa/a.test.py": "import lib\n",
    "examples/aa/a2.test.mjs": "",
    "examples/aa/soundness-harness.mjs": "",
    "examples/bb/BUILD": (
        'python_sources(name="py", sources=["*.py"])\nsuite("b.test.py")\n'
    ),
    "examples/bb/b.test.py": "import other\n",
    "examples/cc/c.test.mjs": "",
    "examples/cc/soundness-harness.mjs": "",
}
S_ALWAYS = [
    *LINT,
    "uv run examples/_shared/s.test.py",
    "uv run examples/_shared/check_layout.py",
]
S_AA = [
    "uv run examples/aa/a.test.py",
    "node examples/aa/a2.test.mjs",
    "node examples/aa/soundness-harness.mjs",
]
S_BB = ["uv run examples/bb/b.test.py"]
S_CC = ["node examples/cc/c.test.mjs", "node examples/cc/soundness-harness.mjs"]
# Not wired either: the suites the runner names by path.
S_NAMED = [
    "uv run examples/fillomino/pipeline.test.py",
    "uv run examples/fillomino/generate.test.py",
    *SKYSCRAPER,
    *HIT_COUNTS,
]
S_WHOLE = S_ALWAYS + S_AA + S_BB + S_CC + S_NAMED

# A diff of the selection tree (files edited, files deleted) and the suites
# Pants and the directory rule select for it between them.
SELECTED = [
    # One shared helper: the wired suite that imports it and no other wired
    # one, and every suite that is not wired, since nothing says what those read.
    (["examples/_shared/lib.py"], [], S_ALWAYS + S_AA[:1] + S_CC + S_NAMED),
    # A deleted helper still selects what imported it.
    ([], ["examples/_shared/other.py"], S_ALWAYS + S_BB + S_CC + S_NAMED),
    # A wired unit's fixture: that unit's suites, its harness among them.
    (["examples/aa/board.txt"], [], S_ALWAYS + S_AA),
    # A wired unit an edge says an unwired one reads.
    (["examples/bb/b.test.py"], [], S_ALWAYS + S_BB + S_CC),
    # An unwired unit keeps the directory rule.
    (["examples/cc/Component.js"], [], S_ALWAYS + S_CC),
    (["docs/notes.md"], [], S_ALWAYS),
    (["uv.lock"], [], S_WHOLE),
]


def selection_tree(tmp):
    tree = wired_tree(tmp)
    for rel, text in SELECTION_TREE.items():
        (tree / rel).parent.mkdir(parents=True, exist_ok=True)
        (tree / rel).write_text(text)
    for rel in WIRED_UNIT:
        if rel.startswith("examples/aa/") and rel not in SELECTION_TREE:
            (tree / rel).unlink()
    git(tree, "init", "-q")
    git(tree, "add", "-A")
    git(tree, "commit", "-q", "-m", "base")
    git(tree, "tag", "base")
    return tree


def pants_selects_the_wired_suites():
    """On a tree with wired units, `--changed <base> --list` is lint, the
    shared tests, the wired suites Pants says the diff reaches, and the
    directory rule's answer for the suites that are not wired."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = selection_tree(tmp)
        assert sorted(listing(root=tree)) == sorted(S_WHOLE), listing(root=tree)
        for changed, deleted, want in SELECTED:
            with_diff(tree, changed, deleted)
            got = listing("--changed", "base", root=tree)
            assert sorted(got) == sorted(want), (
                f"{changed + deleted} selects {got}, not {want}"
            )


def a_failed_query_widens():
    """When Pants cannot say what a diff affects, the run is the whole seam
    and its last line says why: it never narrows on no answer."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = selection_tree(tmp)
        with_diff(tree, ["examples/aa/board.txt"], [])
        m = len(S_WHOLE)

        # The stub fails the question.
        r, ran = run_stubbed(["bash", RUNNER, "--changed", "base"], root=tree)
        assert r.returncode == 0, f"{r.stdout}{r.stderr}"
        assert sorted(ran) == sorted(S_WHOLE), f"the run narrowed to {ran}"
        assert r.stdout.splitlines()[-1] == (
            f"{m} of {m} suites passed "
            "(widened: Pants could not say what the diff affects)"
        ), r.stdout.splitlines()[-1]
        assert "planted: no answer" in r.stderr, r.stderr

        # An answer that names no wired suite is no answer.
        r, ran = run_stubbed(
            ["bash", RUNNER, "--changed", "base"], root=tree, changed=["no such suite"]
        )
        assert sorted(ran) == sorted(S_WHOLE), f"the run narrowed to {ran}"
        assert r.stdout.splitlines()[-1] == (
            f"{m} of {m} suites passed "
            "(widened: Pants named what is no wired suite: no such suite)"
        ), r.stdout.splitlines()[-1]

        # No Pants to ask: the listing is the whole seam.
        r, _ = run_logged(
            ["bash", RUNNER, "--list", "--changed", "base"],
            root=tree,
            absent=("pants",),
        )
        assert r.returncode == 0, r.stderr
        assert sorted(r.stdout.splitlines()) == sorted(S_WHOLE), r.stdout
        assert "no `pants` is on the PATH" in r.stderr, r.stderr


def a_narrowed_run_says_so():
    """A narrowed run's last line counts what ran against the whole seam and
    names the units, so a run of lint and the shared tests alone never reads
    as the whole seam passing."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = selection_tree(tmp)
        m = len(S_WHOLE)

        def last_line(changed, affected, want):
            with_diff(tree, changed, [])
            r, ran = run_stubbed(
                ["bash", RUNNER, "--changed", "base"], root=tree, changed=affected
            )
            assert r.returncode == 0, f"{changed}:\n{r.stdout}{r.stderr}"
            assert sorted(ran) == sorted(want), f"{changed} ran {ran}"
            return r.stdout.splitlines()[-1]

        got = last_line(
            ["examples/aa/board.txt"],
            ["examples/aa:a2.test.mjs", "examples/aa:soundness-harness.mjs"],
            S_ALWAYS + S_AA[1:],
        )
        assert got == (
            f"{len(S_ALWAYS) + 2} of {m} suites passed (narrowed: examples/aa)"
        ), got
        got = last_line(["docs/notes.md"], [], S_ALWAYS)
        assert got == (
            f"{len(S_ALWAYS)} of {m} suites passed (narrowed: no example touched)"
        ), got
        assert len(S_ALWAYS) < m


if __name__ == "__main__":
    a_diff_selects_its_suites()
    pants_selects_the_wired_suites()
    a_failed_query_widens()
    a_narrowed_run_says_so()
    wired_suites_go_through_pants()
    wired_suites_run_in_one_pants_call()
    an_undeclared_read_fails_the_suite()
    the_sandbox_gets_the_trees_python()
    no_pants_runs_no_suite()
    the_recipes_call_the_runner()
    every_cross_unit_read_is_an_edge()
    agents_md_names_both_commands()
    n = a_run_covers_its_listing()
    a_failing_suite_stops_the_run()
    print(f"seam_runner.test.py: {n} suites: ok")
