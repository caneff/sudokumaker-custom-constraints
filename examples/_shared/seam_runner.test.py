# The seam runner, `tests/all.sh`: the one listing of the gate's suites, which
# the justfile's recipes and a worker's narrowed run both read. Checked at its
# own interface -- a tree in, a list of suites out; a run's exit status and
# last line -- on the real tree and on scratch trees built here.
#
#   uv run examples/_shared/seam_runner.test.py

import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).parent))

from gate_lib import (
    ROOT_BUILD,
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

# The fixture's lint steps and shared tests.
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
ISOFILL_SKYSCRAPER = ["uv run examples/isofill-skyscraper/verify.py"]
SQUISHDOKU = ["uv run examples/squishdoku/embedded_forced_houses.test.py"]
# The fixture's whole seam. The test files outside examples/ are in the tree
# and in no run.
WHOLE = (
    ALWAYS
    + AA
    + BB
    + FILLOMINO
    + SKYSCRAPER
    + ISOFILL_SKYSCRAPER
    + HIT_COUNTS
    + SQUISHDOKU
)

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
    return r.stdout.strip()


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


def no_pants_toml_widens():
    """A tree with no pants.toml has nothing to say what a diff affects, so
    `--changed <base>` is the whole seam whatever the diff holds, and the last
    line says why. A base git does not know is refused."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = scratch_tree(tmp, dict.fromkeys(FIXTURE, ""))
        git(tree, "init", "-q")
        git(tree, "add", "-A")
        git(tree, "commit", "-q", "-m", "base")
        git(tree, "tag", "base")
        assert sorted(listing(root=tree)) == sorted(WHOLE), listing(root=tree)
        m = len(WHOLE)
        for changed in (["examples/aa/README.md"], ["docs/notes.md"], []):
            with_diff(tree, changed)
            got = listing("--changed", "base", root=tree)
            assert sorted(got) == sorted(WHOLE), f"{changed} selects {got}"
            r, ran = run_stubbed(["bash", RUNNER, "--changed", "base"], root=tree)
            assert r.returncode == 0, f"{changed}:\n{r.stdout}{r.stderr}"
            assert ran == got, changed
            assert r.stdout.splitlines()[-1] == (
                f"{m} of {m} suites passed "
                "(widened: no pants.toml, so nothing says what the diff affects)"
            ), r.stdout.splitlines()[-1]

        assert "cannot diff no-such-ref...HEAD" in refusal(
            tree, "--changed", "no-such-ref"
        )


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
    "BUILD": ROOT_BUILD,
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
    of a script outside the project, would lose the project's environment.
    The runner reads the interpreter after its own loop: in a tree with no
    environment yet, a suite of that loop is what builds it."""
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
        # No environment when the run starts: a suite of the runner's own
        # loop builds it, as the first `uv run` of a fresh tree does.
        (tree / "examples/skyscraper/recovery-probe.test.mjs").write_text(
            "import fs from 'node:fs'\n"
            "fs.mkdirSync('.venv/bin', { recursive: true })\n"
            f"fs.symlinkSync({str(base)!r}, '.venv/bin/python')\n"
        )
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

        # A Pants that names none of the tree's suites has not said "nothing
        # is wired": no suite leaves its sandbox on that answer.
        shutil.copy(ROOT / "pants.toml", tree / "pants.toml")
        (tree / "examples/aa/BUILD").unlink()
        r, log = run_logged(["bash", RUNNER], root=tree, real=("node", "pants"))
        assert r.returncode == 2, f"exit {r.returncode}, not 2:\n{r.stdout}{r.stderr}"
        assert "Pants named no suite of this tree" in r.stderr, r.stderr
        assert (r.stdout, log) == ("", []), f"a suite ran unsandboxed: {r.stdout}"


# A tree where Pants decides: the shared directory and three units wired.
# `lib` is imported by one shared test and by one suite of aa; `other` by bb's
# suite only; every suite of aa declares aa's board, and so does cc's, which
# is the one read across units. `t.test.py` declares the whole tree, which
# here is everything but outside/. `e.test.py` has no target: the stand-in
# for a test on the exception list.
SELECTION_TREE = {
    "pyproject.toml": "",
    "uv.lock": "",
    "docs/notes.md": "",
    "outside/x.txt": "",
    "outside/gone.txt": "",
    "BUILD": ROOT_BUILD
    + 'files(name="tree", sources=["*", "docs/**", "examples/**", "tests/**"])\n',
    "examples/_shared/BUILD": (
        'python_sources(name="py", sources=["*.py"])\n'
        'suite("s.test.py")\n'
        'suite("t.test.py", needs=["//:tree"])\n'
    ),
    "examples/_shared/lib.py": "",
    "examples/_shared/other.py": "",
    "examples/_shared/s.test.py": "import lib\n",
    "examples/_shared/t.test.py": "",
    "examples/_shared/e.test.py": "",
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
    "examples/cc/BUILD": (
        'javascript_sources(name="js", sources=["*.mjs"])\n'
        'suite("c.test.mjs", needs=["examples/aa/board.txt:data"])\n'
    ),
    "examples/cc/c.test.mjs": "",
}
# What every narrowed run keeps: lint and the suites Pants has no target for.
# On the real tree those are the exception list's; here they are e.test.py and
# the suites the runner names by path.
S_ALWAYS = [
    *LINT,
    "uv run examples/_shared/e.test.py",
    "uv run examples/_shared/check_layout.py",
    "uv run examples/fillomino/pipeline.test.py",
    "uv run examples/fillomino/generate.test.py",
    *SKYSCRAPER,
    *ISOFILL_SKYSCRAPER,
    *HIT_COUNTS,
    *SQUISHDOKU,
]
S_LIB = ["uv run examples/_shared/s.test.py"]
# The whole-tree check: any change Pants can place selects it.
S_TREE = ["uv run examples/_shared/t.test.py"]
S_AA = [
    "uv run examples/aa/a.test.py",
    "node examples/aa/a2.test.mjs",
    "node examples/aa/soundness-harness.mjs",
]
S_BB = ["uv run examples/bb/b.test.py"]
S_CC = ["node examples/cc/c.test.mjs"]
S_WHOLE = S_ALWAYS + S_LIB + S_TREE + S_AA + S_BB + S_CC

# A diff of the selection tree (files edited, files deleted) and the suites
# Pants selects for it, beside lint and the suites it has no target for.
SELECTED = [
    # One shared helper: the suites that import it, the shared one among
    # them, and no other.
    (["examples/_shared/lib.py"], [], S_LIB + S_TREE + S_AA[:1]),
    # A unit's fixture: that unit's suites, its harness among them, and the
    # suite of another unit that declares the file.
    (["examples/aa/board.txt"], [], S_TREE + S_AA + S_CC),
    # The edge runs one way: cc reads aa, and nothing reads bb or cc.
    (["examples/bb/b.test.py"], [], S_TREE + S_BB),
    (["examples/cc/c.test.mjs"], [], S_TREE + S_CC),
    # Docs only: the whole-tree check and nothing else.
    (["docs/notes.md"], [], S_TREE),
    # A changed shared test selects itself.
    (["examples/_shared/s.test.py"], [], S_LIB + S_TREE),
    # What every wired suite runs under selects every one of them.
    (["uv.lock"], [], S_WHOLE[len(S_ALWAYS) :]),
    (["tests/all.sh"], [], S_WHOLE[len(S_ALWAYS) :]),
    (["tests/pants_prelude.py"], [], S_WHOLE[len(S_ALWAYS) :]),
    # Pants leaves a file .gitignore names out of every sandbox.
    ([".gitignore"], [], S_WHOLE[len(S_ALWAYS) :]),
    ([], [], []),
]

# A path no target owns: Pants cannot place it, so the whole seam runs.
UNPLACED = "outside/x.txt"

# A deleted file: Pants answers from the tree as it is now, where a suite's
# import of a file that is gone resolves to nothing, so it cannot say which
# suites read it. The whole seam runs, whether a suite imported the file
# (`other`) or none could (`outside/gone.txt`).
DELETED = ["examples/_shared/other.py", "outside/gone.txt"]


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


def pants_selects_every_suite():
    """`--changed <base> --list` is lint, the suites Pants has no target for,
    and the wired suites Pants says the diff reaches: no directory decides.
    A changed path no target owns widens to the whole seam, and so does a
    deleted one."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = selection_tree(tmp)
        assert sorted(listing(root=tree)) == sorted(S_WHOLE), listing(root=tree)
        for changed, deleted, want in SELECTED:
            with_diff(tree, changed, deleted)
            got = listing("--changed", "base", root=tree)
            assert sorted(got) == sorted(S_ALWAYS + want), (
                f"{changed + deleted} selects {got}, not {S_ALWAYS + want}"
            )
        with_diff(tree, [UNPLACED, "examples/aa/board.txt"])
        got = listing("--changed", "base", root=tree)
        assert sorted(got) == sorted(S_WHOLE), f"{UNPLACED} selects {got}"
        for gone in DELETED:
            with_diff(tree, ["examples/aa/board.txt"], [gone])
            got = listing("--changed", "base", root=tree)
            assert sorted(got) == sorted(S_WHOLE), f"deleting {gone} selects {got}"


def a_failed_query_widens():
    """When Pants cannot say what a diff affects, or cannot place a path the
    diff changed, the run is the whole seam and its last line says why: it
    never narrows on no answer."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = selection_tree(tmp)
        with_diff(tree, ["examples/aa/board.txt"], [])
        m = len(S_WHOLE)

        def widened(why, **stub):
            r, ran = run_stubbed(
                ["bash", RUNNER, "--changed", "base"], root=tree, **stub
            )
            assert r.returncode == 0, f"{r.stdout}{r.stderr}"
            assert sorted(ran) == sorted(S_WHOLE), f"the run narrowed to {ran}"
            assert r.stdout.splitlines()[-1] == (
                f"{m} of {m} suites passed (widened: {why})"
            ), r.stdout.splitlines()[-1]
            return r

        # The stub fails the question.
        r = widened("Pants could not say what the diff affects")
        assert "planted: no answer" in r.stderr, r.stderr

        # An answer that is no list of addresses is no answer.
        widened(
            "Pants's answer cannot be read: no such suite",
            changed=["examples/aa/board.txt:data", "no such suite"],
        )

        # An answer that names no owner of a changed path.
        widened(
            "Pants cannot place examples/aa/board.txt",
            changed=["examples/aa:a2.test.mjs", "examples/aa/board.txt.bak:data"],
        )
        with_diff(tree, ["examples/aa/board.txt", UNPLACED])
        widened(
            f"Pants cannot place {UNPLACED}",
            changed=["examples/aa:a2.test.mjs", "examples/aa/board.txt:data"],
        )

        # A deleted file is one Pants is not asked about.
        with_diff(tree, ["examples/aa/board.txt"], DELETED[:1])
        widened(
            f"{DELETED[0]} was deleted, and Pants cannot say what read it",
            changed=["examples/aa:a2.test.mjs", "examples/aa/board.txt:data"],
        )
        with_diff(tree, ["examples/aa/board.txt"], [])

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
    names the units whose suites Pants selected, so a run of lint and the
    excepted tests alone never reads as the whole seam passing. A red one
    says it too."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = selection_tree(tmp)
        m = len(S_WHOLE)

        def run(changed, affected, want, **stub):
            with_diff(tree, changed, [])
            r, ran = run_stubbed(
                ["bash", RUNNER, "--changed", "base"],
                root=tree,
                changed=affected,
                **stub,
            )
            assert sorted(ran) == sorted(want), f"{changed} ran {ran}"
            return r

        board = ["examples/aa/board.txt"]
        answer = [
            "examples/aa/board.txt:data",
            "//examples/aa/board.txt:../../tree",
            "examples/_shared:t.test.py",
            "examples/aa:a2.test.mjs",
            "examples/aa:soundness-harness.mjs",
        ]
        r = run(board, answer, S_ALWAYS + S_TREE + S_AA[1:])
        assert r.returncode == 0, f"{r.stdout}{r.stderr}"
        assert r.stdout.splitlines()[-1] == (
            f"{len(S_ALWAYS) + 3} of {m} suites passed "
            "(narrowed: examples/_shared examples/aa)"
        ), r.stdout.splitlines()[-1]

        r = run(["docs/notes.md"], ["//docs/notes.md:../x"], S_ALWAYS)
        assert r.returncode == 0, f"{r.stdout}{r.stderr}"
        assert r.stdout.splitlines()[-1] == (
            f"{len(S_ALWAYS)} of {m} suites passed (narrowed: no wired suite)"
        ), r.stdout.splitlines()[-1]
        assert len(S_ALWAYS) < m

        silent = "node examples/aa/a2.test.mjs"
        r = run(
            board,
            answer,
            S_ALWAYS + S_TREE + S_AA[1:],
            unreported="examples/aa:a2.test.mjs",
        )
        assert r.returncode == 1, f"exit {r.returncode}, not 1:\n{r.stdout}"
        assert r.stdout.splitlines()[-1] == (
            f"{len(S_ALWAYS) + 2} of {m} suites passed before {silent} failed "
            "(narrowed: examples/_shared examples/aa)"
        ), r.stdout.splitlines()[-1]


def rows_of(path):
    """The rows of a run log, parsed; none when the file is not there."""
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text().splitlines()]


