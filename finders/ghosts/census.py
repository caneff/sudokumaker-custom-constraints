"""Possible ghost grids: connected all-visible configurations, uniqueness aside.

    uv run finders/ghosts/census.py --seconds 600 --out DIR

A configuration here is a (grid, shape) pair where the grid is a valid sudoku,
the shape is an orthogonally connected set of ghost cells, and every ghost's
digit equals its ghost-neighbour count. Nothing about uniqueness -- this is the
population the uniqueness hunt draws from, and the baseline corpus for
validating anything that claims to handle connected ghosts.

One solve per configuration with a fresh random objective, which is what keeps
consecutive answers apart (solve-then-forbid returns near-identical shapes).
Every hit is re-verified from the stored grid and shape before it is written,
by code that does not share the model: the grid is checked as a sudoku, the
shape as connected by flood fill, and each ghost digit against its own count.
"""

import argparse
import json
import random
import time
from collections import Counter
from pathlib import Path

from joint import build
from ortools.sat.python import cp_model
from shapes import BOX, NEIGH, connected


def verify(grid, shape):
    """Independent re-check of one configuration. Returns a reason or None."""
    if len(grid) != 81 or any(d not in range(1, 10) for d in grid):
        return "grid is not 81 digits 1-9"
    for r in range(9):
        if len({grid[r * 9 + c] for c in range(9)}) != 9:
            return f"row {r} repeats"
        if len({grid[c * 9 + r] for c in range(9)}) != 9:
            return f"column {r} repeats"
    for b in range(9):
        if len({grid[i] for i in range(81) if BOX[i] == b}) != 9:
            return f"box {b} repeats"
    if not shape:
        return "empty shape"
    if not connected(set(shape)):
        return "shape is not orthogonally connected"
    for i in shape:
        n = sum(j in set(shape) for j in NEIGH[i])
        if grid[i] != n:
            return f"cell {i}: digit {grid[i]} but {n} ghost neighbours"
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--seconds", type=float, default=600)
    ap.add_argument("--solve-seconds", type=float, default=60)
    ap.add_argument("--min-ghosts", type=int, default=1)
    ap.add_argument("--max-ghosts", type=int, default=26)
    ap.add_argument("--workers", type=int, default=2)
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    rng = random.Random(a.seed)
    t0 = time.monotonic()
    sizes, found, bad, seen = Counter(), 0, 0, set()
    while time.monotonic() - t0 < a.seconds:
        left = min(a.solve_seconds, a.seconds - (time.monotonic() - t0))
        if left <= 1:
            break
        weights = [rng.randint(-100, 100) for _ in range(81)]
        m, v, g = build(a.min_ghosts, a.max_ghosts, maximize=False, weights=weights)
        s = cp_model.CpSolver()
        s.parameters.num_workers = a.workers
        s.parameters.random_seed = rng.randrange(1 << 30)
        s.parameters.max_time_in_seconds = left
        st = s.solve(m)
        if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            continue
        shape = sorted(i for i in range(81) if s.value(g[i]))
        grid = [s.value(x) for x in v]
        why = verify(grid, shape)
        if why:
            bad += 1
            print(f"REJECTED by verifier: {why}", flush=True)
            continue
        found += 1
        sizes[len(shape)] += 1
        key = (tuple(shape), tuple(grid))
        if key not in seen:
            seen.add(key)
            with (a.out / "configurations.jsonl").open("a") as fh:
                fh.write(
                    json.dumps({"ghosts": len(shape), "shape": shape, "grid": grid})
                    + "\n"
                )
        (a.out / "summary.json").write_text(
            json.dumps(
                {
                    "seed": a.seed,
                    "found": found,
                    "distinct": len(seen),
                    "rejected": bad,
                    "sizes": dict(sorted(sizes.items())),
                },
                indent=2,
            )
        )
        print(
            f"{found} configs ({len(seen)} distinct), sizes "
            f"{dict(sorted(sizes.items()))}, {time.monotonic() - t0:.0f}s",
            flush=True,
        )
    print(f"done: {found} found, {len(seen)} distinct, {bad} rejected by the verifier")


if __name__ == "__main__":
    main()
