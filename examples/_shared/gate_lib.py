# Shared helper for tests that need to know what a `just` recipe or the seam
# runner (`tests/all.sh`) actually runs. Used by gate.test.py (check vs
# check-full), ci_workflow.test.py (the CI matrix vs check-full),
# recipe_discovery.test.py and seam_runner.test.py, so all of them compare
# against the same ground truth.

import functools
import json
import os
import pathlib
import shutil
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parents[2]

STUB = '#!/bin/sh\necho "$(basename "$0") $*" >> "$GATE_LOG"\n'

# The stand-in for Pants. It logs like the others and answers the runner's
# three questions. Which test targets are there: what the real Pants said.
# What does a diff affect: the addresses in $GATE_PANTS_CHANGED, and a failure
# when that file is not there. Run these targets: one result line per target,
# as the real Pants prints it, but none for $GATE_PANTS_UNREPORTED.
PANTS_STUB = (
    STUB
    + """case " $* " in
  *" --changed-since="*)
    [ -r "$GATE_PANTS_CHANGED" ] || { echo "planted: no answer" >&2; exit 1; }
    cat "$GATE_PANTS_CHANGED" ;;
  *" list "*) cat "$GATE_PANTS_TARGETS" ;;
  *" test "*)
    for arg; do
      case $arg in
        -* | test | "$GATE_PANTS_UNREPORTED") ;;
        *) echo "✓ $arg succeeded in 0.00s." ;;
      esac
    done ;;
esac
"""
)

TOOLS = ("node", "npx", "uv", "uvx", "pants")

# The two root targets tests/pants_prelude.py puts under every wired suite, as
# a scratch tree's root BUILD file declares them.
ROOT_BUILD = (
    'files(name="uvproject", sources=["pyproject.toml", "uv.lock"])\n'
    'files(name="runner", sources=[".gitignore", "pants.toml", "tests/all.sh", '
    '"tests/pants_prelude.py"])\n'
)

# The shared tests that cannot run in Pants's sandbox, one per line:
# `<test file> <reason>`. An entry stays on the runner's own loop for good.
EXCEPTIONS = "tests/sandbox-exceptions.txt"


def sandbox_exceptions(root=ROOT):
    """The exception list under `root`: test file -> why it cannot run in the
    sandbox. An entry with no reason, or a file named twice, fails here."""
    listed = {}
    for line in (root / EXCEPTIONS).read_text().splitlines():
        if not line.strip() or line.startswith("#"):
            continue
        file, _, reason = line.partition(" ")
        assert reason.strip(), f"{EXCEPTIONS}: {file} has no reason"
        assert file not in listed, f"{EXCEPTIONS}: {file} is listed twice"
        listed[file] = reason.strip()
    return listed


def pants(*args, root=ROOT, env=None):
    """The real Pants, run from `root` with its work directory outside the
    tree and removed afterwards: a test leaves no `.pants.d/` behind. `env`
    adds to the environment."""
    with tempfile.TemporaryDirectory() as workdir:
        return subprocess.run(
            ["pants", *args],
            cwd=root,
            env={**os.environ, **(env or {}), "PANTS_WORKDIR": workdir},
            capture_output=True,
            text=True,
        )


def suite_of(address):
    """The suite a test target runs, as the runner names it: the target of
    `uv run <directory>/<file>` or `node <directory>/<file>` is
    `<directory>:<file>` (tests/pants_prelude.py)."""
    directory, file = address.split(":")
    run = "uv run" if file.endswith(".py") else "node"
    return f"{run} {directory}/{file}"


@functools.cache
def pants_suites(root=ROOT):
    """The suites Pants runs in its sandbox under `root`: target address ->
    the suite, read from the real Pants. The command each target runs must
    start that suite's tool on that suite's file. A tree with no pants.toml
    has none."""
    if not (root / "pants.toml").exists():
        return {}
    r = pants("--filter-target-type=test_shell_command", "peek", "::", root=root)
    assert r.returncode == 0, f"pants peek failed in {root}:\n{r.stderr}"
    suites = {}
    for target in json.loads(r.stdout or "[]"):
        suite = suite_of(target["address"])
        tool, file = suite.rsplit(" ", 1)
        said = target["command"].split()
        assert said[-1] == file and tool.split()[0] in said, (
            f"{target['address']} runs `{target['command']}`, not {suite}"
        )
        suites[target["address"]] = suite
    return suites


