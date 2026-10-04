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
    build_model,
    count_plain_completions,
    rows_of,
    rule_forced_flatmates,
    unique_solution,
)

SEARCH_LIMIT = 30
# Plain sudoku completions are what the app's search has to cover before the rule
# prunes them: a carve to the bare minimum of givens leaves more than it can
# enumerate (a 19-given carve has over 100,000). The carve stops removing givens
# at this many plain completions.
MAX_PLAIN_COMPLETIONS = 2000
MAX_SEEDS = 50


def random_grid(seed):
    m, x = build_model()
    s = solver(SEARCH_LIMIT, reproducible=False, seed=seed, randomize=True)
    assert s.Solve(m) in SOLVED, "the flatmate rule has no solved grid"
    return {k: s.Value(v) for k, v in x.items()}


def carve(grid, rng, max_plain=MAX_PLAIN_COMPLETIONS):
    givens = dict(grid)
    cells = list(givens)
    rng.shuffle(cells)
    for cell in cells:
        trial = {k: v for k, v in givens.items() if k != cell}
        if (
            unique_solution(trial) is not None
            and count_plain_completions(trial, max_plain + 1) <= max_plain
        ):
            givens = trial
    return givens


def make_board(seed, max_plain=MAX_PLAIN_COMPLETIONS):
    rng = random.Random(seed)
    grid = random_grid(seed)
    givens = carve(grid, rng, max_plain)
    assert unique_solution(givens) == grid, "the carve lost the solution"
    if unique_solution(givens, flatmate=False) is not None:
        return None
    forced = rule_forced_flatmates(givens, grid)
    if not forced:
        return None
    return grid, givens, forced


def to_json(grid, givens, seed):
    return {
        "seed": seed,
        "grid": rows_of(grid),
        "clues": sorted([r, c] for r, c in givens),
    }


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--seed", type=int, default=1, help="first seed to try")
    p.add_argument("--out", default=HERE / "gen.json")
    p.add_argument(
        "--max-plain",
        type=int,
        default=MAX_PLAIN_COMPLETIONS,
        help="plain-sudoku completions the carve may leave; raise it for fewer givens",
    )
    args = p.parse_args()
    for seed in range(args.seed, args.seed + MAX_SEEDS):
        board = make_board(seed, args.max_plain)
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
