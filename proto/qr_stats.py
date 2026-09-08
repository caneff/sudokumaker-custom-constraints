"""CP-SAT search statistics as a difficulty metric candidate (#328)."""

import json
import sys
import time
from pathlib import Path

from ortools.sat.python import cp_model

from qr_cpsat import build

BOX = (3, 3)


def stats(n, clues, givens, grid=None, seconds=120.0):
    """Full solve from scratch (grid=None) or the uniqueness proof (grid given)."""
    m, x = build(n, BOX, clues, givens)
    if grid is not None:
        diffs = []
        for r in range(n):
            for c in range(n):
                if (r, c) in givens:
                    continue
                b = m.new_bool_var(f"d{r}_{c}")
                m.add(x[r, c] != grid[r][c]).only_enforce_if(b)
                diffs.append(b)
        m.add_bool_or(diffs)
    s = cp_model.CpSolver()
    s.parameters.max_time_in_seconds = seconds
    s.parameters.interleave_search = True
    # One worker: multi-worker branch counts are the sum over portfolios and
    # move around run to run, which makes them useless as a search signal.
    s.parameters.num_workers = 1
    t = time.perf_counter()
    st = s.solve(m)
    return {
        "status": s.status_name(st),
        "branches": s.num_branches,
        "conflicts": s.num_conflicts,
        "wall": time.perf_counter() - t,
        "elapsed": round(time.perf_counter() - t, 3),
    }


if __name__ == "__main__":
    for path in sys.argv[1:]:
        p = json.loads(Path(path).read_text())
        n = len(p["grid"])
        clues = {(r, c): k for r, c, k in p["clues"]}
        givens = {(r, c): p["grid"][r][c] for r, c in p["givens"]}
        solve = stats(n, clues, givens)
        proof = stats(n, clues, givens, p["grid"])
        print(f"{Path(path).stem}: {len(clues)} clues, {len(givens)} givens")
        print(
            f"  solve  {solve['status']:>10}  branches {solve['branches']:>8}  "
            f"conflicts {solve['conflicts']:>7}  {solve['elapsed']:>7.3f}s"
        )
        print(
            f"  proof  {proof['status']:>10}  branches {proof['branches']:>8}  "
            f"conflicts {proof['conflicts']:>7}  {proof['elapsed']:>7.3f}s"
        )
