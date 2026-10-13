"""One end-to-end test for Pants behind the seam runner (#809).

What the spec bought, driven at the seam runner's own interface on a copy of
the real tree, in the order a worker meets it:

  1. the front door is unchanged: the copy lists the suites the real tree
     lists, and a new test file is in the full and the narrowed listing with
     no edit to any list;
  2. a narrowed run is what the diff can affect, and Pants says what that is:
     one shared helper selects the suites that read it and not another
     unit's; a unit's fixture selects that unit's suites; a docs-only change
     selects no example's suite; the lockfile selects the whole seam;
  3. a narrowed run never rests on no answer: a deleted file and a Pants
     that fails the question each widen to the whole seam, and the last line
     says why;
  4. the last line keeps its format, and a narrowed one counts what ran
     against the whole seam;
  5. a wired suite runs in the sandbox and passes there, and the same suite
     fails on the missing file once its unit stops declaring it: a read
     nobody declared is loud;
  6. with no Pants on the PATH no suite runs and none is reported as passed.

WHAT A GREEN RUN DOES NOT COVER (this seam is blind to it):
  - the app: solve time (`just time`) and how a link renders and solves in
    sudokumaker.app. No link's bytes are meant to change in this spec, and
    nothing here opens one.
  - GitHub CI: that the workflow's Pants install step works and its four
    gate legs pass with every suite uncached. ci_workflow.test.py pins the
    workflow's text; only a run on GitHub shows it working, and the spec's
    integration pull request is that run.
  - the toolchain: node, uv and the Python interpreter are not sealed in the
    sandbox, so a result that changes with one of them is not caught here.
  - a selector miss in the field: a suite the full seam fails that a narrowed
    run did not select. The merge step counts those per merged pull request
    (`selector:` comments); this test only drives the cases it names.

Left to their own suites, not driven here: every listing rule on scratch
trees (seam_runner.test.py), the exception list (gate.test.py) and the named
cross-unit edges (known_edges.test.py).

    uv run examples/_shared/spec_809_closing.test.py
"""

import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))

from gate_lib import pants, pants_suites, run_logged, run_stubbed, runner_listing

RUNNER = ["bash", "tests/all.sh"]

HELPER = "examples/_shared/line-kind.js"
FIXTURE = "examples/up-to-n/PUZZLE_LINK_4x4.txt"
UP_TO_N = [
    "uv run examples/up-to-n/build_link.test.py",
    "node examples/up-to-n/end-to-end.test.mjs",
    "node examples/up-to-n/marker-contract.test.mjs",
    "node examples/up-to-n/update-strength.test.mjs",
    "node examples/up-to-n/soundness-harness.mjs",
]
# Reads line-kind.js through its component's `// #include`.
READS_HELPER = "node examples/up-to-n/update-strength.test.mjs"
# A suite of another unit whose component pulls in no line-kind.js.
NO_HELPER = "node examples/outside-sudoku/update-strength.test.mjs"
# Other units' suites: none reads up-to-n's fixture, and no doc.
OTHER_UNIT = [
    "node examples/outside-sudoku/update-strength.test.mjs",
    "uv run examples/skyscraper/build_link.test.py",
]
NEW_TEST = "examples/up-to-n/planted-809.test.mjs"
# A shared module two recovery probes and its own test import.
DELETED = "examples/_shared/recovery-lib.mjs"
STILL_IMPORTS = "node examples/_shared/recovery-lib.test.mjs"
# Read by path, through assembleSource, which no import shows.
SANDBOXED, UNDECLARED = "examples/up-to-n:marker-contract.test.mjs", "main.js"


def git(tree, *args):
    env = {k: v for k, v in os.environ.items() if not k.startswith("GIT_")}
    for who in ("AUTHOR", "COMMITTER"):
        env[f"GIT_{who}_NAME"] = "fixture"
        env[f"GIT_{who}_EMAIL"] = "fixture@example.invalid"
    r = subprocess.run(
        ["git", *args], cwd=tree, env=env, capture_output=True, text=True
    )
    assert r.returncode == 0, f"git {args} failed in the copy:\n{r.stderr}"
    return r.stdout


def copy_of_the_tree(tmp):
    """The tracked files of this tree as they are on disk, committed as `base`
    in a repository of their own: the real `BUILD` files and the real runner,
    and nothing a diff made here can reach."""
    tree = pathlib.Path(tmp) / "tree"
    for rel in git(ROOT, "ls-files", "-z").split("\0"):
        if rel and (ROOT / rel).is_file():
            (tree / rel).parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(ROOT / rel, tree / rel)
    git(tree, "init", "-q")
    git(tree, "add", "-A")
    git(tree, "commit", "-q", "-m", "base")
    git(tree, "tag", "base")
    return tree


def with_diff(tree, changed=(), deleted=(), added=()):
    git(tree, "reset", "-q", "--hard", "base")
    git(tree, "clean", "-qfd")
    for rel in changed:
        with (tree / rel).open("a") as f:
            f.write("\n")
    for rel in deleted:
        (tree / rel).unlink()
    for rel in added:
        (tree / rel).parent.mkdir(parents=True, exist_ok=True)
        (tree / rel).write_text("")
    git(tree, "add", "-A")
    git(tree, "commit", "-q", "-m", "change")


def narrowed(tree):
    return runner_listing("--changed", "base", root=tree)


def the_front_door_is_unchanged(tree, whole):
    assert whole == runner_listing(), "the copy lists other suites than the tree"
    assert len(whole) > 100 and set(UP_TO_N + OTHER_UNIT) <= set(whole), len(whole)

    with_diff(tree, changed=[FIXTURE], added=[NEW_TEST])
    new = f"node {NEW_TEST}"
    assert new in runner_listing(root=tree), "a new test file is not in the full run"
    got = narrowed(tree)
    assert new in got, "a new test file is not in the narrowed run"
    return got


