# `just time <example>` -- the shared real-app timing driver. Builds a
# same-board pair (docs/real-app-timing.md): the committed PUZZLE_LINK.txt is
# the baseline, and the candidate is that link with the working-tree component
# and backend swapped in, in-process (link_swap.swap_build). Both become
# searchable links (searchable_link.py) and are timed through app_timing
# (app-solve.mjs), 3 reps each, non-deterministic solve off. Prints one
# paste-ready row per mode -- cold, then after the app's own logical pass --
# with date, app version, board, baseline median, candidate median, ratio and
# that row's PASS/FAIL at 0.9x, then a SHIP line applying the two-row rule
# across both. When the candidate's constraint code is byte-equal to the
# baseline's, times the baseline only and prints baseline rows.
#
#   uv run examples/_shared/time_example.py <example>
#
# Stays out of `just check`: it drives the recorded app, a HAR replay that
# `SM_LIVE=1` re-records (docs/real-app-timing.md).

import argparse
import atexit
import datetime
import functools
import io
import pathlib
import shutil
import subprocess
import sys
import tarfile
import tempfile

HERE = pathlib.Path(__file__).parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))

import app_timing
from document import SHARED_BACKENDS
from link_swap import swap_build
from manifest import load_manifest
from minify import minify_file
from searchable_link import empty_link_file
from sm_document import find_constraint, registering_constraint_name
from sudoku_kit.link_codec import decode_puzzle


def board_link(example_dir, board=None):
    """The link file a run times: `board` (a file name in example_dir), or the
    example's shipped PUZZLE_LINK.txt when None. The one place that default
    is written, for `just time` and count_calls.py alike."""
    return example_dir / (board or "PUZZLE_LINK.txt")


def shipped_component_code(doc):
    """name -> code for every component registered on any constraint."""
    result = {}
    for c in doc["puzzle"]["constraints"]:
        for comp in c.get("definition", {}).get("components", []):
            result[comp["name"]] = comp["code"]
    return result


def find_component_file(example_dir, base_doc, component=None):
    """The working-tree component file the timing loop follows.

    `component` (the --component flag) names the component outright and wins
    over the manifest: an example that registers different components on
    different boards has no single right answer for its example.toml to
    declare, so the caller says which board's component to time.

    Otherwise the manifest's `timed_component` names it. Either way the name
    settles the file: <example_dir>/<Name>.js, or the `_shared/` copy, or a
    loud failure naming the problem (missing file, or a name not registered on
    the base doc) -- a silent pick would time the wrong edit (CODING_STANDARDS:
    fail loud)."""
    names = sorted(shipped_component_code(base_doc))

    if component is not None:
        declared, source = component, "--component"
    else:
        declared, source = load_manifest(example_dir).timed_component, "timed_component"
    if declared not in names:
        raise ValueError(
            f"{example_dir.name}'s {source} ({declared!r}) is not "
            f"a registered component ({', '.join(names)})"
        )
    component_file = example_dir / f"{declared}.js"
    if component_file.exists():
        return component_file
    # A component whose canonical file lives in `_shared/` (house-gac:
    # HouseGacComponent.js, shared with the frame boards) has no
    # working-tree copy of its own to drift from its committed one --
    # follow that copy instead of demanding a duplicate.
    shared_file = example_dir.parent / "_shared" / f"{declared}.js"
    if shared_file.exists():
        return shared_file
    raise FileNotFoundError(
        f"{example_dir.name}'s {source} ({declared!r}) has no "
        f"working-tree file at {component_file} or {shared_file}"
    )


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

# A backend declared in `_shared/` rather than per-example, read off the
# registry (document.SHARED_BACKENDS): house-gac.js backs the shared
# HouseGacComponent, for one. A
# board that opts in has no per-example copy of its own to drift from the
# committed one -- resolve_backend_file follows the shared file the same way
# find_component_file already follows the shared component file, above.
SHARED_BACKEND_FILES = tuple(f"{b.stem}.js" for b in SHARED_BACKENDS)