def path_without(names):
    """PATH with every directory that holds one of `names` dropped."""
    return os.pathsep.join(
        d
        for d in os.environ["PATH"].split(os.pathsep)
        if not any(os.access(pathlib.Path(d) / n, os.X_OK) for n in names)
    )


def run_logged(argv, root=ROOT, real=(), absent=(), changed=None, unreported=""):
    """Run `argv` from `root` with node, npx, uv, uvx and pants replaced by
    stubs that log their argv and exit 0, except the names in `real`; a name in
    `absent` is on the PATH neither as a stub nor for real. The Pants stub
    answers "what does the diff affect" with the addresses in `changed`, and
    fails that question when `changed` is None; it reports every target it is
    told to run as passed, except `unreported`. Returns the finished process
    and the log, one line per stubbed call, in order."""
    with tempfile.TemporaryDirectory() as tmp:
        bin_dir = pathlib.Path(tmp) / "bin"
        bin_dir.mkdir()
        targets = pathlib.Path(tmp) / "targets"
        targets.write_text("")
        affected = pathlib.Path(tmp) / "changed"
        if changed is not None:
            affected.write_text("".join(f"{a}\n" for a in changed))
        for name in TOOLS:
            if name in real or name in absent:
                continue
            if name == "pants":
                targets.write_text("".join(f"{a}\n" for a in pants_suites(root)))
            stub = bin_dir / name
            stub.write_text(PANTS_STUB if name == "pants" else STUB)
            stub.chmod(0o755)
        log = pathlib.Path(tmp) / "log"
        log.touch()
        env = {
            **os.environ,
            "PATH": f"{bin_dir}{os.pathsep}{path_without(absent)}",
            "GATE_LOG": str(log),
            "GATE_PANTS_TARGETS": str(targets),
            "GATE_PANTS_CHANGED": str(affected),
            "GATE_PANTS_UNREPORTED": unreported,
        }
        r = subprocess.run(argv, cwd=root, env=env, capture_output=True, text=True)
        return r, log.read_text().splitlines()


def by_mechanism(log, root=ROOT):
    """Splits a log into the suites the runner's own loop ran and the suites
    it sent through Pants, each as the suite's command, in order. The
    runner's questions to Pants are not suites and are in neither."""
    loop, pants = [], []
    for line in log:
        tool, *args = line.split()
        if tool != "pants":
            loop.append(line)
        elif "test" in args:
            for address in args[args.index("test") + 1 :]:
                assert address in pants_suites(root), f"no Pants test target {address}"
                pants.append(pants_suites(root)[address])
        else:
            assert "list" in args, f"the runner calls Pants for something else: {line}"
    return loop, pants


def run_stubbed(argv, root=ROOT, real=(), **stub):
    """`run_logged`, with each suite sent through Pants read back as the
    command it runs: the suites `argv` ran, by either mechanism, in order."""
    r, log = run_logged(argv, root, real, **stub)
    loop, pants = by_mechanism(log, root)
    return r, loop + pants


def just_executable():
    just = os.environ.get("JUST") or shutil.which("just")
    assert just, "no just executable: set JUST or put just on PATH"
    return just


def commands(recipe, root=ROOT):
    """The commands `just <recipe>` runs from `root`, one string each, in order."""
    r, ran = run_stubbed(
        [just_executable(), "--justfile", str(root / "justfile"), recipe], root
    )
    assert r.returncode == 0, f"just {recipe} failed:\n{r.stdout}{r.stderr}"
    return ran


def gate_tree(tmp):
    """A scratch tree holding the gate itself -- the justfile and the seam
    runner it calls -- and no test file."""
    tree = pathlib.Path(tmp)
    shutil.copy(ROOT / "justfile", tree / "justfile")
    shutil.copytree(ROOT / "tests", tree / "tests")
    return tree


def runner_listing(*args, root=ROOT):
    """The suites `tests/all.sh --list <args>` names from `root`, in order."""
    r = subprocess.run(
        ["bash", "tests/all.sh", "--list", *args],
        cwd=root,
        capture_output=True,
        text=True,
    )
    assert r.returncode == 0, f"tests/all.sh --list {args} failed:\n{r.stderr}"
    return r.stdout.splitlines()
