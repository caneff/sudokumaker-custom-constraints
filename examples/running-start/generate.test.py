# generate.py's importable pieces: the grid shuffle, the Running Start clue
# rule, the CP-SAT uniqueness proof, and main()'s seed search. A real search
# is a minutes-long 9x9 carve, so main() runs here against a stubbed
# `unique` -- the same seam time_example.test.py uses for run_app_solve. The
# carve logic is then real; only the solver behind it is canned.
#
#   uv run --with lzstring --with ortools examples/running-start/generate.test.py

import contextlib
import json
import pathlib
import random
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

import generate
from generate import lines, main, make_grid, rs, unique


def _valid_sudoku(grid):
    want = set(range(1, 10))
    if any(set(row) != want for row in grid):
        return False
    if any({grid[r][c] for r in range(9)} != want for c in range(9)):
        return False
    return all(
        {grid[br + dr][bc + dc] for dr in range(3) for dc in range(3)} == want
        for br in range(0, 9, 3)
        for bc in range(0, 9, 3)
    )


if __name__ == "__main__":
    # ---- make_grid: a real solution, reproducible from its seed
    for seed in (101, 104, 112):
        assert _valid_sudoku(make_grid(random.Random(seed))), seed
    assert make_grid(random.Random(3)) == make_grid(random.Random(3))
    assert make_grid(random.Random(3)) != make_grid(random.Random(4))

    # ---- lines: 4n keys, each the full line read inward from its clue
    assert len(lines) == 36
    assert lines[("L", 2)] == [(2, c) for c in range(9)]
    assert lines[("R", 2)] == [(2, c) for c in range(8, -1, -1)]
    assert lines[("T", 5)] == [(r, 5) for r in range(9)]
    assert lines[("B", 5)] == [(r, 5) for r in range(8, -1, -1)]

    # ---- rs: the length of the first ascending run, a tie ending it. Must
    # agree with RunningStartComponent's shipped ALLOW_TIES = false, with
    # build_size.rs, and with build_link.test.running_start
    # (CODING_STANDARDS.md, "The rule has one home").
    assert rs([1, 2, 3, 4, 5, 6, 7, 8, 9]) == 9, "a fully ascending line runs to n"
    assert rs([9, 1, 2, 3]) == 1, "a descent at the first step gives a run of 1"
    assert rs([1, 2, 9, 3, 4, 5]) == 3, "the run stops at the first descent"
    assert rs([3, 3, 4, 5]) == 1, "a tie ends the run: it is not an ascent"
    assert rs([5]) == 1, "a one-cell line always runs 1"

    # ---- unique: the CP-SAT double solve
    grid = make_grid(random.Random(104))
    clue = {k: rs([grid[r][c] for r, c in cells]) for k, cells in lines.items()}
    full = {(r, c): grid[r][c] for r in range(9) for c in range(9)}

    # every cell given, no clues posted: exactly one solution
    assert unique(clue, set(), full) is True
    # every clue posted too -- the clue constraints must accept the very grid
    # they were read off, or the model and the rule have drifted apart
    assert unique(clue, set(lines), full) is True
    # an empty 9x9 with no clues has many solutions
    assert unique(clue, set(), {}) is False
    # a given that contradicts its own row is infeasible: None, never True, so
    # the carve loop cannot read "no solution" as "unique"
    broken = dict(full)
    broken[(0, 1)] = broken[(0, 0)]
    assert unique(clue, set(), broken) is None
    # a clue that lies about its line is infeasible against the full grid:
    # proof the clue constraints really constrain the model
    lying = dict(clue)
    key = ("L", 0)
    lying[key] = 1 if clue[key] != 1 else 2
    assert unique(lying, {key}, full) is None

    # ---- main(): the seed search and both carves, against a stubbed solver.
    # `fake` calls a board unique exactly when the givens cover TARGET and
    # every clue in TARGET_CLUES is still active, so both carve loops have
    # something real to find a minimum of.
    TARGET = {(0, 0), (4, 4), (8, 8)}
    TARGET_CLUES = {("L", 0), ("T", 3)}

    @contextlib.contextmanager
    def stub_unique():
        real = generate.unique
        calls = []

        def fake(clue, active, givens):
            calls.append((frozenset(active), frozenset(givens)))
            return set(givens) >= TARGET and set(active) >= TARGET_CLUES

        generate.unique = fake
        try:
            yield calls
        finally:
            generate.unique = real

    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "gen.json"
        with stub_unique() as calls:
            main(out)
        assert calls, "main must prove uniqueness through unique()"

        board = json.loads(out.read_text())
        assert set(board) == {"seed", "grid", "clue", "active", "givens"}
        assert board["seed"] in range(101, 113)
        assert _valid_sudoku(board["grid"])

        # the givens carve leaves exactly the minimum the stub demands, and
        # each one holds the solution's digit -- never an invented one
        got = {tuple(int(x) for x in k.split(",")) for k in board["givens"]}
        assert got == TARGET, f"the given carve did not reach the minimum: {got}"
        for k, v in board["givens"].items():
            r, c = (int(x) for x in k.split(","))
            assert board["grid"][r][c] == v, f"given {k} is not the solution's digit"

        # the clue carve does the same, and every kept clue is read off the
        # solution by rs()
        kept = {(k[0], int(k[1:])) for k in board["active"]}
        assert kept == TARGET_CLUES, f"the clue carve did not reach the minimum: {kept}"
        for key, cells in lines.items():
            name = f"{key[0]}{key[1]}"
            assert board["clue"][name] == rs([board["grid"][r][c] for r, c in cells]), (
                name
            )

    print("generate self-check OK")
