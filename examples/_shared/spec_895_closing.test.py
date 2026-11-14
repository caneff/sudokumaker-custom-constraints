"""One end-to-end test for spec #895: `just time` builds its candidate
in-process, the app-timing driver lives in its own module, and the direct
lzstring dependency is gone (slices #899-#902).

Driven here, on a copy of the real up-to-n example (and the shared files its
code includes) committed into a git repository of its own, so the HEAD reads
`just time` makes see a real history without this repo's `.git`:

  1. the in-process candidate build (time_example.build_candidate_doc, through
     link_swap.swap_build, with no build_link.py in the example): an unchanged
     component reads byte-equal and its candidate ships the committed code, an
     edited one does not and its candidate ships the edit;
  2. `run()` on that edited example, with only the app faked
     (app_timing_fake.fake_solve), prints the cold and after-logical rows and
     the two-row verdict in the format docs/real-app-timing.md pins;
  3. no app-timing driver name is reachable from time_example: the driver is
     app_timing's alone, and the deleted subprocess build and output parser
     are gone from both modules;
  4. pyproject.toml declares no lzstring dependency.

WHAT A GREEN RUN DOES NOT COVER (this seam, `just check-full`, is blind to it):
  - the app: `just time up-to-n`'s real timing (its rows printed by a real
    Chromium on the recorded app, which the closing check on #895 opens once
    as a format smoke check), and `app-strip.mjs` in a browser, whose verdict
    shape and output JSON that same check reads by hand.
  - every other example's candidate build: time_example.test.py builds its own
    fixtures, and link_swap.test.py swaps into shipped boards.

    uv run examples/_shared/spec_895_closing.test.py
"""

import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import tomllib

HERE = pathlib.Path(__file__).resolve().parent
EXAMPLES = HERE.parent
ROOT = EXAMPLES.parent
sys.path.insert(0, str(HERE))

import app_timing
import time_example
from app_timing_fake import VERSION, fake_solve
from sudoku_kit.link_codec import decode_puzzle

EXAMPLE = "up-to-n"
COMPONENT = "UpToNComponent"
# A real change to update's code, which minify keeps (a comment it would drop).
EDIT = "\nconst SPEC_895_EDIT = 1\n"


def _committed_copy(root):
    """examples/up-to-n and examples/_shared/*.js copied under root and
    committed, so time_example's HEAD reads see a real history. The example's
    build_link.py is left out: `just time` must not need it. Returns the
    copied example directory."""
    examples = root / "examples"
    shutil.copytree(
        EXAMPLES / EXAMPLE,
        examples / EXAMPLE,
        ignore=shutil.ignore_patterns("build_link.py"),
    )
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


def _component_code(link_file):
    return time_example.shipped_component_code(
        decode_puzzle(link_file.read_text().strip())
    )[COMPONENT]


def the_candidate_builds_in_process(example_dir, tmp):
    assert not (example_dir / "build_link.py").exists()
    base_doc = decode_puzzle((example_dir / "PUZZLE_LINK.txt").read_text().strip())
    committed = time_example.shipped_component_code(base_doc)[COMPONENT]
    component = time_example.find_component_file(example_dir, base_doc)
    assert component == example_dir / f"{COMPONENT}.js", component

    unchanged = tmp / "unchanged.txt"
    assert time_example.build_candidate_doc(
        example_dir, component, unchanged, base_doc
    ), "an unchanged component must read byte-equal"
    assert _component_code(unchanged) == committed

    component.write_text(component.read_text() + EDIT)
    edited = tmp / "edited.txt"
    assert not time_example.build_candidate_doc(
        example_dir, component, edited, base_doc
    ), "an edited component must not read byte-equal"
    assert "SPEC_895_EDIT" in _component_code(edited)
    assert "SPEC_895_EDIT" not in committed


def the_rows_keep_their_format(example_dir):
    """`run()` on the edited example: two rows and a SHIP verdict, each row in
    the seven-column format docs/real-app-timing.md pins."""
    r = app_timing.REPS
    b, c = "baseline_searchable.txt", "candidate_searchable.txt"
    with fake_solve({b: [1000] * r + [800] * r, c: [500] * r + [400] * r}) as calls:
        rows, ship = time_example.run(example_dir)
    assert len(calls) == 4 * r, calls
    date = r"\d{4}-\d{2}-\d{2}"
    version = re.escape(VERSION)
    want = [
        rf"^\| {date} \| {version} \| {EXAMPLE} \| 1000ms \| 500ms \| 0\.50 \| PASS \|$",
        rf"^\| {date} \| {version} \| {EXAMPLE} after-logical \| 800ms \| 400ms "
        rf"\| 0\.50 \| PASS \|$",
    ]
    assert len(rows) == 2, rows
    for (row, verdict), pattern in zip(rows, want, strict=True):
        assert re.match(pattern, row), row
        assert verdict == "PASS"
    assert ship == "SHIP"


DRIVER_NAMES = [
    "APP_SOLVE",
    "REPS",
    "app_solve",
    "build_link_row",
    "build_row",
    "busy_note",
    "check_app_solve_result",
    "combine_reps",
    "read_app_solve_json",
    "rep_order",
    "row_ratio",
    "ratio_cell",
    "run_app_solve",
    "ship_verdict",
    "time_modes",
]
# Deleted by the spec: the subprocess candidate build and the output parser.
GONE = ["build_candidate", "parse_app_solve_output"]


def the_driver_is_app_timing_s_alone():
    for name in DRIVER_NAMES:
        assert hasattr(app_timing, name), f"app_timing lost {name}"
        assert not hasattr(time_example, name), f"time_example still has {name}"
    for name in GONE:
        for module in (app_timing, time_example):
            assert not hasattr(module, name), f"{module.__name__} still has {name}"


def no_lzstring_dependency():
    project = tomllib.loads((ROOT / "pyproject.toml").read_text())["project"]
    deps = [
        re.split(r"[<>=!~\[; ]", d, maxsplit=1)[0].lower()
        for d in project["dependencies"]
    ]
    assert "lzstring" not in deps, deps
    assert "sudoku-kit" in deps, deps


if __name__ == "__main__":
    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)
        example_dir = _committed_copy(tmp / "repo")
        the_candidate_builds_in_process(example_dir, tmp)
        the_rows_keep_their_format(example_dir)
    the_driver_is_app_timing_s_alone()
    no_lzstring_dependency()
    print("spec_895_closing.test.py: ok")
