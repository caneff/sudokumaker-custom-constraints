"""Quad-rank uniqueness check in CP-SAT (#325).

    uv run --with ortools proto/qr_cpsat.py        # self-check against the oracle

Strategy B: the oracle already handed us the grid and its true ranks, so this
never searches for a witness. It asks one question -- "is there a *second*
solution?" -- and answers it by proving infeasibility, the cheap side of the
asymmetry #323 measured.

Encoding. A window's value is the linear expression 1000*TL + 100*TR + 10*BL +
BR. SQL RANK is "1 + how many windows are strictly smaller", so a clued window
w with rank R gets 63 reified booleans lt[u] <=> V[u] < V[w] and one equality
sum(lt) == R - 1. Ties fall out for free: two equal windows each count zero for
the other, so they share a rank and the ranks after them are skipped. Nothing
here treats ranks as all-different or as a permutation of 1..64.
"""

import json
import sys
import time
from pathlib import Path

from ortools.sat.python import cp_model


def windows(n):
    """Top-left cells of every 2x2 window, 0-based, row-major."""
    return [(r, c) for r in range(n - 1) for c in range(n - 1)]


def allowed_top_left(n, rank):
    """Digits the top-left may still hold, from the leading-digit bound (#324)."""
    return [
        d
        for d in range(1, n + 1)
        if (n - 2) * (d - 1) + 1 <= rank <= (n - 2) * (d - 1) + (n - 1)
    ]


def build(n, box, clues, givens):
    """Sudoku + quad-rank clues. clues: {(r, c): rank}. givens: {(r, c): digit}."""
    m = cp_model.CpModel()
    x = {(r, c): m.new_int_var(1, n, f"x{r}_{c}") for r in range(n) for c in range(n)}
    for i in range(n):
        m.add_all_different([x[i, c] for c in range(n)])
        m.add_all_different([x[r, i] for r in range(n)])
    br, bc = box
    for r0 in range(0, n, br):
        for c0 in range(0, n, bc):
            m.add_all_different(
                [x[r0 + i, c0 + j] for i in range(br) for j in range(bc)]
            )
    for cell, d in givens.items():
        m.add(x[cell] == d)

    val = {
        w: 1000 * x[w[0], w[1]]
        + 100 * x[w[0], w[1] + 1]
        + 10 * x[w[0] + 1, w[1]]
        + x[w[0] + 1, w[1] + 1]
        for w in windows(n)
    }
    for w, rank in clues.items():
        lts = []
        for u in windows(n):
            if u == w:
                continue
            b = m.new_bool_var(f"lt{u}_{w}")
            m.add(val[u] < val[w]).only_enforce_if(b)
            m.add(val[u] >= val[w]).only_enforce_if(~b)
            lts.append(b)
        m.add(sum(lts) == rank - 1)
        # Redundant but free: the same bound the component's update uses.
        m.add_allowed_assignments([x[w]], [(d,) for d in allowed_top_left(n, rank)])
    return m, x


def _solver(seconds):
    s = cp_model.CpSolver()
    s.parameters.max_time_in_seconds = seconds
    s.parameters.num_workers = 8
    s.parameters.interleave_search = (
        True  # #323: wall times are not reproducible without it
    )
    return s


def unique(n, box, grid, clues, givens, seconds=300.0):
    """Is `grid` the only solution? Returns (verdict, elapsed). verdict in
    {"unique", "multiple", "timeout"}."""
    m, x = build(n, box, clues, givens)
    diffs = []
    for r in range(n):
        for c in range(n):
            if (r, c) in givens:
                continue
            b = m.new_bool_var(f"d{r}_{c}")
            m.add(x[r, c] != grid[r][c]).only_enforce_if(b)
            diffs.append(b)
    m.add_bool_or(diffs)
    s = _solver(seconds)
    t = time.perf_counter()
    st = s.solve(m)
    el = time.perf_counter() - t
    return {
        cp_model.INFEASIBLE: "unique",
        cp_model.OPTIMAL: "multiple",
        cp_model.FEASIBLE: "multiple",
    }.get(st, "timeout"), el


def solve_one(n, box, clues, givens, seconds=300.0):
    """A witness, or None. Used only by the self-check."""
    m, x = build(n, box, clues, givens)
    s = _solver(seconds)
    st = s.solve(m)
    if st not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None
    return [[s.value(x[r, c]) for c in range(n)] for r in range(n)]


def _selfcheck():
    """The model must reproduce the oracle. Pin a grid, clue all (n-1)^2 windows
    with their true ranks -- feasible. Change one rank -- infeasible."""
    data = json.loads((Path(__file__).parent / "grids_selfcheck.json").read_text())
    n, box = data["n"], data["box"]
    for i, case in enumerate(data["grids"]):
        grid = case["grid"]
        truth = {(w["r"] - 1, w["c"] - 1): w["rank"] for w in case["ranks"]}
        pin = {(r, c): grid[r][c] for r in range(n) for c in range(n)}
        st = _solver(120).solve(build(n, box, truth, pin)[0])
        assert st in (cp_model.OPTIMAL, cp_model.FEASIBLE), (
            f"grid {i}: true ranks rejected"
        )
        w0, r0 = next(iter(truth.items()))
        # A different rank that the leading-digit bound still allows, so the
        # rejection comes from the counting and not the redundant constraint.
        same = [
            r
            for r in range(1, (n - 1) ** 2 + 1)
            if r != r0 and allowed_top_left(n, r) == allowed_top_left(n, r0)
        ]
        bad = dict(truth)
        bad[w0] = same[0] if same else (r0 % (n - 1) ** 2) + 1
        assert _solver(120).solve(build(n, box, bad, pin)[0]) == cp_model.INFEASIBLE, (
            f"grid {i}: wrong rank accepted"
        )
    print(
        f"selfcheck ok: {len(data['grids'])} grids, model ranks match the oracle on all {(n - 1) ** 2} windows"
    )


if __name__ == "__main__":
    sys.exit(_selfcheck())
