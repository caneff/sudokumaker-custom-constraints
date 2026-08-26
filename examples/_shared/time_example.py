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


def find_component_file(example_dir, base_doc):
    """The one registered component with a same-named .js file on disk --
    the working-tree source build_link.py's --component contract expects.
    Raises if none or more than one file matches: a silent pick among
    several would time the wrong edit (CODING_STANDARDS: fail loud)."""
    names = sorted(registered_components(base_doc))
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


def build_candidate(example_dir, component_file, out_path):
    subprocess.run(
        [
            "uv",
            "run",
            "--with",
            "lzstring",
            str(example_dir / "build_link.py"),
            "--component",
            str(component_file),
            "--out",
            str(out_path),
        ],
        check=True,
        capture_output=True,
        text=True,
    )


def run_app_solve(link_path):
    """Run the real-app timing driver and return its {median, version}."""
    result = subprocess.run(
        ["node", str(APP_SOLVE), str(link_path), str(REPS)],
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


def run(example_dir):
    """Time one example end to end and return (row, verdict). Raises
    FileNotFoundError naming the file when PUZZLE_LINK.txt or build_link.py
    is missing."""
    baseline_link = example_dir / "PUZZLE_LINK.txt"
    if not baseline_link.exists():
        raise FileNotFoundError(f"missing {baseline_link}")
    build_link_py = example_dir / "build_link.py"
    if not build_link_py.exists():
        raise FileNotFoundError(f"missing {build_link_py}")

    base_doc = decode_puzzle(baseline_link.read_text().strip())
    component_file = find_component_file(example_dir, base_doc)

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)

        candidate_link = tmp / "candidate.txt"
        build_candidate(example_dir, component_file, candidate_link)
        candidate_doc = decode_puzzle(candidate_link.read_text().strip())
        byte_equal = registered_components(candidate_doc) == registered_components(
            base_doc
        )

        baseline_probe = tmp / "baseline_probe.txt"
        empty_link_file(baseline_link, baseline_probe)
        baseline_result = run_app_solve(baseline_probe)

        date = datetime.date.today().isoformat()
        version = baseline_result["version"]

        if byte_equal:
            return build_row(date, version, example_dir.name, baseline_result["median"])

        candidate_probe = tmp / "candidate_probe.txt"
        empty_link_file(candidate_link, candidate_probe)
        candidate_result = run_app_solve(candidate_probe)
        return build_row(
            date,
            version,
            example_dir.name,
            baseline_result["median"],
            candidate_result["median"],
        )


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("usage: time_example.py <example>")
    row, _verdict = run(ROOT / "examples" / sys.argv[1])
    print(row)
