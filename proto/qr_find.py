"""Adversarial finder for a hard 9x9 quad-rank puzzle (#328).

    uv run --with ortools proto/qr_find.py grids.json 0,1,2 [steps] [out.json]
    ... --seed p.json      start from a known unique clue set, skipping the
                           greedy minimization (only valid for a single grid)

Hill-climbs over the clue set and the given set, scored by CP-SAT branches on a
single-worker from-scratch solve, with uniqueness as a hard filter. Each grid
index gets its own climb; the best board across all of them is written out.

## The score is a pair, not a number

A solve that runs out of budget reports the branches it happened to accumulate
by then, which is a clock reading, not a difficulty. The first version of this
file scored on that number and treated any timeout as an improvement; 29 of its
41 accepted moves were timeouts, and across runs the timed-out figure swung
37,520-72,080 on boards it was rating as steadily harder. That is noise.

So the score is `(timed_out, branches)`, compared lexicographically. A board
that exhausts the budget is genuinely harder than any board that finishes, and
two timed-out boards are treated as equal rather than ranked by their clock
readings. The budget is set high enough (METRIC_BUDGET) that timeouts are the
exception -- if the log fills with `>budget`, raise it, because the search is
back on a plateau.

Why CP-SAT branches and not the JS probe: `proto/qr-metric.mjs` runs the real
component and is the honest measure, but it manages ~2,000 DFS nodes/sec, which
is minutes per candidate. CP-SAT is 2-9x faster and its ordering agrees with the
probe on the two #325 puzzles. The probe re-scores the finalists, and the live
app is the arbiter.
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
METRIC_BUDGET = 120.0
UNIQUE_BUDGET = 180.0
PROGRESS = Path(__file__).with_name("PROGRESS_328.md")


def score(n, clues, givens):
    """((timed_out, branches), status, elapsed) -- the pair sorts difficulty."""
    s = stats(n, clues, givens, seconds=METRIC_BUDGET)
    timed_out = s["status"] not in ("OPTIMAL", "FEASIBLE", "INFEASIBLE")
    return (timed_out, s["branches"]), s["status"], s["elapsed"]


def show(key):
    return f">{METRIC_BUDGET:.0f}s" if key[0] else f"{key[1]}"


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

    Every window clued solves in zero branches, so a climb starting there has no
    gradient to follow -- the first run of this file accepted nothing at all.
    This is #325's minimization pass, reused as the seed.
    """
    clues = dict(truth)
    order = list(clues)
    rng.shuffle(order)
    for w in order:
        trial = {k: v for k, v in clues.items() if k != w}
        if unique(n, box, grid, trial, {}, UNIQUE_BUDGET)[0] == "unique":
            clues = trial
    log(f"seed: greedy-minimized to {len(clues)} clues, 0 givens")
    return clues


def climb(n, box, grid, truth, steps, rng, log, seed_clues=None):
    clues = seed_clues or greedy_min(n, box, grid, truth, rng, log)
    givens = {}
    cur, status, el = score(n, clues, givens)
    best, best_clues, best_givens = cur, dict(clues), dict(givens)
    log(f"seed score: {show(cur)} branches {status} ({el:.1f}s)")
    improved = timeouts = 0
    for step in range(steps):
        cand_clues, cand_givens, move = neighbours(n, truth, clues, givens, grid, rng)
        if not cand_clues:
            continue
        if unique(n, box, grid, cand_clues, cand_givens, UNIQUE_BUDGET)[0] != "unique":
            continue
        key, status, el = score(n, cand_clues, cand_givens)
        timeouts += key[0]
        # Accept ties so the search can drift along a plateau; keep the best seen.
        if key >= cur:
            clues, givens, cur = cand_clues, cand_givens, key
            mark = ""
            if key > best:
                best, best_clues, best_givens = key, dict(clues), dict(givens)
                improved += 1
                mark = "  BEST"
            log(
                f"step {step:>4} {move:<11} clues {len(clues):>2} givens {len(givens):>2} "
                f"branches {show(key):>8} {status} ({el:.1f}s){mark}"
            )
    return best_clues, best_givens, best, improved, timeouts


if __name__ == "__main__":
    seed_clues = None
    if "--seed" in sys.argv:
        i = sys.argv.index("--seed")
        sp = json.loads(Path(sys.argv[i + 1]).read_text())
        seed_clues = {(r, c): k for r, c, k in sp["clues"]}
        del sys.argv[i : i + 2]
    path = sys.argv[1]
    idxs = [int(v) for v in sys.argv[2].split(",")]
    steps = int(sys.argv[3]) if len(sys.argv) > 3 else 150
    out = sys.argv[4] if len(sys.argv) > 4 else None
    if seed_clues and len(idxs) > 1:
        sys.exit("--seed names one clue set, so it takes exactly one grid index")
    n, box, cases = load(path)
    # Concurrent runs share PROGRESS_328.md, so every line carries a run tag.
    run = f"{time.strftime('%H%M%S')}"

    def log(line):
        print(line, flush=True)
        with PROGRESS.open("a") as f:
            f.write(f"[{run}] {line}\n")

    started = time.time()
    log(
        f"\n## run {run}: grids {idxs}, {steps} steps each, budget {METRIC_BUDGET:.0f}s"
    )
    overall = None
    for idx in idxs:
        grid, truth = cases[idx]
        log(f"-- grid {idx}")
        clues, givens, key, improved, timeouts = climb(
            n, box, grid, truth, steps, random.Random(7000 + idx), log, seed_clues
        )
        log(
            f"grid {idx}: {len(clues)} clues, {len(givens)} givens, branches {show(key)}, "
            f"{improved} improvements, {timeouts} timeouts"
        )
        if overall is None or key > overall[0]:
            overall = (key, grid, clues, givens, idx)
    key, grid, clues, givens, idx = overall
    log(f"DONE best grid {idx}: branches {show(key)}, {time.time() - started:.0f}s")
    if out:
        Path(out).write_text(
            json.dumps(
                {
                    "grid": grid,
                    "clues": [[r, c, k] for (r, c), k in sorted(clues.items())],
                    "givens": [[r, c] for r, c in sorted(givens)],
                    "branches": key[1],
                    "timedOut": key[0],
                    "gridIndex": idx,
                }
            )
        )
        log(f"wrote {out}")
