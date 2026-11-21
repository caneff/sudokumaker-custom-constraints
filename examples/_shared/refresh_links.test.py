"""`build_link.py --refresh` keeps every committed link in step with the tree.

Every case runs in a copy of the examples tree, never the checkout:

  1. a real change to every shared backend file, then every example's
     `build_link.py --refresh`, leaves the layout gate with no violation at
     all -- no stale backend anywhere;
  2. on the unchanged tree, every example's `build_link.py --refresh` rebuilds
     every committed link byte for byte.

Blind to the app: whether a refreshed link opens and solves in
sudokumaker.app. isofill's and fillomino's links past PUZZLE_LINK.txt are
`bareboard`'s rebuild of that one board and embed no shared code, so case 1
cannot see a refresh that skips them.

    uv run examples/_shared/refresh_links.test.py
"""

import pathlib
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
EXAMPLES = HERE.parent
REPO = EXAMPLES.parent
sys.path.insert(0, str(HERE))

from document import SHARED_BACKENDS

PROBE = "const REFRESH_PROBE = 1\n"


def copy_of_tree(tmp):
    """The examples tree and the one doc its code reads, under `tmp`; returns
    the copied examples directory."""
    root = pathlib.Path(tmp)
    shutil.copytree(
        EXAMPLES, root / "examples", ignore=shutil.ignore_patterns("__pycache__")
    )
    (root / "docs").mkdir()
    shutil.copy(REPO / "docs/builtin-components.md", root / "docs")
    return root / "examples"


def run(*args):
    return subprocess.run(
        [sys.executable, *map(str, args)], capture_output=True, text=True, timeout=600
    )


def refresh_every_example(examples):
    builders = sorted(examples.glob("*/build_link.py"))
    assert len(builders) >= 13, "the link builders moved: fix the glob"
    for builder in builders:
        done = run(builder, "--refresh")
        assert done.returncode == 0, (builder.parent.name, done.stderr)


def gate(examples):
    """The layout gate's violations on the copy, run from the copy so it
    reads the copy's shared backends."""
    done = run(examples / "_shared/check_layout.py", examples)
    return [line for line in done.stdout.splitlines() if ": " in line]


def a_shared_backend_change_is_refreshed_away():
    with tempfile.TemporaryDirectory() as tmp:
        examples = copy_of_tree(tmp)
        shared = examples / "_shared"
        for b in SHARED_BACKENDS:
            for stem in filter(None, (b.stem, b.component)):
                f = shared / f"{stem}.js"
                f.write_text(f.read_text() + PROBE)
        stale = [v for v in gate(examples) if "embeds a stale copy" in v]
        assert stale, "the planted backend change staled no link: the probe is dead"
        refresh_every_example(examples)
        violations = gate(examples)
        assert violations == [], violations


def every_link_rebuilds_byte_for_byte():
    with tempfile.TemporaryDirectory() as tmp:
        examples = copy_of_tree(tmp)
        links = sorted(examples.rglob("*.txt"))
        before = {p: p.read_bytes() for p in links}
        refresh_every_example(examples)
        changed = [
            p.relative_to(examples).as_posix()
            for p in links
            if p.read_bytes() != before[p]
        ]
        assert changed == [], f"--refresh changed committed links: {changed}"


if __name__ == "__main__":
    a_shared_backend_change_is_refreshed_away()
    every_link_rebuilds_byte_for_byte()
    print("ok")
