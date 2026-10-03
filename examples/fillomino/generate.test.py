# Tests for generate.py -- the shipped fillomino generator (#306), grown from
# the research prototype whose model docs/research/fillomino-cpsat.md records.
# Each function below is one acceptance criterion from #306.
#
#   uv run examples/fillomino/generate.test.py

import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

from generate import Board, drop, is_striped, model, rows, sample, self_check, unique
from ortools.sat.python import cp_model


def test_self_check():
    # The model-vs-flood-fill self-check: small boards enumerated both ways
    # must agree exactly. self_check() raises AssertionError on disagreement.
    self_check()


def test_cap_wider_than_side():
    # When the cap exceeds the side, `sample` forces one pin above the side, so
    # every grid it draws uses a digit the side alone would not reach, and none
    # above the cap. One pin per draw on a 5x5 with digits 1-6: without the
    # forced pin, about two draws in three still reach a 6 by chance, so thirty
    # seeds all reaching one by chance is a few-in-a-million event.
    board = Board.of(5, 6)
    for seed in range(1, 31):
        grid = sample(board, seed=seed, pins=1)
        digits = {d for row in grid for d in row}
        assert max(digits) <= 6, f"seed {seed}: digit above the cap 6: {digits}"
        assert any(d > 5 for d in digits), (
            f"seed {seed}: no digit above 5 in {sorted(digits)}"
        )


def test_model_and_rows_read_the_board_they_are_given():
    # Two boards alive at once, each with its own digit cap: a given of 5 fits
    # the cap-5 board and nothing else, and `rows` shapes the grid from the
    # board it is handed rather than from whichever was built last.
    wide, plain = Board.of(3, 5), Board.of(3)
    m_wide, x_wide = model(wide, {(0, 0): 5})
    m_plain, _ = model(plain, {(0, 0): 5})
    s = cp_model.CpSolver()
    assert s.Solve(m_plain) == cp_model.INFEASIBLE, "digit 5 does not fit a cap-3 board"
    assert s.Solve(m_wide) in (cp_model.OPTIMAL, cp_model.FEASIBLE)
    grid = rows(wide, s, x_wide)
    assert [len(row) for row in grid] == [3, 3, 3], grid
    assert grid[0][0] == 5, grid


def test_dropped_grid_logs_seed_and_clue_set():
    # #303 story 14: a dropped grid is logged with the seed and the clue set,
    # so any generator run reproduces. The log goes to stderr, since `sample`
    # prints its grid JSON on stdout.
    err = _stderr_of(
        lambda: drop(Board.of(9), "striped", 7, {(0, 0): 3, (4, 2): 9}, sub=1234)
    )
    assert err.startswith("drop (striped):"), err
    assert "seed=7" in err and "sub=1234" in err, err
    assert '"0,0": 3' in err and '"4,2": 9' in err, err


def test_unique_cli_logs_the_clue_set_it_dropped():
    # The `unique` CLI drops a timed-out grid and exits 2, naming the clue
    # set it dropped on stderr.
    gen = HERE / "gen.json"
    r = subprocess.run(
        [sys.executable, str(HERE / "generate.py"), "unique", str(gen), "0.001"],
        capture_output=True,
        text=True,
    )
    assert r.returncode == 2, (r.returncode, r.stdout, r.stderr)
    assert "unique" not in r.stdout, "a timeout must never report a verdict"
    assert "drop (timeout" in r.stderr, r.stderr
    spec = json.loads(gen.read_text())
    for r_, c_ in spec["clues"]:
        assert f'"{r_},{c_}": {spec["grid"][r_][c_]}' in r.stderr, r.stderr


def _stderr_of(fn):
    import contextlib
    import io

    buf = io.StringIO()
    with contextlib.redirect_stderr(buf):
        fn()
    return buf.getvalue()


# The raw (unpinned) grid seed 1 draws, reproduced from
# docs/research/fillomino-cpsat.md's own report that "seeds 1 and 2 return
# heavily striped grids (alternating 1/2 and 2/3 rows)". CP-SAT's 8-worker
# portfolio is not itself reproducible run to run, so this is a literal
# fixture, not a re-solve.
KNOWN_BAD_SEED_1_GRID = [
    [1, 2, 1, 2, 1, 2, 1, 2, 1],
    [3, 2, 3, 2, 3, 2, 3, 2, 3],
    [3, 1, 3, 1, 3, 1, 3, 1, 3],
    [3, 2, 3, 2, 3, 2, 3, 2, 3],
    [1, 2, 1, 2, 1, 2, 1, 2, 1],
    [2, 1, 2, 1, 2, 1, 2, 1, 2],
    [2, 4, 2, 5, 2, 3, 2, 3, 2],
    [1, 4, 1, 5, 1, 3, 4, 3, 3],
    [4, 4, 5, 5, 5, 3, 4, 4, 4],
]


def test_is_striped_reads_rows_with_at_most_two_digits():
    assert is_striped(KNOWN_BAD_SEED_1_GRID), "known-bad seed 1 grid expected striped"
    shipped = json.loads((HERE / "gen.json").read_text())["grid"]
    assert not is_striped(shipped), "the shipped grid is not dull"


def test_sample_retries_past_a_striped_grid():
    # `rows` is what sample() reads each solve through: hand it the striped
    # grid first, a good one second, and sample() must skip the first.
    import generate

    good = json.loads((HERE / "gen.json").read_text())["grid"]
    draws = [KNOWN_BAD_SEED_1_GRID, good]
    real_rows = generate.rows
    generate.rows = lambda board, s, x: draws.pop(0)
    try:
        err = _stderr_of(lambda: draws.append(sample(Board.of(6), seed=1)))
    finally:
        generate.rows = real_rows
    assert draws == [good], "sample() returned the striped grid"
    assert "drop (striped)" in err, err


def test_distinct_seeds_land_on_distinct_grids():
    # Pinned-cell diversity: two seeds must not draw the same grid.
    board = Board.of(9)
    assert sample(board, seed=1) != sample(board, seed=2)


if __name__ == "__main__":
    test_self_check()
    print("self-check: ok")
    test_model_and_rows_read_the_board_they_are_given()
    print("model and rows read the board they are given: ok")
    test_dropped_grid_logs_seed_and_clue_set()
    test_unique_cli_logs_the_clue_set_it_dropped()
    print("dropped grids log seed and clue set: ok")
    test_cap_wider_than_side()
    print("cap wider than side: ok")
    test_is_striped_reads_rows_with_at_most_two_digits()
    test_sample_retries_past_a_striped_grid()
    print("striped grids detected and retried: ok")
    test_distinct_seeds_land_on_distinct_grids()
    print("distinct seeds, distinct grids: ok")
    print("generate.test.py: ok")