def subdir(tmp, name):
    path = pathlib.Path(tmp) / name
    path.mkdir()
    return path


def logged_tree(tmp, name):
    """A scratch tree of the fixture, committed and tagged `base`."""
    tree = scratch_tree(subdir(tmp, name), dict.fromkeys(FIXTURE, ""))
    git(tree, "init", "-q")
    git(tree, "add", "-A")
    git(tree, "commit", "-q", "-m", "base")
    git(tree, "tag", "base")
    return tree


def a_run_appends_one_row_to_the_log():
    """Every finished run appends one JSON line to the file `SEAM_RUNS_LOG`
    names: the checkout's HEAD, the `--changed` base, the mode, the widen
    reason, suites passed and total, pass or fail, and wall-clock seconds. A
    `--list` run, which ran nothing, logs nothing."""
    with tempfile.TemporaryDirectory() as tmp:
        log = pathlib.Path(tmp) / "cache" / "sub" / "seam-runs.jsonl"

        def run(tree, *args, **stub):
            r, _ = run_stubbed(["bash", RUNNER, *args], root=tree, runs_log=log, **stub)
            return r

        flat = logged_tree(tmp, "flat")
        m = len(WHOLE)
        assert run(flat).returncode == 0
        assert run(flat, "--group", "soundness").returncode == 0
        assert run(flat, "--changed", "base").returncode == 0
        sel = selection_tree(subdir(tmp, "sel"))
        with_diff(sel, ["examples/aa/board.txt"])
        answer = ["examples/aa/board.txt:data", "examples/aa:a2.test.mjs"]
        assert run(sel, "--changed", "base", changed=answer).returncode == 0
        assert run(sel, "--list").returncode == 0
        failing = run(
            sel,
            "--changed",
            "base",
            changed=answer,
            unreported="examples/aa:a2.test.mjs",
        )
        assert failing.returncode == 1

        rows = rows_of(log)
        assert len(rows) == 5, f"{len(rows)} rows for 5 finished runs: {rows}"
        full, group, widened, narrowed, failed = rows
        assert full["mode"] == "full" and group["mode"] == "group", (full, group)
        assert (full["passed"], full["total"], full["ok"]) == (m, m, True), full
        assert full["sha"] == git(flat, "rev-parse", "HEAD"), full
        assert full["base"] is None and full["reason"] is None, full
        assert group["group"] == "soundness" and group["ok"] is True, group
        assert (group["passed"], group["total"]) == (3, 3), group
        assert widened["mode"] == "widened" and widened["base"] == "base", widened
        assert widened["ok"] is True, widened
        assert widened["reason"] == (
            "no pants.toml, so nothing says what the diff affects"
        ), widened
        assert narrowed["mode"] == "narrowed" and narrowed["reason"] is None, narrowed
        assert narrowed["sha"] == git(sel, "rev-parse", "HEAD"), narrowed
        assert narrowed["ok"] is True, narrowed
        assert failed["ok"] is False and failed["passed"] < failed["total"], failed
        for row in rows:
            assert isinstance(row["seconds"], int) and row["seconds"] >= 0, row


