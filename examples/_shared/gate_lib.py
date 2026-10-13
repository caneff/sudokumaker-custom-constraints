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

# The stand-in for Pants: it logs like the others, and answers the runner's
# question -- which test targets are there? -- with what the real Pants said.
PANTS_STUB = STUB + 'case " $* " in *" list "*) cat "$GATE_PANTS_TARGETS" ;; esac\n'

TOOLS = ("node", "npx", "uv", "uvx", "pants")


@functools.cache
def pants_suites(root=ROOT):
    """The suites Pants runs in its sandbox under `root`: target address ->
    the command that target runs, read from the real Pants. A tree with no
    pants.toml has none."""
    if not (root / "pants.toml").exists():
        return {}
    r = subprocess.run(
        ["pants", "--filter-target-type=test_shell_command", "peek", "::"],
        cwd=root,
        capture_output=True,
        text=True,
    )
    assert r.returncode == 0, f"pants peek failed in {root}:\n{r.stderr}"
    return {t["address"]: t["command"] for t in json.loads(r.stdout or "[]")}


def path_without(names):
    """PATH with every directory that holds one of `names` dropped."""
    return os.pathsep.join(
        d
        for d in os.environ["PATH"].split(os.pathsep)
        if not any(os.access(pathlib.Path(d) / n, os.X_OK) for n in names)
    )


def run_logged(argv, root=ROOT, real=(), absent=()):
    """Run `argv` from `root` with node, npx, uv, uvx and pants replaced by
    stubs that log their argv and exit 0, except the names in `real`; a name in
    `absent` is on the PATH neither as a stub nor for real. Returns the
    finished process and the log, one line per stubbed call, in order."""
    with tempfile.TemporaryDirectory() as tmp:
        bin_dir = pathlib.Path(tmp) / "bin"
        bin_dir.mkdir()
        targets = pathlib.Path(tmp) / "targets"
        targets.write_text("")
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
        }
        r = subprocess.run(argv, cwd=root, env=env, capture_output=True, text=True)
        return r, log.read_text().splitlines()


def by_mechanism(log, root=ROOT):
    """Splits a log into the suites the runner's own loop ran and the suites
    it sent through Pants, each as the suite's command, in order. The
    runner's question to Pants is not a suite and is in neither."""
    loop, pants = [], []
    for line in log:
        tool, *args = line.split()
        if tool != "pants":
            loop.append(line)
        elif "test" in args:
            (address,) = args[args.index("test") + 1 :]
            assert address in pants_suites(root), f"no Pants test target {address}"
            pants.append(pants_suites(root)[address])
        else:
            assert "list" in args, f"the runner calls Pants for something else: {line}"
    return loop, pants


def run_stubbed(argv, root=ROOT, real=()):
    """`run_logged`, with each suite sent through Pants read back as the
    command it runs: the suites `argv` ran, by either mechanism, in order."""
    r, log = run_logged(argv, root, real)
    ran = []
    for line in log:
        loop, pants = by_mechanism([line], root)
        ran += loop + pants
    return r, ran


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
