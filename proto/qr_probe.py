"""Timing probe for the quad-rank uniqueness check (#325).

    uv run --with ortools proto/qr_probe.py sweep  grids.json   # cost vs clue/given count
    uv run --with ortools proto/qr_probe.py minim  grids.json   # minimal clue sets

Both modes take grids emitted by `node proto/dump_grids.mjs`, so every rank
comes from the oracle, never from this file.
"""

import json
import random
import sys
from pathlib import Path
from statistics import median

from qr_cpsat import unique


def load(path):
    d = json.loads(Path(path).read_text())
    cases = [
        (g["grid"], {(w["r"] - 1, w["c"] - 1): w["rank"] for w in g["ranks"]})
        for g in d["grids"]
    ]
    return d["n"], d["box"], cases


def pick(n, grid, truth, k, gcount, rng):
    ws = rng.sample(list(truth), k)
    cells = rng.sample([(r, c) for r in range(n) for c in range(n)], gcount)
    return {w: truth[w] for w in ws}, {c: grid[c[0]][c[1]] for c in cells}


def sweep(n, box, cases, budget):
    print(f"{'clues':>6} {'givens':>7} {'unique':>7} {'median s':>9} {'max s':>8}")
    for k in (4, 8, 16, 32, 64):
        for gcount in (0, 8, 16, 24):
            times, uniq = [], 0
            for i, (grid, truth) in enumerate(cases):
                clues, givens = pick(n, grid, truth, k, gcount, random.Random(1000 + i))
                v, el = unique(n, box, grid, clues, givens, budget)
                times.append(el)
                uniq += v == "unique"
            print(
                f"{k:>6} {gcount:>7} {uniq:>3}/{len(cases):<3} {median(times):>9.2f} {max(times):>8.2f}"
            )


def minimize(n, box, cases, budget):
    """Strategy B end to end: keep dropping clues while the puzzle stays unique."""
    print(
        f"{'grid':>4} {'givens':>7} {'clues':>6} {'checks':>7} {'total s':>8} {'max s':>7}"
    )
    for i, (grid, truth) in enumerate(cases):
        for gcount in (0, 8, 16):
            rng = random.Random(2000 + i)
            clues, givens = pick(n, grid, truth, (n - 1) ** 2, gcount, rng)
            if unique(n, box, grid, clues, givens, budget)[0] != "unique":
                print(f"{i:>4} {gcount:>7}  not unique with every clue -- skipped")
                continue
            order = list(clues)
            rng.shuffle(order)
            times = []
            for w in order:
                trial = {k: v for k, v in clues.items() if k != w}
                v, el = unique(n, box, grid, trial, givens, budget)
                times.append(el)
                if v == "unique":
                    clues = trial
            print(
                f"{i:>4} {gcount:>7} {len(clues):>6} {len(times) + 1:>7} "
                f"{sum(times):>8.1f} {max(times):>7.2f}"
            )


if __name__ == "__main__":
    mode, path = sys.argv[1], sys.argv[2]
    budget = float(sys.argv[3]) if len(sys.argv) > 3 else 120.0
    n, box, cases = load(path)
    {"sweep": sweep, "minim": minimize}[mode](n, box, cases, budget)
