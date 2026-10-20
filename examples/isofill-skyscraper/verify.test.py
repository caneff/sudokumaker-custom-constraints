# verify.py's parts, tested apart from the disk wiring check() does:
# house_problems and grid_problems each speak for their own fault. Then
# check() itself, on a link file written here, refuses each fault before it
# spends a proof on it. Every expectation comes from gen.json, so a
# regenerated board changes no line here.
#
# No test hides a shown clue to see the proof fail, as skyscraper's does: one
# removal costs 8-17 s and often ends at the time limit with no verdict. The
# shipped board has no interior given, so verify.py's own unique verdict
# already rests on the clue model alone.

import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

import dataclasses
import tempfile

from build_size import SPEC
from framebuild import RingGlobal, load_board
from sudoku_kit.link_codec import decode_puzzle, encode_link
from verify import ROWCOL_TITLE, check, grid_problems, house_problems


def _shipped():
    link_path, gen_path = RingGlobal(SPEC).files(9)
    doc = decode_puzzle(link_path.read_text().strip())["puzzle"]
    return doc, load_board(gen_path)


def test_house_problems_flags_box_regions_and_row_column_houses():
    doc, _ = _shipped()
    assert house_problems(doc) == []
    boxed = dict(doc, constraints=[{"type": 1, "regions": []}, *doc["constraints"]])
    assert [p for p in house_problems(boxed) if "box regions" in p]
    housed = dict(
        doc, constraints=[*doc["constraints"], {"definition": {"name": ROWCOL_TITLE}}]
    )
    assert [p for p in house_problems(housed) if "rows and columns" in p]


def test_grid_problems_speaks_for_each_of_its_three_checks():
    _, board = _shipped()
    assert grid_problems(board) == []

    # A given that disagrees with the grid; added, since the shipped board
    # may carry no interior given at all.
    bent = {**board.givens, (0, 0): board.grid[0][0] % 9 + 1}
    out = grid_problems(dataclasses.replace(board, givens=bent))
    assert out and all(m.startswith("given") for m in out)

    bent = dict(board.clue)
    key = next(iter(sorted(bent)))
    bent[key] = bent[key] % 9 + 1
    out = grid_problems(dataclasses.replace(board, clue=bent))
    assert out and all(m.startswith("clue") for m in out)

    # Swap two cells of different digits, each away from the other's region:
    # every digit still fills nine cells, so only connectivity can object.
    grid = [list(row) for row in board.grid]
    (r1, c1), (r2, c2) = _far_pair(grid)
    grid[r1][c1], grid[r2][c2] = grid[r2][c2], grid[r1][c1]
    out = grid_problems(dataclasses.replace(board, grid=grid))
    assert "the recorded grid is not an ISOFILL solution" in out


def _check_refuses(board, puzzle, says):
    """check() on `board` and a link file of `puzzle` fails, saying `says`."""
    with tempfile.TemporaryDirectory() as tmp:
        link_file = pathlib.Path(tmp) / "PUZZLE_LINK.txt"
        link_file.write_text(encode_link({"puzzle": puzzle}) + "\n")
        try:
            check(board, link_file)
        except AssertionError as e:
            assert says in str(e), str(e)
        else:
            raise AssertionError(f"check() let through a board that is {says!r}")


def test_check_refuses_each_fault_its_parts_find():
    doc, board = _shipped()
    # house_problems: a box region the ISOFILL model has none of
    boxed = dict(doc, constraints=[{"type": 1, "regions": []}, *doc["constraints"]])
    _check_refuses(board, boxed, "not the recorded board")
    # mismatches: a shown clue the link does not carry
    hidden = sorted(set(board.lines) - board.active)[0]
    shown = dataclasses.replace(board, active=board.active | {hidden})
    _check_refuses(shown, doc, "not the recorded board")
    # grid_problems: a recorded solution the ISOFILL model rejects
    grid = [list(row) for row in board.grid]
    (r1, c1), (r2, c2) = _far_pair(grid)
    grid[r1][c1], grid[r2][c2] = grid[r2][c2], grid[r1][c1]
    _check_refuses(
        dataclasses.replace(board, grid=grid), doc, "does not solve the recorded"
    )


def _far_pair(grid):
    """Two cells of different digits, neither next to any cell of the other's
    digit: swapping them strands each one away from its new region."""
    n = len(grid)

    def touches(r, c, d):
        return any(
            0 <= r + dr < n and 0 <= c + dc < n and grid[r + dr][c + dc] == d
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))
        )

    cells = [(r, c) for r in range(n) for c in range(n)]
    for a in cells:
        for b in cells:
            da, db = grid[a[0]][a[1]], grid[b[0]][b[1]]
            if da != db and not touches(*a, db) and not touches(*b, da):
                return a, b
    raise AssertionError("no pair of cells to strand")


if __name__ == "__main__":
    test_house_problems_flags_box_regions_and_row_column_houses()
    test_grid_problems_speaks_for_each_of_its_three_checks()
    test_check_refuses_each_fault_its_parts_find()
    print("ok")
