# Generate the Dutch Flatmates board: a random solved grid under sudoku plus the
# flatmate rule, then greedy given removal for as long as the board stays
# uniquely solvable, written to gen.json (the board `build_link.py` encodes).
#
#   uv run examples/dutch-flatmates/generate.py [--seed N] [--out gen.json]
#
# The carve also keeps plain sudoku's completions few (MAX_PLAIN_COMPLETIONS),
# because the shipped component validates only and the app enumerates them.
#
# Two things the carve must leave true, asserted before anything is written:
# the flatmate rule is needed (plain sudoku on the same givens has more than one
# solution), and at least one 5 has its flatmate forced by the rule rather
# than by the givens (`flatmate_model.rule_forced_flatmates`). A seed that
# fails either is skipped and the next one tried.
#
# Workers: the grid search takes CP-SAT's portfolio (`cpsat.SEARCH_WORKERS`, 8
# workers) for a fraction of a second; every uniqueness check is one worker.

import argparse
import json
import pathlib
import random
import sys

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from cpsat import SOLVED, solver
from flatmate_model import (
    N,
    build_model,
    count_plain_completions,
    is_unique,
    rule_forced_flatmates,
)

SEARCH_LIMIT = 30
# The component only validates, so the app fills the grid by plain sudoku and
# tests the rule on every full grid: a carve to the bare minimum of givens
# leaves it more completions than it can enumerate (a 19-given carve has over
# 100,000). The carve stops removing givens at this many plain completions.
MAX_PLAIN_COMPLETIONS = 2000
MAX_SEEDS = 50


def random_grid(seed):
    """A solved grid under sudoku plus the flatmate rule, varied by `seed`."""
    m, x = build_model()
    s = solver(SEARCH_LIMIT, reproducible=False, seed=seed, randomize=True)
    assert s.Solve(m) in SOLVED, "the flatmate rule has no solved grid"
    return {k: s.Value(v) for k, v in x.items()}


def carve(grid, rng):
    """The givens left after dropping every one of `grid`'s cells that the
    board can spare, in random order, while the solution stays unique under the
    rule and plain sudoku keeps at most MAX_PLAIN_COMPLETIONS completions."""
    givens = dict(grid)
    cells = list(givens)
    rng.shuffle(cells)
    for cell in cells:
        trial = {k: v for k, v in givens.items() if k != cell}
        if (
            is_unique(trial) is not None
            and count_plain_completions(trial, MAX_PLAIN_COMPLETIONS + 1)
            <= MAX_PLAIN_COMPLETIONS
        ):
            givens = trial
    return givens


def make_board(seed):
    """(grid, givens, forced) for `seed`, or None when its carve does not need
    the rule. `forced` is `rule_forced_flatmates`' list for the shipped givens."""
    rng = random.Random(seed)
    grid = random_grid(seed)
    givens = carve(grid, rng)
    assert is_unique(givens) == grid, "the carve lost the solution"
    if is_unique(givens, flatmate=False) is not None:
        return None  # plain sudoku already solves it: the rule is decoration
    forced = rule_forced_flatmates(givens, grid)
    if not forced:
        return None
    return grid, givens, forced


def to_json(grid, givens, seed):
    return {
        "seed": seed,
        "grid": ["".join(str(grid[r, c]) for c in range(N)) for r in range(N)],
        "clues": sorted([r, c] for r, c in givens),
    }


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--seed", type=int, default=1, help="first seed to try")
    p.add_argument("--out", default=HERE / "gen.json")
    args = p.parse_args()
    for seed in range(args.seed, args.seed + MAX_SEEDS):
        board = make_board(seed)
        if board is None:
            print(f"seed {seed}: the rule is not needed or forces no flatmate; next")
            continue
        grid, givens, forced = board
        pathlib.Path(args.out).write_text(
            json.dumps(to_json(grid, givens, seed), indent=1) + "\n"
        )
        print(
            f"seed {seed}: {len(givens)} givens, {len(forced)} rule-forced flatmate(s)"
        )
        print(f"wrote {args.out}")
        break
    else:
        sys.exit(f"no board in {MAX_SEEDS} seeds from {args.seed}")
