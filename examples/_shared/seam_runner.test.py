# The seam runner, `tests/all.sh`: the one listing of the gate's suites, which
# the justfile's recipes and a worker's narrowed run both read. Checked at its
# own interface -- a tree in, a list of suites out; a run's exit status and
# last line -- on the real tree and on scratch trees built here.
#
#   uv run examples/_shared/seam_runner.test.py

import pathlib
import shutil
import subprocess
import sys
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(pathlib.Path(__file__).parent))

from gate_lib import commands, run_stubbed

RUNNER = "tests/all.sh"


def listing(*args, root=ROOT):
    """The suites `tests/all.sh --list <args>` names, in order."""
    r = subprocess.run(
        ["bash", RUNNER, "--list", *args], cwd=root, capture_output=True, text=True
    )
    assert r.returncode == 0, f"tests/all.sh --list {args} failed:\n{r.stderr}"
    return r.stdout.splitlines()


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


def scratch_tree(tmp, files):
    """A tree holding the runner and `files` (path -> text), nothing else."""
    tree = pathlib.Path(tmp)
    shutil.copytree(ROOT / "tests", tree / "tests")
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
        r, ran = run_stubbed(["bash", RUNNER], root=tree, real=("node",))
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


if __name__ == "__main__":
    n = full_listing_is_check_full()
    a_run_covers_its_listing()
    a_failing_suite_stops_the_run()
    print(f"seam_runner.test.py: {n} suites: ok")
