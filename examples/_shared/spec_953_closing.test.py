"""One end-to-end test for spec #953, the real-app timing path: app_timing
builds every row and owns the busy note, the timing path calls its links
searchable links, and every browser script opens a link through openLink
(slices #965-#967).

Driven here, on a copy of the real up-to-n example committed into a git
repository of its own (as spec_895_closing.test.py does), with only the app
faked (app_timing_fake.fake_solve):

  1. `just time` (time_example.run) on an edited component, with busy reps in
     both modes: both rows carry the busy note and the two-row verdict still
     reads both ratios; on the unchanged example (baseline only) both rows
     carry it too, with no verdict. Then `just time-link` (time_link.run) on
     the committed link, busy in both modes: both rows carry it.
  2. The plumbing moved for good: the cold/after-logical loop lives only in
     app_timing.time_modes, time_example no longer patches a finished row
     (_flag_busy) or recomputes a ratio (row_ratio).
  3. "probe" is gone from the live timing path: no tracked file outside the
     frozen docs/research/ names probe_link, baseline_probe or candidate_probe,
     except the two DNF lines examples/up-to-n/README.md records verbatim.
  4. One open: no browser script but app-session.mjs calls page.goto,
     app-strip.mjs and dutch-flatmates' app-open.mjs import openLink, nothing
     passes afterOpen, and the marks-refusal phrase lives in app-solve-lib.mjs
     alone.

WHAT A GREEN RUN DOES NOT COVER (this seam, `just check-full`, is blind to it):
  - the app: the rows `just time up-to-n` prints in a real Chromium on the
    recorded app, and app-strip.mjs and app-open.mjs actually opening a link
    there through openLink. The closing check on #953 opens each once.
  - openLink's clicks against the live DOM: app-session.test.mjs drives them on
    a stub page and on the recorded app; a change in sudokumaker.app's
    settings dialog shows only in a live run.

    uv run examples/_shared/spec_953_closing.test.py
"""

import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
EXAMPLES = HERE.parent
ROOT = EXAMPLES.parent
sys.path.insert(0, str(HERE))

import app_timing
import time_example
import time_link
from app_timing_fake import fake_solve

EXAMPLE = "up-to-n"
COMPONENT = "UpToNComponent"
EDIT = "\nconst SPEC_953_EDIT = 1\n"
R = app_timing.REPS
B, C = "baseline_searchable.txt", "candidate_searchable.txt"
HOT = {"loads": [{"before": 27.7, "after": 3.0}], "busy": True, "loadThreshold": 16}
NOTE = " (BUSY load 27.7 > 16) |"


