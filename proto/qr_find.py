"""Adversarial finder for a hard 9x9 quad-rank puzzle (#328).

    uv run --with ortools proto/qr_find.py grids.json <grid-index> [steps] [out.json]

Hill-climbs over the clue set and the given set of one fixed grid, scored by
CP-SAT branches on a from-scratch solve, with uniqueness as a hard filter.
Progress is appended to PROGRESS_328.md as it runs.

Why CP-SAT branches and not the JS probe: `proto/qr-metric.mjs` runs the real
component and is the honest measure, but it manages ~2,000 DFS nodes/sec, which
is minutes per candidate. CP-SAT is 2-9x faster and its ordering agrees with the
probe on the two #325 puzzles. The probe re-scores the finalists.
"""

import json
import random
import sys
import time
from pathlib import Path

from qr_cpsat import unique
from qr_probe import load
from qr_stats import stats

# Ranks where the leading-digit bound (#324) leaves two digits rather than one.
AMBIGUOUS = {8, 15, 22, 29, 36, 43, 50, 57}
METRIC_BUDGET = 15.0
PROGRESS = Path(__file__).with_name("PROGRESS_328.md")


def score(n, clues, givens):
    """(unique?, branches). Uniqueness is checked first -- it is the cheaper call."""
    s = stats(n, clues, givens, seconds=METRIC_BUDGET)
    return s["branches"], s["status"], s["elapsed"]


def neighbours(n, truth, clues, givens, grid, rng):
    """One random move: swap/drop/add a clue, or drop/swap a given."""
    clues, givens = dict(clues), dict(givens)
    moves = ["swap_clue", "drop_clue", "add_clue", "drop_given", "swap_given"]
    if not givens:
        moves = moves[:3]
    move = rng.choice(moves)
    free = [w for w in truth if w not in clues]
    if move == "swap_clue" and clues and free:
        del clues[rng.choice(list(clues))]
        # Bias toward the ranks that leak the least (#324).
        amb = [w for w in free if truth[w] in AMBIGUOUS]
        w = rng.choice(amb if amb and rng.random() < 0.5 else free)
        clues[w] = truth[w]
    elif move == "drop_clue" and len(clues) > 2:
        del clues[rng.choice(list(clues))]
    elif move == "add_clue" and free:
        w = rng.choice(free)
        clues[w] = truth[w]
    elif move == "drop_given" and givens:
        del givens[rng.choice(list(givens))]
    elif move == "swap_given" and givens:
        del givens[rng.choice(list(givens))]
        opts = [(r, c) for r in range(n) for c in range(n) if (r, c) not in givens]
        cell = rng.choice(opts)
        givens[cell] = grid[cell[0]][cell[1]]
    return clues, givens, move


def greedy_min(n, box, grid, truth, rng, log):
    """A unique starting point: drop every clue the puzzle survives without.

    Every window clued solves with zero branches, so a climb starting there has
    no gradient to follow. This is #325's minimization pass, reused as the seed.
    """
    clues = dict(truth)
    order = list(clues)
    rng.shuffle(order)
    for w in order:
        trial = {k: v for k, v in clues.items() if k != w}
        if unique(n, box, grid, trial, {}, 180.0)[0] == "unique":
            clues = trial
    log(f"seed: greedy-minimized to {len(clues)} clues, 0 givens")
    return clues


def climb(n, box, grid, truth, steps, rng, log, seed_clues=None):
    clues = seed_clues or greedy_min(n, box, grid, truth, rng, log)
    givens = {}
    cur, status, _ = score(n, clues, givens)
    best, best_clues, best_givens = cur, dict(clues), dict(givens)
    log(f"seed score: {cur} branches {status}")
    improved = 0
    for step in range(steps):
        cand_clues, cand_givens, move = neighbours(n, truth, clues, givens, grid, rng)
        if not cand_clues:
            continue
        if unique(n, box, grid, cand_clues, cand_givens, 120.0)[0] != "unique":
            continue
        branches, status, el = score(n, cand_clues, cand_givens)
        # A censored score (the metric ran out of budget) is at least this hard.
        censored = status not in ("OPTIMAL", "FEASIBLE", "INFEASIBLE")
        # Accept ties so the search can drift along a plateau; keep the best seen.
        if censored or branches >= cur:
            clues, givens, cur = cand_clues, cand_givens, branches
            mark = ""
            if censored or branches > best:
                best, best_clues, best_givens = branches, dict(clues), dict(givens)
                improved += 1
                mark = "  BEST"
            log(
                f"step {step:>4} {move:<11} clues {len(clues):>2} givens {len(givens):>2} "
                f"branches {branches:>8} {status} ({el:.1f}s){mark}"
            )
    return best_clues, best_givens, best, improved


if __name__ == "__main__":
    # --seed <json> starts from a known unique clue set instead of paying for
    # the greedy minimization again; runs then differ only in the climb.
    seed_clues = None
    if "--seed" in sys.argv:
        i = sys.argv.index("--seed")
        sp = json.loads(Path(sys.argv[i + 1]).read_text())
        seed_clues = {(r, c): k for r, c, k in sp["clues"]}
        del sys.argv[i : i + 2]
    path, idx = sys.argv[1], int(sys.argv[2])
    steps = int(sys.argv[3]) if len(sys.argv) > 3 else 150
    out = sys.argv[4] if len(sys.argv) > 4 else None
    n, box, cases = load(path)
    grid, truth = cases[idx]
    rng = random.Random(7000 + idx)

    started = time.time()

    def log(line):
        print(line, flush=True)
        with PROGRESS.open("a") as f:
            f.write(f"{line}\n")

    log(f"\n## grid {idx}, {steps} steps, started {time.strftime('%H:%M:%S')}")
    clues, givens, branches, accepted = climb(
        n, box, grid, truth, steps, rng, log, seed_clues
    )
    log(
        f"DONE grid {idx}: {len(clues)} clues, {len(givens)} givens, "
        f"{branches} branches, {accepted} improvements, {time.time() - started:.0f}s"
    )
    if out:
        Path(out).write_text(
            json.dumps(
                {
                    "grid": grid,
                    "clues": [[r, c, k] for (r, c), k in sorted(clues.items())],
                    "givens": [[r, c] for r, c in sorted(givens)],
                    "branches": branches,
                }
            )
        )
        log(f"wrote {out}")
