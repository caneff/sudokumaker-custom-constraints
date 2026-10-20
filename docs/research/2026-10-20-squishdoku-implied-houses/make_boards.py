"""Generate minimal unique squishdokus and put each on three templates.

bare = boxes + rows/columns only; old = the catalog template; new = template.json.
Givens are removed greedily while CP-SAT still finds exactly one solution.

  uv run python make_boards.py original.json template.json outdir 30
"""

import copy
import json
import random
import sys
from pathlib import Path

from implied_houses import GROUPS, N
from ortools.sat.python import cp_model


def solve(givens, avoid=None, seed=0):
    m = cp_model.CpModel()
    x = [m.NewIntVar(1, 9, f"x{i}") for i in range(N * N)]
    for g in GROUPS:
        m.AddAllDifferent([x[i] for i in g])
    for i, v in givens.items():
        m.Add(x[i] == v)
    if avoid:
        diff = [m.NewBoolVar("") for _ in avoid]
        for b, (i, v) in zip(diff, avoid.items(), strict=True):
            m.Add(x[i] != v).OnlyEnforceIf(b)
        m.AddBoolOr(diff)
    s = cp_model.CpSolver()
    s.parameters.num_workers = 1
    s.parameters.random_seed = seed
    s.parameters.randomize_search = True
    return (
        [s.Value(v) for v in x]
        if s.Solve(m) in (cp_model.OPTIMAL, cp_model.FEASIBLE)
        else None
    )


def main(old_path, new_path, outdir, count):
    old = json.loads(Path(old_path).read_text())
    new = json.loads(Path(new_path).read_text())
    bare = copy.deepcopy(old)
    bare["puzzle"]["constraints"] = [
        c for c in old["puzzle"]["constraints"] if c["type"] != 1000
    ]
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    for k in range(count):
        rng = random.Random(k)
        grid = solve({}, seed=k + 100)
        givens = {i: grid[i] for i in range(N * N)}
        for i in rng.sample(range(N * N), N * N):
            trial = {a: b for a, b in givens.items() if a != i}
            if solve(trial, avoid=dict(enumerate(grid))) is None:
                givens = trial
        for tag, doc in (("bare", bare), ("old", old), ("new", new)):
            d = copy.deepcopy(doc)
            for i, v in givens.items():
                d["puzzle"]["cells"][i] = {"value": v, "given": True}
            (out / f"p{k:02d}_{tag}.json").write_text(json.dumps(d))


if __name__ == "__main__":
    main(*sys.argv[1:4], int(sys.argv[4]))
