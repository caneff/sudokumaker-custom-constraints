"""Adversarial resampling for the offline board hunt (#317).

The hill-climb mutates a board by freeing a few cells and asking CP-SAT for a
DIFFERENT filling of them, with the rest of the grid pinned. The model is
generate.py's -- the same rule, one home -- plus one clause forbidding the
grid it started from, so a "mutation" always mutates.

    echo '{"grid": [[...]], "cap": 12, "freed": [[0,0],[0,1]], "seed": 7}' \
        | uv run --with ortools examples/fillomino/hunt_resample.py

Prints {"grid": [[...]]} or {"grid": null} when no different filling exists.
"""

import json
import sys
from pathlib import Path

from ortools.sat.python import cp_model

sys.path.insert(0, str(Path(__file__).parent))
import generate


def resample(grid, freed, seed, cap=None, limit=60):
    """A grid matching `grid` outside `freed` and differing somewhere inside it.

    Returns None when the pinned rest admits no other filling. Raises
    TimeoutError on a solve that hits `limit` seconds -- a timeout is not a
    "no other filling" answer.
    """
    generate.set_board(len(grid), cap)
    free = {tuple(p) for p in freed}
    givens = {p: grid[p[0]][p[1]] for p in generate.CELLS if p not in free}
    m, x = generate.model(givens)

    # Differ somewhere in the freed cells: otherwise the solver hands back the
    # grid we started from, which is no mutation at all.
    diff = []
    for p in free:
        b = m.NewBoolVar(f"m{p}")
        m.Add(x[p] != grid[p[0]][p[1]]).OnlyEnforceIf(b)
        m.Add(x[p] == grid[p[0]][p[1]]).OnlyEnforceIf(b.Not())
        diff.append(b)
    if not diff:
        return None
    m.AddBoolOr(diff)

    s = cp_model.CpSolver()
    s.parameters.max_time_in_seconds = limit
    s.parameters.random_seed = seed % (2**31 - 1)
    s.parameters.randomize_search = True
    s.parameters.num_workers = 8
    status = s.Solve(m)
    if status == cp_model.UNKNOWN:
        raise TimeoutError(f"CP-SAT hit the {limit}s limit; no verdict")
    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None
    return generate._rows(s, x)


if __name__ == "__main__":
    req = json.load(sys.stdin)
    try:
        grid = resample(
            req["grid"], req["freed"], req["seed"], req.get("cap"), req.get("limit", 60)
        )
    except TimeoutError as e:
        print(json.dumps({"grid": None, "timeout": str(e)}))
    else:
        print(json.dumps({"grid": grid}))