def _committed_copy(root):
    """examples/up-to-n and examples/_shared/*.js copied under root and
    committed, so time_example's HEAD reads see a real history."""
    examples = root / "examples"
    shutil.copytree(EXAMPLES / EXAMPLE, examples / EXAMPLE)
    (examples / "_shared").mkdir()
    for js in HERE.glob("*.js"):
        shutil.copy(js, examples / "_shared" / js.name)
    git = ["git", "-C", str(root)]
    subprocess.run([*git, "init", "-q"], check=True)
    subprocess.run([*git, "add", "-A"], check=True)
    subprocess.run(
        [*git, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base"],
        check=True,
    )
    return examples / EXAMPLE


def the_busy_note_stays_on_every_row(example_dir):
    with fake_solve({B: [(1000, HOT)] + [1000] * (R - 1) + [(900, HOT)] * R}):
        rows, ship = time_example.run(example_dir)
    assert [v for _r, v in rows] == ["BASELINE", "BASELINE"], rows
    for row, _verdict in rows:
        assert row.endswith("| BASELINE" + NOTE), row
    assert ship is None

    component = example_dir / f"{COMPONENT}.js"
    component.write_text(component.read_text() + EDIT)
    with fake_solve(
        {
            B: [1000] * R + [(800, HOT)] + [800] * (R - 1),
            C: [(500, HOT)] + [500] * (R - 1) + [400] * R,
        }
    ):
        rows, ship = time_example.run(example_dir)
    for row, verdict in rows:
        assert verdict == "PASS", rows
        assert row.endswith("| PASS" + NOTE), row
    assert ship == "SHIP"

    link = example_dir / "PUZZLE_LINK.txt"
    with fake_solve({link.name: [(1000, HOT)] + [1000] * (R - 1) + [(50, HOT)] * R}):
        rows = time_link.run(link)
    assert len(rows) == 2, rows
    for row in rows:
        assert row.endswith("| —" + NOTE), row


def the_plumbing_lives_in_app_timing():
    loop = "for after_logical"
    assert loop in (HERE / "app_timing.py").read_text()
    for name in ("time_example.py", "time_link.py"):
        source = (HERE / name).read_text()
        assert loop not in source, f"{name} loops the modes itself"
    example_source = (HERE / "time_example.py").read_text()
    assert "row_ratio" not in example_source, "time_example recomputes a ratio"
    assert not hasattr(time_example, "_flag_busy")


PROBE = re.compile(r"\b(probe_link|baseline_probe|candidate_probe)\b")
# Recorded verbatim DNF lines (AGENTS.md: post the DNF verbatim): frozen, like
# docs/research/.
VERBATIM = {
    "examples/up-to-n/README.md": {
        "RuntimeError: app-solve.mjs: /tmp/tmpejo5jlc9/baseline_probe.txt: "
        "all 3 reps hit the 300s per-rep timeout (3 timed out)",
        "RuntimeError: app-solve.mjs: /tmp/tmpuz1_9pfc/candidate_probe.txt: "
        "all 3 reps hit the 300s per-rep timeout (3 timed out)",
    }
}
TEXT = {".py", ".mjs", ".js", ".md", ".txt", ".toml", ""}


SKIP_DIRS = {".git", ".venv", "node_modules", ".scratch", "__pycache__", ".ruff_cache"}


def _text_files():
    """Every text file under the repo root but the frozen docs/research/,
    build and cache directories, and this test (which names the old words)."""
    for dirpath, dirnames, filenames in os.walk(ROOT):
        here = pathlib.Path(dirpath)
        rel_dir = here.relative_to(ROOT).as_posix()
        dirnames[:] = [
            d
            for d in dirnames
            if d not in SKIP_DIRS and f"{rel_dir}/{d}".lstrip("./") != "docs/research"
        ]
        for name in filenames:
            path = here / name
            if path.suffix in TEXT and name != "spec_953_closing.test.py":
                yield path.relative_to(ROOT).as_posix(), path


def the_timing_path_says_searchable_link():
    hits = []
    for rel, path in _text_files():
        try:
            lines = path.read_text().splitlines()
        except UnicodeDecodeError:
            continue
        allowed = VERBATIM.get(rel, set())
        hits += [
            f"{rel}: {ln}" for ln in lines if PROBE.search(ln) and ln not in allowed
        ]
    assert not hits, "probe names left on the timing path:\n" + "\n".join(hits)
    assert (HERE / "searchable_link.py").is_file()
    assert not (HERE / "probe_link.py").exists()


def every_script_opens_through_open_link():
    scripts = [p for p in EXAMPLES.rglob("*.mjs") if "node_modules" not in p.parts]
    for path in scripts:
        source = path.read_text()
        rel = path.relative_to(ROOT).as_posix()
        assert "afterOpen" not in source, f"{rel} still passes afterOpen"
        if path.name.endswith(".test.mjs"):
            continue
        if path.name != "app-session.mjs":
            assert "page.goto(" not in source, f"{rel} opens a link itself"
        if path.name != "app-solve-lib.mjs":
            code = re.sub(r"//.*", "", source)
            assert "already entered values" not in code, f"{rel} words its own refusal"
    for rel in ("_shared/app-strip.mjs", "dutch-flatmates/app-open.mjs"):
        source = (EXAMPLES / rel).read_text()
        assert re.search(r"import \{[^}]*\bopenLink\b[^}]*\} from '", source), rel


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        example_dir = _committed_copy(pathlib.Path(tmp) / "repo")
        the_busy_note_stays_on_every_row(example_dir)
    the_plumbing_lives_in_app_timing()
    the_timing_path_says_searchable_link()
    every_script_opens_through_open_link()
    print("spec_953_closing.test.py: ok")
