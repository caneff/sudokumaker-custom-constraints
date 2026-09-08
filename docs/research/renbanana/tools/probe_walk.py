"""Plateau walk across shadeable grids, to find out if the inverted pipeline's
output is diverse or inbred.

`INVERSION.md` established that one symmetry move off a known-good grid lands
on another shadeable grid about 3% of the time, against 0 in 200 for uniform
random grids -- roughly 25x cheaper per candidate than the shading-first hunt.
That saving is only worth having if the grids it produces are actually new. A
walk that never leaves its parent's neighbourhood would be cheap and useless.

So: start at a grid we know is legal, propose one symmetry move at a time, and
step onto any neighbour that is still shadeable. Every accepted step is written
out as a candidate, verified from the rules by `renbanana_verify`, with the
distance back to the grid it started from recorded on it.

    uv run --with ortools docs/research/renbanana/tools/probe_walk.py \
        --source docs/research/renbanana/candidates/cand_00.json \
        --budget 900 --out docs/research/renbanana/walk

One worker per process. The driver decides how many processes run at once, and
that is what has to stay inside the core budget (AGENTS.md).
"""

import argparse
import json
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import renbanana_verify as rv
from probe_inverted import CELLS, N, Shadings
from probe_neighbourhood import perturb


def hamming(a, b):
    return sum(a[p] != b[p] for p in CELLS)


def rows_of(grid):
    return ["".join(str(grid[r, c]) for c in range(N)) for r in range(N)]


def shading_rows(is_choc):
    return ["".join("C" if is_choc[r, c] else "b" for c in range(N)) for r in range(N)]


def shapes_of(is_choc):
    return sorted("x".join(map(str, rv.shape(g))) for g in rv.components(is_choc, True))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", type=Path, required=True)
    ap.add_argument("--budget", type=float, default=900.0, help="wall seconds")
    ap.add_argument("--seconds", type=float, default=20.0, help="per shading solve")
    ap.add_argument("--workers", type=int, default=1)
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()

    a.out.mkdir(parents=True, exist_ok=True)
    origin, origin_shading, _ = rv.load(a.source)
    name = f"{a.source.parent.name}_{a.source.stem}"
    rng = random.Random(a.seed)

    here = origin
    found = tries = 0
    deadline = time.monotonic() + a.budget
    log = a.out / f"{name}.jsonl"

    while time.monotonic() < deadline:
        candidate = perturb(here, rng)
        tries += 1
        model = Shadings(candidate)
        _, is_choc = model.solve(
            min(a.seconds, deadline - time.monotonic()), a.workers, tries
        )
        if is_choc is None:
            continue
        bad = rv.check(candidate, is_choc)
        if bad:
            print(f"{name}: REJECTED an illegal shading: {bad[0]}", flush=True)
            continue
        found += 1
        here = candidate
        row = {
            "source": str(a.source),
            "step": found,
            "tries": tries,
            "grid": rows_of(candidate),
            "shading": shading_rows(is_choc),
            "shapes": shapes_of(is_choc),
            "grid_distance_from_origin": hamming(candidate, origin),
            "shading_distance_from_origin": hamming(is_choc, origin_shading),
            "chocolate": sum(is_choc.values()),
        }
        with log.open("a") as f:
            f.write(json.dumps(row) + "\n")
        print(
            f"{name}: step {found} after {tries} tries — "
            f"grid {row['grid_distance_from_origin']} cells from origin, "
            f"shading {row['shading_distance_from_origin']}",
            flush=True,
        )

    print(f"{name}: DONE {found} steps in {tries} tries", flush=True)


if __name__ == "__main__":
    main()
