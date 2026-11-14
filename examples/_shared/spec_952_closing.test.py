"""One end-to-end test for spec #952: one parsed link in the layout gate, one
backend registry, one refresh command (slices #959-#964).

Every case runs in a copy of the examples tree, never the checkout, in the
order the spec states its acceptance:

  1. user story 1: a real change to every shared backend file, then every
     example's `build_link.py --refresh`, leaves the layout gate with no
     violation at all -- no stale backend anywhere (it found them before);
  2. the testing decision: on the unchanged tree, every example's
     `build_link.py --refresh` rebuilds every committed link byte for byte;
  3. a planted no-ring gen JSON recording grid-rowcol code is flagged
     (candidate 4: `check_gen_frame_backends` covers every registered
     backend);
  4. a link found only by its `LINK_PREFIX` text, whose name says `_clued`,
     gets no tags and so no exemption (thermo finding 1);
  5. skyscraper's `build_original.py`, and the `--refresh` that drives it,
     refuse a board whose grid moved (candidate 5).

WHAT A GREEN RUN DOES NOT COVER (this seam, `just check-full`, is blind to it):
  - the app: whether a refreshed link opens, renders and solves in
    sudokumaker.app, and its solve time (`just time <example>`), and anything
    a browser probe checks rather than a Node or Python test asserts.
  - isofill's and fillomino's links past PUZZLE_LINK.txt: their --refresh is
    `bareboard`'s rebuild of that one board, and none of their links embeds
    shared code, so case 1 cannot see a refresh that skips them.

    uv run examples/_shared/spec_952_closing.test.py
"""

import json
import pathlib
import shutil
import subprocess
import sys
import tempfile

HERE = pathlib.Path(__file__).resolve().parent
EXAMPLES = HERE.parent
REPO = EXAMPLES.parent
sys.path.insert(0, str(HERE))

import check_layout
from document import SHARED_BACKENDS
from sudoku_kit.link_codec import decode_puzzle

PROBE = "const SPEC_952_PROBE = 1\n"


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


def a_gen_json_recording_grid_rowcol_code_is_flagged():
    with tempfile.TemporaryDirectory() as tmp:
        example = copy_of_tree(tmp) / "up-to-n"
        doc = decode_puzzle((example / "PUZZLE_LINK.txt").read_text().strip())
        (example / "gen_planted.json").write_text(json.dumps(doc))
        violations = check_layout.check_gen_frame_backends(example)
        assert any(
            "gen_planted.json records code for 'Grid Rows and Columns'" in v
            for v in violations
        ), violations


def a_clued_name_found_by_its_text_earns_no_exemption():
    assert check_layout.link_tags("hunt_clued.txt") == frozenset()
    with tempfile.TemporaryDirectory() as tmp:
        # numbered-rooms' clued twin types every outside clue in as an entered
        # value, which only the `clued` tag excuses.
        example = copy_of_tree(tmp) / "numbered-rooms"
        shutil.copy(example / "PUZZLE_LINK_clued.txt", example / "hunt_clued.txt")
        violations = check_layout.check_example(example)
        assert any(
            "hunt_clued.txt" in v and "entered value" in v for v in violations
        ), violations
        assert not any("PUZZLE_LINK_clued.txt" in v for v in violations), violations


def skyscraper_refuses_a_board_whose_grid_moved():
    with tempfile.TemporaryDirectory() as tmp:
        example = copy_of_tree(tmp) / "skyscraper"
        gen = example / "gen.json"
        g = json.loads(gen.read_text())
        r, c = map(int, next(iter(g["givens"])).split(","))
        g["grid"][r][c] = g["grid"][r][c] % 9 + 1
        gen.write_text(json.dumps(g))
        links = sorted(example.glob("PUZZLE_LINK*.txt"))
        before = {p: p.read_bytes() for p in links}
        for argv in (["build_original.py", "9"], ["build_link.py", "--refresh"]):
            done = run(example / argv[0], *argv[1:])
            assert done.returncode != 0, f"{argv} rebuilt a moved board"
            assert "grid, givens, or shown clues changed" in done.stderr, done.stderr
        assert all(p.read_bytes() == before[p] for p in links), "a refusal wrote"


if __name__ == "__main__":
    a_shared_backend_change_is_refreshed_away()
    every_link_rebuilds_byte_for_byte()
    a_gen_json_recording_grid_rowcol_code_is_flagged()
    a_clued_name_found_by_its_text_earns_no_exemption()
    skyscraper_refuses_a_board_whose_grid_moved()
    print("ok")
