# The board value and its gen JSON round trip (board.py): `Geometry`'s square
# and rectangle, and `save_board`/`load_board` on straight and bent lines.
#
#   uv run examples/_shared/board.test.py

import dataclasses
import json
import pathlib
import random
import tempfile

from board import Board, Geometry, load_board, make_lines, save_board
from carve import make_paths
from frame_fixtures import make_board


def test_geometry_is_one_value_for_a_square_or_a_rectangle():
    sq = Geometry.square(4, 2, 2)
    assert (sq.n, sq.height, sq.digits, sq.box) == (4, 4, 4, (2, 2))
    assert sq.shape == {}
    rect = Geometry.rect(5, 3, 4)
    assert (rect.n, rect.height, rect.digits, rect.box) == (5, 3, 4, None)
    assert rect.shape == {"height": 3, "digits": 4}
    try:
        sq.n = 5
    except dataclasses.FrozenInstanceError:
        pass
    else:
        raise AssertionError("a Geometry was mutated")
    # a Board derives its geometry from its flat fields, so gen JSON is unchanged
    flat = {"grid": [], "clue": {}, "givens": {}, "active": set(), "lines": {}}
    assert Board(n=4, bh=2, bw=2, height=4, digits=4, **flat).geo == sq
    # a rectangle's recorded box is a stand-in nothing reads: geo drops it
    assert Board(n=5, bh=1, bw=5, height=3, digits=4, **flat).geo == rect


def test_save_board_and_load_board_round_trip_a_frame_board():
    with tempfile.TemporaryDirectory() as tmp:
        path = pathlib.Path(tmp) / "gen.json"
        board = dataclasses.replace(make_board(), seed=101, givens={(0, 0): 1})
        save_board(board, path)
        back = load_board(path)
        assert back == board
        # the ring keys survive the JSON's flat "T3" spelling, parsed in one
        # place: load_board
        assert ("T", 3) in back.clue and ("L", 0) in back.active
        # a straight-frame board records no geometry -- its lines are the ones
        # n implies
        assert "paths" not in json.loads(path.read_text())


def test_save_board_records_bent_geometry_and_load_board_reads_it_back():
    with tempfile.TemporaryDirectory() as tmp:
        path = pathlib.Path(tmp) / "gen_local.json"
        n = 6
        lines = make_paths(random.Random(3), n)
        board = dataclasses.replace(make_board(n=6, bh=2, bw=3), lines=lines)
        save_board(board, path)
        assert "paths" in json.loads(path.read_text())
        back = load_board(path)
        assert back.lines == lines != make_lines(n)
        assert back == board


if __name__ == "__main__":
    test_geometry_is_one_value_for_a_square_or_a_rectangle()
    test_save_board_and_load_board_round_trip_a_frame_board()
    test_save_board_records_bent_geometry_and_load_board_reads_it_back()
    print("board self-check OK")
