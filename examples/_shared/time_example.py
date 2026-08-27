# `just time <example>` -- the shared real-app timing driver. Builds a
# same-board pair (docs/real-app-timing.md): the committed PUZZLE_LINK.txt is
# the baseline, and the example's build_link.py rebuilds a candidate from the
# working-tree component. Both are emptied (probe_link.py) and timed
# (app-solve.mjs), 3 reps each, non-deterministic solve off. Prints one
# paste-ready row: date, app version, board, baseline median, candidate
# median, ratio, PASS/FAIL. When the candidate's constraint code is
# byte-equal to the baseline's, times the baseline only and prints a
# baseline row.
#
#   uv run --with lzstring examples/_shared/time_example.py <example>
#
# Stays out of `just check`: it drives the live site (docs/real-app-timing.md).

import argparse
import datetime
import json
import pathlib
import re
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))

from link_codec import decode_puzzle
from probe_link import empty_link_file

APP_SOLVE = HERE / "app-solve.mjs"
JSON_LINE = re.compile(r"^JSON: (.+)$", re.MULTILINE)
REPS = 3


def registered_components(doc):
    """name -> code for every component registered on any constraint."""
    result = {}
    for c in doc["puzzle"]["constraints"]:
        for comp in c.get("definition", {}).get("components", []):
            result[comp["name"]] = comp["code"]
    return result


TIMED_COMPONENT_RE = re.compile(r'^TIMED_COMPONENT\s*=\s*"([^"]+)"', re.MULTILINE)


def read_timed_component(example_dir):
    """The name in build_link.py's TIMED_COMPONENT = "..." line, or None if
    the example declares no such constant. Reads the file as text -- no
    import -- so a side-effect-heavy build_link.py module body never runs."""
    build_link_py = example_dir / "build_link.py"
    m = TIMED_COMPONENT_RE.search(build_link_py.read_text())
    return m.group(1) if m else None


def find_component_file(example_dir, base_doc):
    """The working-tree component file the timing loop follows.

    If build_link.py declares TIMED_COMPONENT = "<Name>", that name settles
    it: <example_dir>/<Name>.js, or a loud failure naming the problem
    (missing file, or a name not registered on the base doc).

    Otherwise, the one registered component with a same-named .js file on
    disk. Raises if none or more than one file matches: a silent pick among
    several would time the wrong edit (CODING_STANDARDS: fail loud)."""
    names = sorted(registered_components(base_doc))

    declared = read_timed_component(example_dir)
    if declared is not None:
        if declared not in names:
            raise ValueError(
                f"{example_dir.name}'s TIMED_COMPONENT ({declared!r}) is not "
                f"a registered component ({', '.join(names)})"
            )
        component_file = example_dir / f"{declared}.js"
        if not component_file.exists():
            raise FileNotFoundError(
                f"{example_dir.name}'s TIMED_COMPONENT ({declared!r}) has no "
                f"working-tree file at {component_file}"
            )
        return component_file

    matches = [n for n in names if (example_dir / f"{n}.js").exists()]
    if not matches:
        raise FileNotFoundError(
            f"no working-tree component file in {example_dir} for any of "
            f"the registered components ({', '.join(names)})"
        )
    if len(matches) > 1:
        raise ValueError(
            f"{example_dir.name} has a working-tree file for more than one "
            f"registered component ({', '.join(matches)}); time_example.py "
            "follows only one"
        )
    return example_dir / f"{matches[0]}.js"


def build_candidate(example_dir, component_file, out_path, board=None):
    """Build the candidate link via the example's build_link.py. `board`
    (None = the example's PUZZLE_LINK.txt) is passed as --board, which only
    skyscraper's build_link.py takes; any other example fails loud here rather
    than inside build_link.py's argument parser."""
    if board and "--board" not in (example_dir / "build_link.py").read_text():
        raise SystemExit(f"{example_dir.name}/build_link.py has no --board flag")
    cmd = [
        "uv",
        "run",
        "--with",
        "lzstring",
        str(example_dir / "build_link.py"),
        "--component",
        str(component_file),
        "--out",
        str(out_path),
    ]
    if board:
        cmd += ["--board", str(example_dir / board)]
    subprocess.run(
        cmd,
        check=True,
        capture_output=True,
        text=True,
    )


