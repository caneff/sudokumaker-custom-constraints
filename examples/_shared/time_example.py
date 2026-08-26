# `just time <example>` — the shared real-app timing driver. Builds a
# same-board pair (docs/real-app-timing.md): the committed PUZZLE_LINK.txt is
# the baseline, and the example's build_link.py rebuilds a candidate from the
# working-tree component. Both are emptied to searchable links (probe_link.py)
# and timed with the real browser driver (app-solve.mjs), 3 reps each,
# non-deterministic solve off. Prints one paste-ready row: date, app version,
# board, baseline median, candidate median, ratio, PASS/FAIL. When the
# candidate's constraint code is byte-equal to the baseline's, it times the
# baseline only and prints a baseline row -- re-timing an unchanged component
# would just add noise, not a comparison.
#
# This driver reuses the example's build_link.py (subprocess -- it is a
# separate CLI contract per docs/real-app-timing.md) and the shared
# link_codec / probe_link modules (import). It does not reimplement either.
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

from link_codec import decode_puzzle, encode_link
from probe_link import empty_interior

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


def find_working_tree_component(example_dir, base_doc):
    """The one registered component with a same-named .js file on disk --
    the working-tree source build_link.py's --component contract expects.
    Raises if none or more than one file matches; this driver only follows
    one component's code per example."""
    names = sorted(registered_components(base_doc))
    matches = [n for n in names if (example_dir / f"{n}.js").exists()]
    if not matches:
        raise FileNotFoundError(
            f"no working-tree component file found in {example_dir} for any "
            f"of the registered components ({', '.join(names)})"
        )
    if len(matches) > 1:
        raise ValueError(
            f"{example_dir.name} registers multiple components with a working-tree "
            f"file ({', '.join(matches)}); time_example.py follows only one"
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


def empty_link(src_path, out_path):
    doc = empty_interior(decode_puzzle(src_path.read_text().strip()))
    out_path.write_text(encode_link(doc))


def run_app_solve(link_path):
    """Run the real-app timing driver and return its {median, version} JSON."""
    result = subprocess.run(
        ["node", str(APP_SOLVE), str(link_path), str(REPS)],
        capture_output=True,
        text=True,
        check=True,
    )
    m = JSON_LINE.search(result.stdout)
    if not m:
        raise RuntimeError(f"app-solve.mjs printed no JSON line:\n{result.stdout}")
    return json.loads(m.group(1))


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
    component_file = find_working_tree_component(example_dir, base_doc)

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)

        candidate_link = tmp / "candidate.txt"
        build_candidate(example_dir, component_file, candidate_link)
        candidate_doc = decode_puzzle(candidate_link.read_text().strip())
        byte_equal = registered_components(candidate_doc) == registered_components(
            base_doc
        )

        baseline_probe = tmp / "baseline_probe.txt"
        empty_link(baseline_link, baseline_probe)
        baseline_result = run_app_solve(baseline_probe)

        date = datetime.date.today().isoformat()
        version = baseline_result["version"]

        if byte_equal:
            return build_row(date, version, example_dir.name, baseline_result["median"])

        candidate_probe = tmp / "candidate_probe.txt"
        empty_link(candidate_link, candidate_probe)
        candidate_result = run_app_solve(candidate_probe)
        return build_row(
            date,
            version,
            example_dir.name,
            baseline_result["median"],
            candidate_result["median"],
        )


def main(argv):
    p = argparse.ArgumentParser()
    p.add_argument("example", help="example directory name, e.g. numbered-rooms")
    args = p.parse_args(argv[1:])
    row, _verdict = run(ROOT / "examples" / args.example)
    print(row)


if __name__ == "__main__":
    main(sys.argv)
