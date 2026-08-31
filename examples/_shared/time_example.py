# `just time <example>` -- the shared real-app timing driver. Builds a
# same-board pair (docs/real-app-timing.md): the committed PUZZLE_LINK.txt is
# the baseline, and the example's build_link.py rebuilds a candidate from the
# working-tree component. Both are emptied (probe_link.py) and timed
# (app-solve.mjs), 3 reps each, non-deterministic solve off. Prints one
# paste-ready row per mode -- cold, then after the app's own logical pass --
# with date, app version, board, baseline median, candidate median, ratio and
# that row's PASS/FAIL at 0.9x, then a SHIP line applying the two-row rule
# across both. When the candidate's constraint code is byte-equal to the
# baseline's, times the baseline only and prints baseline rows.
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
from link_swap import find_constraint, replace_constraint_code
from minify import minify_js
from probe_link import empty_link_file

APP_SOLVE = HERE / "app-solve.mjs"
JSON_LINE = re.compile(r"^JSON: (.+)$", re.MULTILINE)
REPS = 3

# Every fixture gets both rows (docs/real-app-timing.md): cold, from an empty
# board, then from the state a player reaches after the app's own logical pass.
AFTER_LOGICAL_MODES = (False, True)


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


def find_component_file(example_dir, base_doc, component=None):
    """The working-tree component file the timing loop follows.

    `component` (the --component flag) names the component outright and wins
    over everything else: an example that registers different components on
    different boards has no single right answer for its build_link.py to
    declare, so the caller says which board's component to time.

    Otherwise, if build_link.py declares TIMED_COMPONENT = "<Name>", that name
    settles it: <example_dir>/<Name>.js, or a loud failure naming the problem
    (missing file, or a name not registered on the base doc).

    Otherwise, the one registered component with a same-named .js file on
    disk. Raises if none or more than one file matches: a silent pick among
    several would time the wrong edit (CODING_STANDARDS: fail loud)."""
    names = sorted(registered_components(base_doc))

    declared = component if component is not None else read_timed_component(example_dir)
    if declared is not None:
        source = "--component" if component is not None else "TIMED_COMPONENT"
        if declared not in names:
            raise ValueError(
                f"{example_dir.name}'s {source} ({declared!r}) is not "
                f"a registered component ({', '.join(names)})"
            )
        component_file = example_dir / f"{declared}.js"
        if not component_file.exists():
            raise FileNotFoundError(
                f"{example_dir.name}'s {source} ({declared!r}) has no "
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


def find_component_constraint(doc, component_name):
    """The name of the constraint that registers component_name."""
    for c in doc["puzzle"]["constraints"]:
        names = [comp["name"] for comp in c.get("definition", {}).get("components", [])]
        if component_name in names:
            return c["definition"]["name"]
    raise ValueError(f"no constraint registers a component named {component_name!r}")


def registered_backend(doc, constraint_name):
    """The named constraint's backend code, or None if it has none."""
    return (
        find_constraint(doc, constraint_name)["definition"]
        .get("backend", {})
        .get("code")
    )


# The two paste-target files an example's constraint can ship as its backend
# (docs/example-layout.md): main.js for the local (drawn-groups) link,
# main-global.js for the global (whole-grid) one. Which one a given board
# ships is a per-example choice with no fixed rule -- isofill and
# numbered-rooms default to main.js, skyscraper/hit-counts/running-start to
# main-global.js -- so it is detected, never assumed.
BACKEND_FILES = ("main.js", "main-global.js")


def head_content(path):
    """path's last-committed (git HEAD) content, ignoring any working-tree
    edit -- resolve_backend_file's ground truth for "which file built the
    committed link", immune to the very edit it is trying to detect."""
    result = subprocess.run(
        ["git", "show", f"HEAD:./{path.name}"],
        cwd=path.parent,
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout


def resolve_backend_file(example_dir, base_doc, constraint_name):
    """Which of BACKEND_FILES the committed PUZZLE_LINK.txt's constraint_name
    backend was built from, as a working-tree path -- the file
    build_candidate_doc must re-minify to time a backend-only change. None
    when the constraint has no code backend, or example_dir has neither
    file. Raises when a file exists but none of them matches -- a silent
    guess would time the wrong backend variant."""
    committed_backend = registered_backend(base_doc, constraint_name)
    if committed_backend is None:
        return None
    candidates = [
        example_dir / name for name in BACKEND_FILES if (example_dir / name).exists()
    ]
    if not candidates:
        return None
    matches = [f for f in candidates if minify_js(head_content(f)) == committed_backend]
    if not matches:
        raise ValueError(
            f"{example_dir.name}: no backend file "
            f"({', '.join(BACKEND_FILES)}) matches the committed "
            f"{constraint_name!r} backend"
        )
    if len(matches) > 1:
        raise ValueError(
            f"{example_dir.name}: more than one backend file matches the "
            f"committed {constraint_name!r} backend "
            f"({', '.join(f.name for f in matches)})"
        )
    return matches[0]


def build_candidate_doc(example_dir, component_file, out_path, base_doc, board=None):
    """Build the candidate link (build_candidate), overlay the working-tree
    backend if it differs, and return byte_equal: True only when neither the
    timed component nor the constraint's backend differs from base_doc.

    A build_link.py's --component swap touches only the named component's
    code -- the backend stays whatever PUZZLE_LINK.txt already shipped, even
    when the working-tree backend file has changed. This overlays
    resolve_backend_file's minified working-tree content onto the candidate
    (link_swap.replace_constraint_code) before the byte-equal decision, so
    both the decision and the timed candidate at out_path cover the backend,
    not just components."""
    build_candidate(example_dir, component_file, out_path, board=board)
    candidate_doc = decode_puzzle(out_path.read_text().strip())

    constraint_name = find_component_constraint(base_doc, component_file.stem)
    backend_file = resolve_backend_file(example_dir, base_doc, constraint_name)
    if backend_file is not None:
        backend_code = minify_js(backend_file.read_text())
        candidate_doc = replace_constraint_code(
            candidate_doc, constraint_name, backend_code=backend_code
        )
        out_path.write_text(encode_link(candidate_doc) + "\n")

    return registered_components(candidate_doc) == registered_components(
        base_doc
    ) and registered_backend(candidate_doc, constraint_name) == registered_backend(
        base_doc, constraint_name
    )


def build_candidate(example_dir, component_file, out_path, board=None):
    """Build the candidate link via the example's build_link.py. `board`
    (None = the example's PUZZLE_LINK.txt) is passed as --board, which not
    every example's build_link.py takes; one that does not fails loud here
    rather than inside build_link.py's argument parser."""
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


def run_app_solve(link_path, ring_clues=False, after_logical=False):
    """Run the real-app timing driver and return its {median, version}.
    after_logical runs the app's logical solver to its fixpoint first."""
    cmd = ["node", str(APP_SOLVE), str(link_path), str(REPS)]
    if ring_clues:
        cmd.append("--ring-clues")
    if after_logical:
        cmd.append("--after-logical")
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
    candidate_ms <= 0.9 x baseline_ms on this row alone; the two-row ship
    rule is ship_verdict's job. A 0ms baseline has no ratio: NO TIME when the
    candidate is 0ms too, FAIL when it is not."""
    if candidate_ms is None:
        row = f"| {date} | {version} | {board} | {baseline_ms}ms | — | — | BASELINE |"
        return row, "BASELINE"
    ratio = row_ratio(baseline_ms, candidate_ms)
    if ratio is None:
        row = f"| {date} | {version} | {board} | 0ms | 0ms | — | NO TIME |"
        return row, "NO TIME"
    if ratio == INF:
        row = f"| {date} | {version} | {board} | 0ms | {candidate_ms}ms | ∞ | FAIL |"
        return row, "FAIL"
    verdict = "PASS" if ratio <= 0.9 else "FAIL"
    row = (
        f"| {date} | {version} | {board} | {baseline_ms}ms | {candidate_ms}ms | "
        f"{ratio:.2f} | {verdict} |"
    )
    return row, verdict


INF = float("inf")


def row_ratio(baseline_ms, candidate_ms):
    """One row's candidate/baseline ratio. A 0ms baseline has no ratio: None
    when the candidate is 0ms too (nothing was timed on this row), INF when it
    is not -- the app used to finish this board without searching and now does
    not, which is the regression the row exists to catch, not a free pass."""
    if baseline_ms:
        return candidate_ms / baseline_ms
    return None if candidate_ms == 0 else INF


def ship_verdict(ratios):
    """The two-row rule (docs/real-app-timing.md): a change ships when it
    clears 0.9x on one of the two rows and stays within 1.1x on the other.
    A None ratio (see row_ratio) places no constraint, so the other row
    decides; INF is past 1.1x and sinks the change. All None means nothing
    was timed."""
    real = [r for r in ratios if r is not None]
    if not real:
        return "NO TIME"
    return "SHIP" if min(real) <= 0.9 and max(real) <= 1.1 else "NO SHIP"


def run(example_dir, ring_clues=False, board=None, component=None):
    """Time one example end to end in both modes and return
    ([(row, verdict), ...], ship) -- one entry per row (cold, then
    after-logical) and the two-row rule's verdict, or None when the code is
    byte-equal and there is nothing to judge. Raises
    FileNotFoundError naming the file when the board link or build_link.py
    is missing. Links are stripped to their givens before timing; ring_clues
    keeps the outer ring for edge-clue puzzles (probe_link.py `empty`).
    `board` names a link file (relative to example_dir) other than
    PUZZLE_LINK.txt to time; the printed row's board label then names it.
    `component` names the registered component to follow, over build_link.py's
    TIMED_COMPONENT -- which board registers which component is the caller's
    to say."""
    mode = "empty" if ring_clues else "strip"
    baseline_link = example_dir / (board or "PUZZLE_LINK.txt")
    if not baseline_link.exists():
        raise FileNotFoundError(f"missing {baseline_link}")
    build_link_py = example_dir / "build_link.py"
    if not build_link_py.exists():
        raise FileNotFoundError(f"missing {build_link_py}")

    base_doc = decode_puzzle(baseline_link.read_text().strip())
    component_file = find_component_file(example_dir, base_doc, component=component)
    board_label = f"{example_dir.name} ({board})" if board else example_dir.name

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)

        candidate_link = tmp / "candidate.txt"
        byte_equal = build_candidate_doc(
            example_dir, component_file, candidate_link, base_doc, board=board
        )

        baseline_probe = tmp / "baseline_probe.txt"
        empty_link_file(baseline_link, baseline_probe, mode)
        candidate_probe = tmp / "candidate_probe.txt"
        if not byte_equal:
            empty_link_file(candidate_link, candidate_probe, mode)

        date = datetime.date.today().isoformat()
        rows = []
        ratios = []
        for after_logical in AFTER_LOGICAL_MODES:
            label = board_label + (" after-logical" if after_logical else "")
            base = run_app_solve(baseline_probe, ring_clues, after_logical)
            if byte_equal:
                rows.append(build_row(date, base["version"], label, base["median"]))
                continue
            cand = run_app_solve(candidate_probe, ring_clues, after_logical)
            rows.append(
                build_row(date, base["version"], label, base["median"], cand["median"])
            )
            ratios.append(row_ratio(base["median"], cand["median"]))

        return rows, (ship_verdict(ratios) if ratios else None)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("example")
    p.add_argument("--ring-clues", action="store_true")
    p.add_argument(
        "--board", help="link file in the example dir, instead of PUZZLE_LINK.txt"
    )
    p.add_argument(
        "--component",
        help="registered component to time, instead of build_link.py's TIMED_COMPONENT",
    )
    a = p.parse_args()
    rows, ship = run(
        ROOT / "examples" / a.example,
        ring_clues=a.ring_clues,
        board=a.board,
        component=a.component,
    )
    for row, _verdict in rows:
        print(row)
    if ship:
        print(f"two-row rule: {ship}")