def run_app_solve(link_path, ring_clues=False):
    """Run the real-app timing driver and return its {median, version}."""
    cmd = ["node", str(APP_SOLVE), str(link_path), str(REPS)]
    if ring_clues:
        cmd.append("--ring-clues")
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        raise RuntimeError(f"app-solve.mjs failed on {link_path}:\n{result.stderr}")
    m = JSON_LINE.search(result.stdout)
    if not m:
        raise RuntimeError(f"app-solve.mjs printed no JSON line:\n{result.stdout}")
    data = json.loads(m.group(1))
    if data["median"] is None:
        raise RuntimeError(f"app-solve.mjs got no timed reps for {link_path}")
    if data["version"] is None:
        raise RuntimeError(
            f"app-solve.mjs could not read the app version for {link_path}"
        )
    return data


def build_row(date, version, board, baseline_ms, candidate_ms=None):
    """The paste-ready row and its verdict. candidate_ms=None means
    byte-equal code: baseline-only row, verdict BASELINE. PASS means
    candidate_ms <= 0.9 x baseline_ms."""
    if candidate_ms is None:
        row = f"| {date} | {version} | {board} | {baseline_ms}ms | — | — | BASELINE |"
        return row, "BASELINE"
    ratio = candidate_ms / baseline_ms
    verdict = "PASS" if ratio <= 0.9 else "FAIL"
    row = (
        f"| {date} | {version} | {board} | {baseline_ms}ms | {candidate_ms}ms | "
        f"{ratio:.2f} | {verdict} |"
    )
    return row, verdict


def run(example_dir, ring_clues=False, board=None):
    """Time one example end to end and return (row, verdict). Raises
    FileNotFoundError naming the file when the board link or build_link.py
    is missing. Links are stripped to their givens before timing; ring_clues
    keeps the outer ring for edge-clue puzzles (probe_link.py `empty`).
    `board` names a link file (relative to example_dir) other than
    PUZZLE_LINK.txt to time; the printed row's board label then names it."""
    mode = "empty" if ring_clues else "strip"
    baseline_link = example_dir / (board or "PUZZLE_LINK.txt")
    if not baseline_link.exists():
        raise FileNotFoundError(f"missing {baseline_link}")
    build_link_py = example_dir / "build_link.py"
    if not build_link_py.exists():
        raise FileNotFoundError(f"missing {build_link_py}")

    base_doc = decode_puzzle(baseline_link.read_text().strip())
    component_file = find_component_file(example_dir, base_doc)
    board_label = f"{example_dir.name} ({board})" if board else example_dir.name

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)

        candidate_link = tmp / "candidate.txt"
        build_candidate(example_dir, component_file, candidate_link, board=board)
        candidate_doc = decode_puzzle(candidate_link.read_text().strip())
        byte_equal = registered_components(candidate_doc) == registered_components(
            base_doc
        )

        baseline_probe = tmp / "baseline_probe.txt"
        empty_link_file(baseline_link, baseline_probe, mode)
        baseline_result = run_app_solve(baseline_probe, ring_clues)

        date = datetime.date.today().isoformat()
        version = baseline_result["version"]

        if byte_equal:
            return build_row(date, version, board_label, baseline_result["median"])

        candidate_probe = tmp / "candidate_probe.txt"
        empty_link_file(candidate_link, candidate_probe, mode)
        candidate_result = run_app_solve(candidate_probe, ring_clues)
        return build_row(
            date,
            version,
            board_label,
            baseline_result["median"],
            candidate_result["median"],
        )


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("example")
    p.add_argument("--ring-clues", action="store_true")
    p.add_argument(
        "--board", help="link file in the example dir, instead of PUZZLE_LINK.txt"
    )
    a = p.parse_args()
    row, _verdict = run(
        ROOT / "examples" / a.example, ring_clues=a.ring_clues, board=a.board
    )
    print(row)
