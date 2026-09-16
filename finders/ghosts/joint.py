"""Ghosts, all visible and connected: solve for the grid and the shape together.

    uv run finders/ghosts/joint.py --seconds 600 [--min-ghosts 20] [--maximize]

Why not fix the grid first: the obvious sampler (relabel a base grid, shuffle
rows within bands, swap bands and stacks, transpose) only walks one grid's
symmetry orbit, so it samples a single equivalence class out of the 5.47
billion and any ceiling it reports is an artefact. The grid has to be a
variable.

One model: a solved sudoku, ghost booleans, every ghost's digit equal to its
ghost-neighbour count (all visible), and flow connectivity. `--maximize` asks
for the largest connected ghost set that exists at all; `--min-ghosts` asks for
a feasible one of at least that size, which is the question uniqueness needs
(uniqueness wants many givens).
"""

import argparse
import json
import time
from pathlib import Path

from ortools.sat.python import cp_model
from shapes import NEIGH, ORTH, count_solutions, givens


def add_flow_connectivity(m, g, cap=81):
    """One root ghost supplies a unit of flow to every other ghost.

    `cap` is the largest possible ghost count. Sizing the flow domains to it
    rather than to 81 matters: `joint.py --maximize` proves no connected
    all-visible shape exceeds 26 ghosts, so 0..81 arcs hand the solver three
    times the range it can ever use.
    """
    root = [m.new_bool_var(f"r{i}") for i in range(81)]
    m.add_exactly_one(root)
    arcs = {}
    for i in range(81):
        m.add_implication(root[i], g[i])
        for j in ORTH[i]:
            f = m.new_int_var(0, cap, f"f{i}_{j}")
            m.add(f <= cap * g[i])
            m.add(f <= cap * g[j])
            arcs[i, j] = f
    for i in range(81):
        supply = m.new_int_var(0, cap, f"s{i}")
        m.add(supply <= cap * root[i])
        m.add(
            sum(arcs[j, i] for j in ORTH[i]) + supply
            == sum(arcs[i, j] for j in ORTH[i]) + g[i]
        )


def build(min_ghosts, max_ghosts, maximize, weights=None, connect=True):
    m = cp_model.CpModel()
    v = [m.new_int_var(1, 9, f"v{i}") for i in range(81)]
    for r in range(9):
        m.add_all_different([v[r * 9 + c] for c in range(9)])
        m.add_all_different([v[c * 9 + r] for c in range(9)])
    for br in range(3):
        for bc in range(3):
            m.add_all_different(
                [v[(br * 3 + r) * 9 + bc * 3 + c] for r in range(3) for c in range(3)]
            )
    g = [m.new_bool_var(f"g{i}") for i in range(81)]
    for i in range(81):
        m.add(v[i] == sum(g[j] for j in NEIGH[i])).only_enforce_if(g[i])
    m.add(sum(g) >= min_ghosts)
    m.add(sum(g) <= max_ghosts)
    if connect:
        add_flow_connectivity(m, g, cap=max_ghosts)
    if maximize:
        m.maximize(sum(g))
    elif weights is not None:
        # Random weights per solve, the diversity trick renbanana and
        # zombo_brainanas both landed on: solve-then-forbid moves one point at
        # a time and returns near-identical shapes, while a fresh random
        # objective lands somewhere else in the feasible set every time.
        m.maximize(sum(w * x for w, x in zip(weights, g, strict=True)))
    return m, v, g


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--seconds", type=float, default=600)
    ap.add_argument("--min-ghosts", type=int, default=1)
    ap.add_argument("--max-ghosts", type=int, default=81)
    ap.add_argument("--maximize", action="store_true")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--out", type=Path)
    a = ap.parse_args()
    t0 = time.monotonic()
    m, v, g = build(a.min_ghosts, a.max_ghosts, a.maximize)
    s = cp_model.CpSolver()
    s.parameters.num_workers = a.workers
    s.parameters.max_time_in_seconds = a.seconds
    s.parameters.log_search_progress = False
    st = s.solve(m)
    el = time.monotonic() - t0
    print(f"{s.status_name(st)} in {el:.1f}s (min {a.min_ghosts}, max {a.max_ghosts})")
    if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return
    shape = {i for i in range(81) if s.value(g[i])}
    grid = [s.value(x) for x in v]
    print(f"ghosts {len(shape)}", "optimal" if st == cp_model.OPTIMAL else "feasible")
    print("shape", sorted(shape))
    gv = givens(shape)
    print("admissible:", gv is not None)
    if gv is not None:
        print("sudoku solutions (cap 2):", count_solutions(gv, 2))
    for r in range(9):
        print(
            " ".join(
                f"({grid[r * 9 + c]})" if r * 9 + c in shape else f" {grid[r * 9 + c]} "
                for c in range(9)
            )
        )
    if a.out:
        with a.out.open("a") as fh:
            fh.write(json.dumps({"shape": sorted(shape), "grid": grid}) + "\n")


if __name__ == "__main__":
    main()
