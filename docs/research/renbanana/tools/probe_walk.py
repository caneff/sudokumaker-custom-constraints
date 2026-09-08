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
import contextlib
import json
import random
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import canon
import renbanana_verify as rv
from probe_inverted import CELLS, N, Shadings
from probe_neighbourhood import perturb

MIN_DISTANCE = 12  # the pool's own rule for "different enough"


def hamming(a, b):
    return sum(a[p] != b[p] for p in CELLS)


def hamming_rows(a, b):
    return sum(
        x != y for ra, rb in zip(a, b, strict=True) for x, y in zip(ra, rb, strict=True)
    )


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
    ap.add_argument(
        "--refresh",
        type=float,
        default=60.0,
        help="seconds between re-reads of the shared key set",
    )
    ap.add_argument(
        "--patience",
        type=int,
        default=40,
        help="consecutive dead moves before jumping out of a spent neighbourhood",
    )
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()

    a.out.mkdir(parents=True, exist_ok=True)
    origin, origin_shading, _ = rv.load(a.source)
    name = f"{a.source.parent.name}_{a.source.stem}"
    rng = random.Random(a.seed)

    # Never solve a grid twice. Legality survives every rotation and
    # reflection, so a grid whose image we have already tested tells us nothing
    # new -- and the pool's own grids are, by definition, already found.
    #
    # The set is shared. A dozen walkers drifting from nearby seeds land on each
    # other's grids constantly, and a walker that only reads the pool at startup
    # is blind to every find its siblings make while it runs. Each appends its
    # keys to its own file in a shared directory and re-reads the lot on a
    # timer: append-only, one writer per file, so no locking is needed.
    shared = a.out / "keys"
    shared.mkdir(parents=True, exist_ok=True)
    mine = shared / f"{name}.keys"
    mine_legal = shared / f"{name}.legal"

    pool_paths = sorted(Path("docs/research/renbanana").glob("candidates*/cand_*.json"))
    pool = [rv.load(p) for p in pool_paths]
    seen = {canon.key_grid(g) for g, _, _ in pool}
    # Tested and *legal* is a different set from merely tested. A grid we have
    # already shaded is nothing new to record, but it is still a legal place to
    # stand, so the walk may step onto it for free and carry on from there.
    # Without that, a walker parks the moment its own neighbourhood is spent --
    # one spun through 1.7 million instant skips in a quarter of an hour.
    legal = set(seen)
    held = len(seen)

    # What counts as worth recording: the pool's own diversity rule, applied
    # here so the walk stops writing rows the converter would only discard.
    known = [(shading_rows(is_choc), shapes_of(is_choc)) for _, is_choc, _ in pool]

    def refresh():
        for path in sorted(shared.glob("*.keys")):
            if path != mine:
                # a sibling mid-write; the next pass picks it up
                with contextlib.suppress(OSError):
                    seen.update(path.read_text().split())
        for path in sorted(shared.glob("*.legal")):
            if path != mine_legal:
                with contextlib.suppress(OSError):
                    found_keys = path.read_text().split()
                    seen.update(found_keys)
                    legal.update(found_keys)

    here = origin
    found = tries = skipped = dull = kicks = 0
    stuck = 0
    deadline = time.monotonic() + a.budget
    next_refresh = time.monotonic() + a.refresh
    log = a.out / f"{name}.jsonl"

    while time.monotonic() < deadline:
        if time.monotonic() >= next_refresh:
            refresh()
            next_refresh = time.monotonic() + a.refresh
        if stuck >= a.patience:
            # Every move from here has been tried. Jump: a run of moves taken
            # without testing any of them, which lands somewhere far enough out
            # to have untested neighbours again.
            for _ in range(rng.randint(3, 8)):
                here = perturb(here, rng)
            stuck = 0
            kicks += 1
        # Row and column swaps move the shading; a digit swap moves 18 grid
        # cells and usually none, so it is in the mix for reach, not for yield.
        candidate = perturb(here, rng, ("rows", "rows", "cols", "cols", "digits"))
        tries += 1
        k = canon.key_grid(candidate)
        if k in seen:
            skipped += 1
            stuck += 1
            if k in legal:  # already shaded once; still a legal place to stand
                here = candidate
                stuck = 0
            continue
        seen.add(k)
        stuck = 0
        with mine.open("a") as f:
            f.write(k + "\n")
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
        # Move first, record second. Stepping onto a neighbour that is merely
        # a recolour keeps the walk connected -- it may be the only bridge to
        # somewhere new -- but there is no reason to write it down.
        here = candidate
        legal.add(k)
        with mine_legal.open("a") as f:
            f.write(k + "\n")
        rows_new = shading_rows(is_choc)
        shapes_new = shapes_of(is_choc)
        if not all(
            hamming_rows(rows_new, s) >= MIN_DISTANCE or shapes_new != sh
            for s, sh in known
        ):
            dull += 1
            continue
        known.append((rows_new, shapes_new))
        found += 1
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

    print(
        f"{name}: DONE {found} recorded in {tries} tries, "
        f"{skipped} skipped as already tested, {dull} stepped through as "
        f"too close, {kicks} kicks (pool held {held})",
        flush=True,
    )


if __name__ == "__main__":
    main()