def a_diff_selects_what_it_can_affect(tree, whole, for_fixture):
    with_diff(tree, changed=[HELPER])
    got = narrowed(tree)
    assert READS_HELPER in got, f"{HELPER} does not select {READS_HELPER}"
    assert NO_HELPER not in got, f"{HELPER} selects {NO_HELPER}, which does not read it"

    got = for_fixture
    assert set(UP_TO_N) <= set(got), f"{FIXTURE} misses {set(UP_TO_N) - set(got)}"
    for suite in OTHER_UNIT:
        assert suite not in got, f"{FIXTURE} selects {suite}"

    with_diff(tree, changed=["docs/gotchas.md"])
    got = narrowed(tree)
    assert "npx standard" in got, "a docs-only change drops lint"
    for suite in UP_TO_N + OTHER_UNIT:
        assert suite not in got, f"a docs-only change selects {suite}"
    assert len(got) < len(whole) / 2, f"a docs-only change selects {len(got)} suites"

    with_diff(tree, changed=["uv.lock"])
    assert sorted(narrowed(tree)) == sorted(whole), "uv.lock is not the whole seam"


def last_line(r):
    assert r.stdout.strip(), f"the run printed nothing:\n{r.stderr}"
    return r.stdout.splitlines()[-1]


def no_answer_widens(tree, whole):
    m = len(whole)

    with_diff(tree, deleted=[DELETED])
    assert STILL_IMPORTS in whole
    assert sorted(narrowed(tree)) == sorted(whole), (
        f"deleting {DELETED} narrows the run past {STILL_IMPORTS}"
    )

    # The stub fails the question "what does the diff affect".
    with_diff(tree, changed=[FIXTURE])
    r, ran = run_stubbed([*RUNNER, "--changed", "base"], root=tree)
    assert sorted(ran) == sorted(whole), f"a failed question ran {len(ran)} suites"
    assert last_line(r) == (
        f"{m} of {m} suites passed (widened: Pants could not say what the diff affects)"
    ), last_line(r)


def the_last_line_keeps_its_format(tree, whole):
    """A narrowed run on Pants's real answer for the diff, every tool stubbed:
    the count is what ran, against the whole seam."""
    with_diff(tree, changed=[FIXTURE])
    answer = pants(
        "--changed-since=base", "--changed-dependents=transitive", "list", root=tree
    )
    assert answer.returncode == 0, answer.stderr
    r, ran = run_stubbed(
        [*RUNNER, "--changed", "base"], root=tree, changed=answer.stdout.split()
    )
    assert r.returncode == 0, f"{r.stdout}{r.stderr}"
    assert sorted(ran) == sorted(narrowed(tree)), "the run is not its own listing"
    said = re.fullmatch(
        r"(\d+) of (\d+) suites passed \(narrowed: (.+)\)", last_line(r)
    )
    assert said, last_line(r)
    n, m, units = int(said[1]), int(said[2]), said[3].split()
    assert (n, m) == (len(ran), len(whole)) and n < m, last_line(r)
    assert "examples/up-to-n" in units, last_line(r)

    r, ran = run_stubbed(RUNNER, root=tree)
    assert last_line(r) == f"{len(whole)} of {len(whole)} suites passed", last_line(r)


def an_undeclared_read_is_loud(tree):
    """The real Pants on a real suite: green with the unit declared, and red
    on the file itself once the unit stops declaring its code."""
    git(tree, "reset", "-q", "--hard", "base")
    r = pants("test", SANDBOXED, root=tree)
    assert r.returncode == 0, f"{SANDBOXED} fails in its sandbox:\n{r.stderr}"

    # Every unit's suites get their code from the one `unit(...)`, so the
    # prelude is where a unit stops declaring it.
    prelude = tree / "tests/pants_prelude.py"
    declared = 'needs=[":py", ":js", ":data", *needs],'
    assert declared in prelude.read_text(), "the prelude's unit no longer reads this way"
    prelude.write_text(
        prelude.read_text().replace(declared, 'needs=[":data", *needs],')
    )
    r = pants("test", SANDBOXED, root=tree)
    assert r.returncode != 0, f"{SANDBOXED} passes with {UNDECLARED} undeclared"
    assert any(
        "ENOENT" in line and f"examples/up-to-n/{UNDECLARED}" in line
        for line in (r.stdout + r.stderr).splitlines()
    ), f"the failure is not {UNDECLARED} missing from the sandbox:\n{r.stderr}"


def no_pants_runs_nothing(tree):
    git(tree, "reset", "-q", "--hard", "base")
    r, log = run_logged(RUNNER, root=tree, absent=("pants",))
    assert r.returncode == 2, f"exit {r.returncode}, not 2:\n{r.stdout}{r.stderr}"
    assert "Install the Pants launcher" in r.stderr, r.stderr
    assert (r.stdout, log) == ("", []), f"a suite ran with no Pants: {r.stdout}{log}"


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        tree = copy_of_the_tree(tmp)
        whole = runner_listing(root=tree)
        assert pants_suites(tree), "the copy wires no suite"
        for_fixture = the_front_door_is_unchanged(tree, whole)
        a_diff_selects_what_it_can_affect(tree, whole, for_fixture)
        no_answer_widens(tree, whole)
        the_last_line_keeps_its_format(tree, whole)
        an_undeclared_read_is_loud(tree)
        no_pants_runs_nothing(tree)
    print("spec_809_closing.test.py: ok")
