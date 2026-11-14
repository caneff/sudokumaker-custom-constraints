"""One end-to-end test for spec #896: the gate, the layout check and the link
documents after the 2026-11-06 audit sweep (slices #903-#911).

Driven here on the real tree, in the order the spec states its decisions:

  1. the testing decision: every committed board's link rebuilds byte for
     byte from its gen JSON (size_builders.test.py's sweep, run as is), so
     the refactors below moved no shipped byte;
  2. sm_document owns the puzzle-doc skeleton (ARCH-4): the format version is
     written in one place, and no builder spells it out;
  3. framebuild.py is split by job (THERMO-1): it is gone, nothing imports
     it, and board, carve, document and lanes import on their own;
  4. board geometry is one type (THERMO-2): `Geometry` names a square's box
     and no rectangle's, and no `shape or {}` default is left in the shared
     builders;
  5. the research-load scan is its own script (THERMO-3): it passes on the
     tree, and check_layout no longer carries it;
  6. each link is classified once (ARCH-8): every committed link decodes to
     a `LinkFacts` with a `LinkKind`, and the layout gate passes on the tree;
  7. the ring verifiers share one stale-grid check (DUP-3).

WHAT A GREEN RUN DOES NOT COVER (this seam, `just check-full`, is blind to it):
  - the app: whether a rebuilt link opens, renders and solves in
    sudokumaker.app, and solve time (`just time`). Every link is byte-identical
    to the one already shipped, so nothing new reaches the app.
  - the comment and test-tightening slices (#909's docstrings, #910, #911):
    a comment's truth is read by a reviewer, and each tightened test's own
    mutation is recorded on its slice's PR.

    uv run examples/_shared/spec_896_closing.test.py
"""

import dataclasses
import importlib
import pathlib
import re
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
EXAMPLES = HERE.parent
sys.path.insert(0, str(HERE))

import check_layout
import check_research_loads
import sm_document
from board import Geometry, load_board
from link_checks import LinkFacts, LinkKind
from sudoku_kit.link_codec import decode_puzzle

# The shared builders and every example's builder code: tests are left out,
# since a test may spell the literal it checks for.
BUILDER_CODE = sorted(
    p
    for p in EXAMPLES.rglob("*.py")
    if ".test." not in p.name and not any(s.startswith(".") for s in p.parts)
)


def committed_links_rebuild_byte_for_byte():
    run = subprocess.run(
        [sys.executable, str(HERE / "size_builders.test.py")],
        capture_output=True,
        text=True,
        timeout=600,
    )
    assert run.returncode == 0, run.stdout + run.stderr


def the_format_version_is_written_once():
    assert sm_document.FORMAT_VERSION == "1.6.0", sm_document.FORMAT_VERSION
    doc = sm_document.puzzle_doc({"name": "x"})
    assert doc == {"formatVersion": sm_document.FORMAT_VERSION, "puzzle": {"name": "x"}}
    spelled = [
        p.relative_to(EXAMPLES).as_posix()
        for p in BUILDER_CODE
        if p.name != "sm_document.py" and '"formatVersion": "' in p.read_text()
    ]
    assert not spelled, spelled


def framebuild_is_split_by_job():
    assert not (HERE / "framebuild.py").exists()
    importer = re.compile(r"^\s*(from|import)\s+framebuild\b", re.M)
    importing = [
        p.relative_to(EXAMPLES).as_posix()
        for p in sorted(EXAMPLES.rglob("*.py"))
        if importer.search(p.read_text())
    ]
    assert not importing, importing
    for module in ("board", "carve", "document", "lanes"):
        importlib.import_module(module)


def geometry_is_one_type():
    square, rect = Geometry.square(9, 3, 3), Geometry.rect(5, 4, 4)
    assert square.box == (3, 3) and not square.is_rect, square
    assert rect.box is None and rect.is_rect, rect
    defaulted = [
        p.name
        for p in sorted(HERE.glob("*.py"))
        if ".test." not in p.name and "shape or {}" in p.read_text()
    ]
    assert not defaulted, defaulted


def the_research_scan_is_its_own_script():
    assert check_research_loads.main(["check_research_loads.py"]) == 0
    assert not hasattr(check_layout, "check_research_loads")


def each_link_is_classified_once():
    links = sorted(EXAMPLES.glob("*/PUZZLE_LINK*.txt"))
    assert links, "no committed link found"
    for path in links:
        facts = LinkFacts.of(decode_puzzle(path.read_text().strip())["puzzle"])
        assert isinstance(facts.kind, LinkKind), (path, facts.kind)
    violations = check_layout.check_tree(EXAMPLES)
    assert violations == [], violations


def the_ring_verifiers_share_one_stale_check():
    # Drive each verifier with a board whose recorded clue disagrees with its
    # grid: the stale-grid problem must come out of the verifier itself.
    for verifier in ("skyscraper", "isofill-skyscraper"):
        sys.path.insert(0, str(EXAMPLES / verifier))
        for name in ("build_size", "verify"):
            sys.modules.pop(name, None)
        try:
            verify = importlib.import_module("verify")
        finally:
            sys.path.remove(str(EXAMPLES / verifier))
        board = load_board(EXAMPLES / verifier / "gen.json")
        assert verify.grid_problems(board) == [], verifier
        key = sorted(board.clue)[0]
        bent = dict(board.clue)
        bent[key] = bent[key] % board.n + 1
        out = verify.grid_problems(dataclasses.replace(board, clue=bent))
        assert any(m.startswith(f"clue {key[0]}{key[1]}: gen says") for m in out), (
            verifier,
            out,
        )


if __name__ == "__main__":
    committed_links_rebuild_byte_for_byte()
    the_format_version_is_written_once()
    framebuild_is_split_by_job()
    geometry_is_one_type()
    the_research_scan_is_its_own_script()
    each_link_is_classified_once()
    the_ring_verifiers_share_one_stale_check()
    print("spec #896 closing check: ok")