@functools.cache
def _toplevel(start_dir):
    """The git toplevel containing start_dir."""
    return pathlib.Path(
        subprocess.run(
            ["git", "-C", start_dir, "rev-parse", "--show-toplevel"],
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()
    ).resolve()


@functools.cache
def _head_tree(toplevel):
    """A temp checkout of the whole repo at git HEAD, deleted when the process
    ends. A whole tree, not one file's text: a paste target's `// #include`
    resolves against a real directory, so HEAD's copy of an included file has
    to sit at HEAD's copy of its path."""
    tmp = pathlib.Path(tempfile.mkdtemp(prefix="head-tree-"))
    atexit.register(shutil.rmtree, tmp, ignore_errors=True)
    archive = subprocess.run(
        ["git", "-C", toplevel, "archive", "HEAD"], stdout=subprocess.PIPE, check=True
    ).stdout
    with tarfile.open(fileobj=io.BytesIO(archive), mode="r:") as tar:
        tar.extractall(tmp, filter="data")
    return tmp


def head_path(path):
    """Where path's HEAD copy sits inside the HEAD checkout -- a path, which
    may not exist, because a file can be in the working tree and not at HEAD.
    The caller decides what an absent one means; resolve_backend_file reads it
    as "this cannot have built a committed link".

    Immune to the working-tree edit it is trying to detect, and immune all the
    way down: minify_file resolves this file's includes inside the same
    checkout, so an edited include cannot leak in either."""
    path = path.resolve()
    toplevel = _toplevel(path.parent)
    return _head_tree(str(toplevel)) / path.relative_to(toplevel)


def resolve_backend_file(example_dir, base_doc, constraint_name):
    """Which of BACKEND_FILES, or SHARED_BACKEND_FILES in the sibling
    `_shared/` directory, the committed PUZZLE_LINK.txt's constraint_name
    backend was built from, as a working-tree path -- the file
    build_candidate_doc must re-minify to time a backend-only change. None
    when the constraint has no code backend, or none of those files exist.
    Raises when a file exists but none of them matches -- a silent guess
    would time the wrong backend variant."""
    committed_backend = registered_backend(base_doc, constraint_name)
    if committed_backend is None:
        return None
    shared_dir = example_dir.parent / "_shared"
    candidates = [
        example_dir / name for name in BACKEND_FILES if (example_dir / name).exists()
    ] + [
        shared_dir / name
        for name in SHARED_BACKEND_FILES
        if (shared_dir / name).exists()
    ]
    if not candidates:
        return None
    # A candidate that exists only in the working tree cannot have built a
    # committed link, so it is not a match -- but it is worth naming when
    # nothing matches, because "I added this file" is the likely reason.
    at_head = [(f, head_path(f)) for f in candidates]
    uncommitted = [f for f, h in at_head if not h.is_file()]
    matches = [
        f for f, h in at_head if h.is_file() and minify_file(h) == committed_backend
    ]
    if not matches:
        # The usual cause is not a missing backend file at all: it is a
        # PUZZLE_LINK.txt that has been rebuilt against edited code and not
        # committed. Its backend is then the new one while every candidate here
        # is read at HEAD, so nothing matches -- and there is no baseline left
        # to time against, because the link that was the baseline is gone. Say
        # that first; a builder who has just regenerated a link would otherwise
        # go looking at the wrong files.
        note = (
            f"; the likeliest cause is an uncommitted {example_dir.name}"
            f"/PUZZLE_LINK*.txt rebuilt against edited code -- the baseline it "
            f"used to be no longer exists in this tree"
        )
        if uncommitted:
            note += (
                f", or that {', '.join(f.name for f in uncommitted)} is in the "
                f"working tree but not at HEAD"
            )
        raise ValueError(
            f"{example_dir.name}: no backend file "
            f"({', '.join(BACKEND_FILES + SHARED_BACKEND_FILES)}) matches the "
            f"committed {constraint_name!r} backend{note}"
        )
    if len(matches) > 1:
        raise ValueError(
            f"{example_dir.name}: more than one backend file matches the "
            f"committed {constraint_name!r} backend "
            f"({', '.join(f.name for f in matches)})"
        )
    return matches[0]


def build_candidate_doc(example_dir, component_file, out_path, base_doc, board=None):
    """Build the candidate link at out_path and return byte_equal: True only
    when neither the timed component nor the constraint's backend differs from
    base_doc.

    The swap runs in-process through link_swap.swap_build -- the same call
    every build_link.py's --component path ends in -- with the working-tree
    backend (resolve_backend_file's file) overlaid, so both the decision and the
    timed candidate at out_path cover the backend, not just components. A
    --component swap alone leaves the backend whatever PUZZLE_LINK.txt already
    shipped, even when its working-tree file has changed. `board` (None = the
    example's PUZZLE_LINK.txt) is the committed link swapped into."""
    constraint_name = registering_constraint_name(base_doc, component_file.stem)
    backend_file = resolve_backend_file(example_dir, base_doc, constraint_name)
    swap_build(
        board_link(example_dir, board),
        component_file,
        out_path,
        backend=backend_file,
    )
    candidate_doc = decode_puzzle(out_path.read_text().strip())
    return shipped_component_code(candidate_doc) == shipped_component_code(
        base_doc
    ) and registered_backend(candidate_doc, constraint_name) == registered_backend(
        base_doc, constraint_name
    )


def check_backend_current(board, base_doc):
    """Raises ValueError unless the board's code backend is the minified
    `main.js` beside it, the file a houses-only example's links are built from:
    a `main.js` edited since the link was built would be timed as the old
    code. The fix is the example's `build_link.py`."""
    main_js = board.parent / "main.js"
    backends = [
        c["definition"]["backend"]["code"]
        for c in base_doc["puzzle"]["constraints"]
        if c.get("definition", {}).get("backend", {}).get("code")
    ]
    if main_js.is_file() and minify_file(main_js) not in backends:
        raise ValueError(
            f"{main_js} differs from the backend in {board.name}; rebuild the "
            "link with the example's build_link.py before timing it"
        )


def run(example_dir, ring_clues=False, board=None, component=None):
    """Time one example end to end in both modes and return
    ([(row, verdict), ...], ship) -- one entry per row (cold, then
    after-logical) and the two-row rule's verdict, or None when the code is
    byte-equal and there is nothing to judge. Raises
    FileNotFoundError naming the board link when it is missing. Links become
    searchable links before timing; ring_clues
    keeps the outer ring for edge-clue puzzles (searchable_link.py `empty`).
    `board` names a link file (relative to example_dir) other than
    PUZZLE_LINK.txt to time; the printed row's board label then names it.
    `component` names the registered component to follow, over the manifest's
    timed_component -- which board registers which component is the caller's
    to say. A houses_only example has no component: `component` is refused, and
    the rows are the baseline's alone (check_backend_current)."""
    mode = "empty" if ring_clues else "strip"
    baseline_link = board_link(example_dir, board)
    if not baseline_link.exists():
        raise FileNotFoundError(f"missing {baseline_link}")

    # The working-tree link, which is also what build_candidate_doc swaps the
    # candidate into and what empty_link_file turns into the baseline's
    # searchable link -- every link this function times comes from one tree.
    # Reading it from HEAD instead would leave the two TIMED searchable links
    # here in the working tree while only the decisions moved, and a
    # regenerated link would then be timed against itself: two searchable
    # links carrying the same new code, a ratio near 1, and a paste-ready
    # verdict for a change nobody measured.
    #
    # The backend file is still identified at HEAD (resolve_backend_file), so
    # an edit to a paste target or to something it includes cannot hide the
    # file it is an edit to. When the link has itself been regenerated, those
    # two disagree and the run refuses: the baseline that link used to be no
    # longer exists in this tree, so there is nothing to time against.
    base_doc = decode_puzzle(baseline_link.read_text().strip())
    # A houses-only example registers no component of its own, so there is no
    # working-tree edit to swap in: its rows are the baseline alone, of the
    # link as it stands. A backend edited since the link was built would be
    # timed as the old code, so that is refused.
    houses_only = load_manifest(example_dir).houses_only
    if houses_only:
        if component is not None:
            raise ValueError(
                f"{example_dir.name} is houses_only and registers no component; "
                "--component has nothing to name"
            )
        check_backend_current(baseline_link, base_doc)
        component_file = None
    else:
        component_file = find_component_file(example_dir, base_doc, component=component)
    board_label = f"{example_dir.name} ({board})" if board else example_dir.name

    with tempfile.TemporaryDirectory() as tmp:
        tmp = pathlib.Path(tmp)

        candidate_link = tmp / "candidate.txt"
        # Baseline rows only: byte-equal code, or nothing to swap in.
        baseline_only = houses_only or build_candidate_doc(
            example_dir, component_file, candidate_link, base_doc, board=board
        )

        baseline_searchable = tmp / "baseline_searchable.txt"
        empty_link_file(baseline_link, baseline_searchable, mode)
        candidate_searchable = tmp / "candidate_searchable.txt"
        if not baseline_only:
            empty_link_file(candidate_link, candidate_searchable, mode)

        date = datetime.date.today().isoformat()
        # Every fixture gets both rows (docs/real-app-timing.md): cold, from an
        # empty board, then from the state a player reaches after the app's
        # own logical pass.
        timed = app_timing.time_modes(
            baseline_searchable,
            None if baseline_only else candidate_searchable,
            ring_clues,
            date,
            lambda after_logical: (
                board_label + (" after-logical" if after_logical else "")
            ),
            app_timing.build_row,
        )
        rows = [(row, verdict) for row, verdict, _ratio in timed]
        ratios = [ratio for _row, _verdict, ratio in timed if not baseline_only]

        return rows, (app_timing.ship_verdict(ratios) if ratios else None)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("example")
    p.add_argument("--ring-clues", action="store_true")
    p.add_argument(
        "--board", help="link file in the example dir, instead of PUZZLE_LINK.txt"
    )
    p.add_argument(
        "--component",
        help="registered component to time, instead of example.toml's timed_component",
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
