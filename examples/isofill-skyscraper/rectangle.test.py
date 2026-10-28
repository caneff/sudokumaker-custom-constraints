# The ring board on a rectangular interior (spec #865, ticket #869): a 4x3 and a
# 3x4 interior with three digits, so each region holds four cells. Built through
# the same path the shipped 9x9 takes -- generate (which proves the carved board
# unique on the repo's ISOFILL model), build_doc, the lane's check, the gen JSON
# round trip, a rebuild against the tree -- then read back by verify.py and by
# the link reader the other ring boards share.
#
#   uv run examples/isofill-skyscraper/rectangle.test.py

import contextlib
import dataclasses
import io
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

import framebuild
from build_size import SPEC, rule_text
from framebuild import RingGlobal, generate, load_board, save_board
from ring_link import mismatches
from sudoku_kit import link_codec
from verify import check

SEEDS = range(101, 104)
SHAPES = [(4, 3), (3, 4)]  # width, height


def _board(width, height):
    return generate(SPEC, width, 1, width, SEEDS, shape={"height": height, "digits": 3})


def test_a_rectangular_board_builds_and_its_link_is_a_rectangle():
    for width, height in SHAPES:
        board = _board(width, height)
        assert (board.n, board.height, board.digits) == (width, height, 3)
        # every line is as long as the dimension it crosses
        for (side, i), cells in board.lines.items():
            assert len(cells) == (width if side in "LR" else height), (side, i)
        assert len(board.lines) == 2 * (width + height)
        lane = RingGlobal(SPEC)
        doc = lane.build_doc(board)
        lane.check(link_codec.encode_link(doc), doc, board)
        puzzle = doc["puzzle"]
        assert (puzzle["width"], puzzle["height"]) == (width + 2, height + 2)
        assert len(puzzle["cells"]) == (width + 2) * (height + 2)
        assert puzzle["maxDigit"] == 3
        assert puzzle["name"].endswith(f"{width}x{height}")
        assert "3 regions, each with 4" in puzzle["comment"]
        # the link reads back as the recorded board, clue for clue
        shown = {k: board.clue[k] for k in board.active}
        assert mismatches(puzzle, board.givens, shown) == []


def test_the_gen_json_round_trips_a_rectangle():
    board = _board(4, 3)
    with tempfile.TemporaryDirectory() as tmp:
        path = pathlib.Path(tmp) / "gen.json"
        save_board(board, path)
        assert load_board(path) == board


def test_a_square_board_records_no_shape():
    with tempfile.TemporaryDirectory() as tmp:
        shipped = load_board(RingGlobal(SPEC).files(9)[1])
        assert shipped.shape == {} and shipped.height == shipped.digits == 9
        path = pathlib.Path(tmp) / "gen.json"
        save_board(shipped, path)
        assert "height" not in path.read_text() and "digits" not in path.read_text()


def test_verify_accepts_a_rectangle_and_refuses_the_wrong_size():
    board = _board(4, 3)
    lane = RingGlobal(SPEC)
    doc = lane.build_doc(board)
    with tempfile.TemporaryDirectory() as tmp:
        link_file = pathlib.Path(tmp) / "PUZZLE_LINK_4x3.txt"
        link_file.write_text(link_codec.encode_link(doc) + "\n")
        check(board, link_file)
        # the transposed board: same cells, wrong height
        try:
            check(dataclasses.replace(board, height=4), link_file)
        except AssertionError as e:
            assert "not the 4x4 board" in str(e), str(e)
        else:
            raise AssertionError("check() let through a link of the wrong height")


def test_the_command_line_builds_and_rebuilds_a_rectangle():
    with tempfile.TemporaryDirectory() as tmp:
        link = pathlib.Path(tmp) / "link.txt"
        gen = pathlib.Path(tmp) / "gen.json"
        named = framebuild.named_files
        framebuild.named_files = lambda spec, tag: (
            link.with_name(f"link_{tag}.txt"),
            gen.with_name(f"gen_{tag}.json"),
        )
        try:
            args = ["4", "--height", "3", "--digits", "3", "--seeds", "3"]
            framebuild.main(SPEC, args)
            built = (pathlib.Path(tmp) / "link_4x3.txt").read_text()
            assert load_board(pathlib.Path(tmp) / "gen_4x3.json").height == 3
            framebuild.main(SPEC, ["4", "--rebuild", "--height", "3"])
            assert (pathlib.Path(tmp) / "link_4x3.txt").read_text() == built
        finally:
            framebuild.named_files = named


def test_generate_refuses_a_rectangle_it_cannot_build():
    shape = {"height": 3, "digits": 3}
    # bent paths read square lines; a sudoku interior's hooks take no height
    for spec, paths in [
        (SPEC, True),
        (dataclasses.replace(SPEC, grid_fn=None), False),
        (dataclasses.replace(SPEC, model_fn=None), False),
    ]:
        try:
            generate(spec, 4, 1, 4, SEEDS, paths=paths, shape=shape)
        except ValueError as e:
            assert "grid_fn and model_fn" in str(e), str(e)
        else:
            raise AssertionError(f"a rectangle was generated (paths={paths})")


def _refusal(argv):
    """The message `framebuild.main` exits with for `argv`. Its files are named
    in a temporary directory, so an `argv` it wrongly accepts writes nothing
    into the example."""
    err = io.StringIO()
    named = framebuild.named_files
    with tempfile.TemporaryDirectory() as tmp:
        framebuild.named_files = lambda spec, tag: (
            pathlib.Path(tmp) / f"link_{tag}.txt",
            pathlib.Path(tmp) / f"gen_{tag}.json",
        )
        try:
            with contextlib.redirect_stderr(err):
                framebuild.main(SPEC, argv)
        except SystemExit as e:
            assert e.code == 2, e.code
            return err.getvalue()
        finally:
            framebuild.named_files = named
    raise AssertionError(f"{argv} was accepted")


def test_main_refuses_a_rectangle_flag_it_would_drop():
    rect = ["4", "--height", "3", "--digits", "3"]
    assert "global lane only" in _refusal([*rect, "--local"])
    assert "--height and --digits together" in _refusal(["4", "--height", "3"])
    assert "a square takes it positionally" in _refusal(["4", "1", "4", "--seeds", "3"])
    assert "pass n, the lane and --height only" in _refusal(
        ["4", "--rebuild", "--height", "3", "--digits", "3"]
    )
    assert "pass n, the lane and --height only" in _refusal(
        ["9", "--rebuild", "--seeds", "3"]
    )
    assert "names no box" in _refusal([*rect[:1], "1", "4", *rect[1:]])


def test_the_rules_text_names_region_count_and_size():
    assert "9 regions, each with 9" in rule_text(9)
    assert "3 regions, each with 4" in rule_text(4, 3, 3)
    assert "digits 1-3 appear" in rule_text(4, 3, 3)


if __name__ == "__main__":
    test_a_rectangular_board_builds_and_its_link_is_a_rectangle()
    test_the_gen_json_round_trips_a_rectangle()
    test_a_square_board_records_no_shape()
    test_verify_accepts_a_rectangle_and_refuses_the_wrong_size()
    test_the_command_line_builds_and_rebuilds_a_rectangle()
    test_the_rules_text_names_region_count_and_size()
    test_generate_refuses_a_rectangle_it_cannot_build()
    test_main_refuses_a_rectangle_flag_it_would_drop()
    print("ok")
