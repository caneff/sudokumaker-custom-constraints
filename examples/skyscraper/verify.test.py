# verify.py's parts, tested apart from the disk wiring check() does: link_board
# reads the shipped link, mismatches / box_problems / grid_problems compare it
# to the recorded board, and framebuild.unique is the proof itself. Every
# expectation comes from gen.json, so a regenerated board changes no line here.
#
#   uv run --with lzstring --with ortools examples/skyscraper/verify.test.py

import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_size import SPEC
from framebuild import load_gen, unique
from link_codec import decode_puzzle
from verify import (
    boards,
    box_problems,
    grid_problems,
    interior_index,
    link_board,
    mismatches,
)


def _shipped():
    """The shipped 9x9 as both halves see it: the decoded link, and the
    recorded board load_gen reads out of gen.json."""
    doc = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())["puzzle"]
    return doc, load_gen(HERE, 9, tag="")


def test_link_board_reads_the_link_not_the_recorded_board():
    doc, (_, _, _, clue, givens, active, _) = _shipped()
    link_givens, link_shown = link_board(doc)
    assert link_givens == givens
    assert link_shown == {k: clue[k] for k in active}

    # A sentinel the recorded board could never hold: link_board must read the
    # link's own cells, so a check built on it cannot pass by reading gen.json
    # twice and comparing it to itself.
    doc["cells"][interior_index(doc["width"], 0, 0)] = {"given": True, "value": 99}
    assert link_board(doc)[0][(0, 0)] == 99, "link_board must report the link's cells"


def test_mismatches_flags_a_changed_given_and_a_changed_clue():
    doc, (_, _, _, clue, givens, active, _) = _shipped()
    shown = {k: clue[k] for k in active}
    assert mismatches(doc, givens, shown) == []

    # One witness per half: the givens comparison and the clue comparison each
    # have to be the thing that speaks.
    bent = dict(givens)
    key = next(iter(sorted(bent)))
    bent[key] = bent[key] % 9 + 1
    assert [m for m in mismatches(doc, bent, shown) if m.startswith("interior given")]

    key = next(iter(sorted(shown)))
    shown[key] = shown[key] % 9 + 1
    assert [m for m in mismatches(doc, givens, shown) if m.startswith("shown clue")]


def test_box_problems_flags_boxes_the_link_does_not_draw():
    doc, (bh, bw, *_) = _shipped()
    assert box_problems(doc, 9, bh, bw) == []
    # The shipped link draws 3x3 boxes; a board recorded with any other shape
    # is a different puzzle wearing the same givens.
    assert box_problems(doc, 9, 1, 9)


def test_grid_problems_speaks_for_each_of_its_three_checks():
    _, (bh, bw, grid, clue, givens, _, lines) = _shipped()
    assert grid_problems(grid, clue, givens, lines, 9, bh, bw) == []

    # A given the grid contradicts: only the givens check can see it.
    bent = dict(givens)
    key = next(iter(sorted(bent)))
    bent[key] = bent[key] % 9 + 1
    out = grid_problems(grid, clue, bent, lines, 9, bh, bw)
    assert out and all(m.startswith("given") for m in out)

    # A clue the grid does not read: only the clue check can see it.
    bent = dict(clue)
    key = next(iter(sorted(bent)))
    bent[key] = bent[key] % 9 + 1
    out = grid_problems(grid, bent, givens, lines, 9, bh, bw)
    assert out and all(m.startswith("clue") for m in out)

    # A repeat in a house. Uniqueness cannot catch this on its own: bend the
    # recorded solution and CP-SAT still proves the board has exactly one --
    # the one gen no longer records.
    grid[0][0] = grid[0][0] % 9 + 1
    out = grid_problems(grid, clue, givens, lines, 9, bh, bw)
    assert [m for m in out if m.startswith("house")]


def test_the_givens_and_the_shown_clues_are_both_load_bearing():
    # The proof has teeth only if what the board ships is what pins it. Pull a
    # given, or hide every clue, and the same call must come back False -- the
    # clue half is what witnesses the skyscraper model itself, since a no-op
    # clue model would leave the board unique on its givens alone. `is False`,
    # not `not`: unique() answers None when a solve times out, and a timeout
    # witnesses nothing.
    _, (bh, bw, _, clue, givens, active, lines) = _shipped()
    assert unique(SPEC.cp_sat_clue_fn, lines, clue, active, givens, 9, bh, bw) is True
    assert unique(SPEC.cp_sat_clue_fn, lines, clue, set(), givens, 9, bh, bw) is False
    if givens:
        fewer = dict(givens)
        fewer.pop(next(iter(sorted(fewer))))
        assert (
            unique(SPEC.cp_sat_clue_fn, lines, clue, active, fewer, 9, bh, bw) is False
        )


def test_boards_finds_every_global_board_and_no_local_one():
    found = boards()
    sizes = [n for n, _, _ in found]
    assert sizes == sorted(sizes) and len(set(sizes)) == len(sizes)
    for _n, tag, link_file in found:
        assert link_file.exists(), f"{link_file.name} is missing"
        assert "local" not in tag, "a drawn-path board is not verify.py's to read"
    # Discovery, not a list: every committed global gen file is in there.
    gens = {p.stem for p in HERE.glob("gen*.json") if not p.stem.endswith("_local")}
    assert {f"gen_{tag}" if tag else "gen" for _, tag, _ in found} == gens


if __name__ == "__main__":
    test_link_board_reads_the_link_not_the_recorded_board()
    test_mismatches_flags_a_changed_given_and_a_changed_clue()
    test_box_problems_flags_boxes_the_link_does_not_draw()
    test_grid_problems_speaks_for_each_of_its_three_checks()
    test_the_givens_and_the_shown_clues_are_both_load_bearing()
    test_boards_finds_every_global_board_and_no_local_one()
    print("ok")
