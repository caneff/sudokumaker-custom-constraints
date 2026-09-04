# Tests for generate.py -- the shipped fillomino generator (#306), grown from
# docs/research/fillomino_cpsat.py. Each function below is one acceptance
# criterion from #306.
#
#   uv run --with ortools examples/fillomino/generate.test.py

import json
import pathlib
import subprocess
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

from generate import drop, is_striped, sample, self_check, set_board, unique


def test_self_check():
    # The model-vs-flood-fill self-check: small boards enumerated both ways
    # must agree exactly. self_check() raises AssertionError on disagreement.
    self_check()


def test_timeout_never_a_verdict():
    set_board(9)
    try:
        unique({}, limit=0.001)
    except TimeoutError:
        pass
    else:
        raise AssertionError("a tiny time cap must raise, not report a verdict")


def test_cap_wider_than_side():
    # 9x9 board, digits 1-12: a valid grid must use a digit above 9 somewhere,
    # since a 9-cell board side alone cannot hold a region of, say, 10 cells
    # unless the region snakes across many rows -- the point is the cap, not
    # the side, bounds the digit.
    grid = sample(seed=1, side=9, cap=12, pins=4)
    digits = {d for row in grid for d in row}
    assert max(digits) <= 12, f"digit above the cap 12: {digits}"
    assert any(d > 9 for d in digits), f"no digit above 9 in {sorted(digits)}"


def test_dropped_grid_logs_seed_and_clue_set():
    # #303 story 14: a dropped grid is logged with the seed and the clue set,
    # so any generator run reproduces. The log goes to stderr, since `sample`
    # prints its grid JSON on stdout.
    set_board(9)
    err = _stderr_of(lambda: drop("striped", 7, {(0, 0): 3, (4, 2): 9}, sub=1234))
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


def test_striped_seeds_rejected_and_sampling_varies():
    assert is_striped(KNOWN_BAD_SEED_1_GRID), "known-bad seed 1 grid expected striped"

    # sample() must never hand back a striped grid, even fed a bad seed.
    set_board(9)
    g1 = sample(seed=1, side=9)
    g2 = sample(seed=2, side=9)
    assert not is_striped(g1)
    assert not is_striped(g2)

    # Distinct seeds must land on distinct grids -- pinned-cell diversity.
    assert g1 != g2


if __name__ == "__main__":
    test_self_check()
    print("self-check: ok")
    test_timeout_never_a_verdict()
    print("timeout never a verdict: ok")
    test_dropped_grid_logs_seed_and_clue_set()
    test_unique_cli_logs_the_clue_set_it_dropped()
    print("dropped grids log seed and clue set: ok")
    test_cap_wider_than_side()
    print("cap wider than side: ok")
    test_striped_seeds_rejected_and_sampling_varies()
    print("striped seeds rejected, sampling varies: ok")
    print("generate.test.py: ok")