def a_row_is_valid_json_whatever_the_reason_says():
    """A widen reason names a changed path, which can hold a quote or a
    backslash: the row is still one JSON line that reads back as the reason."""
    with tempfile.TemporaryDirectory() as tmp:
        log = pathlib.Path(tmp) / "seam-runs.jsonl"
        sel = selection_tree(subdir(tmp, "sel"))
        odd = 'we"ird\\x.txt'
        with_diff(sel, [odd, "examples/aa/board.txt"])
        r, _ = run_stubbed(
            ["bash", RUNNER, "--changed", "base"],
            root=sel,
            runs_log=log,
            changed=["examples/aa/board.txt:data"],
        )
        assert r.returncode == 0, r.stderr
        (row,) = rows_of(log)
        # git quotes such a path in its listing, and the reason carries that.
        assert row["reason"].startswith('"we\\"ird\\\\x'), row


def a_slow_run_logs_its_wall_clock():
    """`seconds` is the run's wall clock, not a constant."""
    with tempfile.TemporaryDirectory() as tmp:
        log = pathlib.Path(tmp) / "seam-runs.jsonl"
        tree = scratch_tree(
            tmp,
            {"examples/aa/slow.test.mjs": "setTimeout(() => {}, 2200)\n"},
        )
        r, _ = run_stubbed(
            ["bash", RUNNER, "--group", "test"],
            root=tree,
            real=("node",),
            runs_log=log,
        )
        assert r.returncode == 0, r.stdout + r.stderr
        (row,) = rows_of(log)
        assert row["seconds"] >= 2, row


