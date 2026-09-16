"""Enumerate connected shapes of one size, shape-only, and let the counter judge.

    uv run finders/counting_shaded/shapeenum.py --size 21 [--force 72,73] [--ban 57] --out DIR

Faster than `pinharvest.py --enumerate` by leaving the digits out of the CP-SAT
model. The model holds only the shape: counts 1-8 on shaded cells, distinct
within every row, column and box, flow connectivity, pins, and all eight of
1-8 present. Every shape it returns is then classified by the C counter in
under a millisecond: 0 sudoku solutions (no grid completes it), 1 (unique), or
2+. Solve-then-forbid until INFEASIBLE, which exhausts the size.

The old lesson that a shape-only search "cannot see solvability" still holds;
it does not need to. The counter is the solvability check, and it is cheaper
than carrying 81 digit variables through every solve.
"""

import argparse
import json
import time
from pathlib import Path

from fastclimb import count, pins
from joint import add_flow_connectivity
from ortools.sat.python import cp_model
from shapes import BOX, CELLS, NEIGH


def build(size, force=(), ban=(), all_digits=True):
    m = cp_model.CpModel()
    g = [m.new_bool_var(f"g{i}") for i in range(81)]
    n = [m.new_int_var(0, 8, f"n{i}") for i in range(81)]
    for i in range(81):
        m.add(n[i] == sum(g[j] for j in NEIGH[i]))
        m.add(n[i] >= 1).only_enforce_if(g[i])
        for j in range(i + 1, 81):
            if (
                CELLS[i][0] == CELLS[j][0]
                or CELLS[i][1] == CELLS[j][1]
                or BOX[i] == BOX[j]
            ):
                m.add(n[i] != n[j]).only_enforce_if([g[i], g[j]])
    for i in force:
        m.add(g[i] == 1)
    for i in ban:
        m.add(g[i] == 0)
    m.add(sum(g) == size)
    add_flow_connectivity(m, g, cap=size)
    if all_digits:
        for d in range(1, 9):
            shows = []
            for i in range(81):
                b = m.new_bool_var(f"d{d}_{i}")
                m.add_implication(b, g[i])
                m.add(n[i] == d).only_enforce_if(b)
                shows.append(b)
            m.add_bool_or(shows)
    return m, g


def enumerate_size(size, force, ban, seconds, workers, out, log, all_digits=True):
    """Returns (status, shapes, solvable, unique)."""
    m, g = build(size, force, ban, all_digits)
    s = cp_model.CpSolver()
    s.parameters.num_workers = workers
    t0 = time.monotonic()
    shapes = solvable = unique = 0
    while True:
        left = seconds - (time.monotonic() - t0)
        if left <= 1:
            log(
                f"time up: size {size} NOT exhausted; {shapes} shapes, {solvable} solvable, {unique} unique"
            )
            return "timeout", shapes, solvable, unique
        s.parameters.max_time_in_seconds = left
        st = s.solve(m)
        if st == cp_model.INFEASIBLE:
            log(
                f"EXHAUSTED size {size}: {shapes} shapes, {solvable} solvable, "
                f"{unique} unique ({time.monotonic() - t0:.0f}s)"
            )
            return "exhausted", shapes, solvable, unique
        if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            log(f"{s.status_name(st)}: size {size} NOT exhausted after {shapes} shapes")
            return "timeout", shapes, solvable, unique
        shape = {i for i in range(81) if s.value(g[i])}
        shapes += 1
        k = count(shape, 2)
        if k >= 1:
            solvable += 1
            with (out / "solvable.jsonl").open("a") as fh:
                fh.write(
                    json.dumps({"shaded": size, "shape": sorted(shape), "solutions": k})
                    + "\n"
                )
        if k == 1:
            unique += 1
            log(f"UNIQUE {size}: {sorted(shape)}")
        m.add_bool_or(
            [g[i].Not() for i in shape] + [g[i] for i in range(81) if i not in shape]
        )
        if shapes % 100 == 0:
            log(
                f"size {size}: {shapes} shapes, {solvable} solvable, {unique} unique ({time.monotonic() - t0:.0f}s)"
            )


def parse_cells(text):
    return tuple(int(x) for x in text.split(",")) if text else ()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", type=int, required=True)
    ap.add_argument("--force", default="")
    ap.add_argument("--ban", default="")
    ap.add_argument("--no-all-digits", action="store_true")
    ap.add_argument("--seconds", type=float, default=600)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--out", type=Path, required=True)
    a = ap.parse_args()
    a.out.mkdir(parents=True, exist_ok=True)
    force, ban = parse_cells(a.force), parse_cells(a.ban)
    pins(force, ban)
    progress = a.out / "progress.log"

    def log(msg):
        line = f"{time.strftime('%H:%M:%S')} {msg}"
        print(line, flush=True)
        with progress.open("a") as fh:
            fh.write(line + "\n")

    log(
        f"shape-only enumerate size {a.size} force={force} ban={ban} workers={a.workers}"
    )
    enumerate_size(
        a.size, force, ban, a.seconds, a.workers, a.out, log, not a.no_all_digits
    )


if __name__ == "__main__":
    main()