def every_failing_exit_logs_its_row():
    """A run that fails logs a row on each of the runner's three failing
    exits: a suite of its own loop, a suite Pants did not report as passed,
    and a `pants test` that exits non-zero with every suite reported."""
    with tempfile.TemporaryDirectory() as tmp:
        log = pathlib.Path(tmp) / "seam-runs.jsonl"
        loop = scratch_tree(
            subdir(tmp, "loop"), {"examples/aa/bad.test.mjs": "process.exit(3)\n"}
        )
        r, _ = run_stubbed(["bash", RUNNER], root=loop, real=("node",), runs_log=log)
        assert r.returncode == 1, r.stdout + r.stderr
        sel = selection_tree(subdir(tmp, "sel"))
        with_diff(sel, ["examples/aa/board.txt"])
        answer = ["examples/aa/board.txt:data", "examples/aa:a2.test.mjs"]
        r, _ = run_stubbed(
            ["bash", RUNNER, "--changed", "base"],
            root=sel,
            runs_log=log,
            changed=answer,
            pants_status=1,
        )
        assert r.returncode == 1, r.stdout + r.stderr
        rows = rows_of(log)
        assert [row["ok"] for row in rows] == [False, False], rows


def a_log_that_cannot_be_written_costs_one_stderr_line():
    """A log that cannot be written changes neither the exit code nor the last
    line; it costs one stderr line naming the failure. So does a run with
    nowhere to build the log's path from."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = logged_tree(tmp, "flat")
        m = len(WHOLE)
        blocked = pathlib.Path(tmp) / "blocked"
        blocked.write_text("")
        no_home = {"SEAM_RUNS_LOG": None, "XDG_CACHE_HOME": None, "HOME": None}
        for log, extra in (
            (blocked / "seam-runs.jsonl", None),
            (None, no_home),
        ):
            r, _ = run_stubbed(["bash", RUNNER], root=tree, runs_log=log, extra=extra)
            assert r.returncode == 0, f"a log failure changed the exit:\n{r.stderr}"
            assert r.stdout.splitlines()[-1] == f"{m} of {m} suites passed", r.stdout
            said = [x for x in r.stderr.splitlines() if "could not write" in x]
            assert len(said) == 1, f"not one stderr line naming it:\n{r.stderr}"


def a_relative_log_path_is_the_callers():
    """A relative `SEAM_RUNS_LOG` is read from where the caller stands, not
    from the checkout the runner moves into; a bare file name is a file."""
    with tempfile.TemporaryDirectory() as tmp:
        tree = logged_tree(tmp, "flat")
        here = pathlib.Path(tmp) / "caller"
        here.mkdir()
        env = {**os.environ, "SEAM_RUNS_LOG": "runs.jsonl"}
        r = subprocess.run(
            ["bash", str(tree / RUNNER), "--group", "soundness"],
            cwd=here,
            env=env,
            capture_output=True,
            text=True,
        )
        assert r.returncode == 0, r.stdout + r.stderr
        assert len(rows_of(here / "runs.jsonl")) == 1, list(here.iterdir())
        assert not (tree / "runs.jsonl").exists()


def tests_do_not_write_the_developers_log():
    """`run_logged` points the runner at a scratch log unless told a path, so
    no test run appends to the real one."""
    r, _ = run_logged(["bash", "-c", 'printf %s "$SEAM_RUNS_LOG"'])
    assert r.stdout and "sudokumaker-custom-constraints" not in r.stdout, r.stdout


if __name__ == "__main__":
    no_pants_toml_widens()
    pants_selects_every_suite()
    a_failed_query_widens()
    a_narrowed_run_says_so()
    a_run_appends_one_row_to_the_log()
    a_row_is_valid_json_whatever_the_reason_says()
    a_slow_run_logs_its_wall_clock()
    every_failing_exit_logs_its_row()
    a_log_that_cannot_be_written_costs_one_stderr_line()
    a_relative_log_path_is_the_callers()
    tests_do_not_write_the_developers_log()
    wired_suites_go_through_pants()
    wired_suites_run_in_one_pants_call()
    an_undeclared_read_fails_the_suite()
    the_sandbox_gets_the_trees_python()
    no_pants_runs_no_suite()
    the_recipes_call_the_runner()
    agents_md_names_both_commands()
    n = a_run_covers_its_listing()
    a_failing_suite_stops_the_run()
    print(f"seam_runner.test.py: {n} suites: ok")
