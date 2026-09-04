# The original Running Start generator: a 9x9 grid, every line clued, carved
# to minimal interior givens and then to a minimal shown-clue set, proved
# unique with OR-Tools. Superseded for new boards by build_size.py (which
# drives the shared framebuild machinery at any size); kept because the
# shipped 9x9 board came from here.
#
#   uv run --with ortools examples/running-start/generate.py OUT.json

import json
import random
import sys
from pathlib import Path


def base(r, c):
    return (3 * (r % 3) + r // 3 + c) % 9


def make_grid(rng):
    rows_ = [
        g * 3 + r for g in rng.sample(range(3), 3) for r in rng.sample(range(3), 3)
    ]
    cols_ = [
        g * 3 + c for g in rng.sample(range(3), 3) for c in rng.sample(range(3), 3)
    ]
    dig = rng.sample(range(1, 10), 9)
    return [[dig[base(rows_[r], cols_[c])] for c in range(9)] for r in range(9)]


lines = {}
for r in range(9):
    lines[("L", r)] = [(r, c) for c in range(9)]
    lines[("R", r)] = [(r, c) for c in range(8, -1, -1)]
for c in range(9):
    lines[("T", c)] = [(r, c) for r in range(9)]
    lines[("B", c)] = [(r, c) for r in range(8, -1, -1)]


def rs(v):
    n = 1
    for i in range(1, len(v)):
        if v[i] > v[i - 1]:
            n += 1
        else:
            break
    return n


def unique(clue, active, givens):
    # Imported here, not at module scope, so make_grid/rs/lines stay
    # importable without a solver. Same rule as framebuild.unique.
    from ortools.sat.python import cp_model

    m = cp_model.CpModel()
    x = {(r, c): m.NewIntVar(1, 9, f"x{r}{c}") for r in range(9) for c in range(9)}
    for i in range(9):
        m.AddAllDifferent([x[i, c] for c in range(9)])
        m.AddAllDifferent([x[r, i] for r in range(9)])
    for br in range(0, 9, 3):
        for bc in range(0, 9, 3):
            m.AddAllDifferent(
                [x[br + dr, bc + dc] for dr in range(3) for dc in range(3)]
            )
    for (r, c), v in givens.items():
        m.Add(x[r, c] == v)
    for k in active:
        cells = lines[k]
        kk = clue[k]
        for i in range(1, kk):
            m.Add(x[cells[i]] > x[cells[i - 1]])
        if kk < 9:
            m.Add(x[cells[kk]] < x[cells[kk - 1]])
    s = cp_model.CpSolver()
    s.parameters.max_time_in_seconds = 10
    s.parameters.num_workers = 8
    if s.Solve(m) not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None
    s1 = {(r, c): s.Value(x[r, c]) for r in range(9) for c in range(9)}
    lits = []
    for (r, c), v in s1.items():
        b = m.NewBoolVar(f"d{r}{c}")
        m.Add(x[r, c] != v).OnlyEnforceIf(b)
        m.Add(x[r, c] == v).OnlyEnforceIf(b.Not())
        lits.append(b)
    m.AddBoolOr(lits)
    s2 = cp_model.CpSolver()
    s2.parameters.max_time_in_seconds = 10
    s2.parameters.num_workers = 8
    return s2.Solve(m) not in (cp_model.OPTIMAL, cp_model.FEASIBLE)


def main(out):
    """Search seeds 101..112 for the board with the fewest interior givens,
    carve its clue set to a minimum, and write the board to `out`."""
    best = None
    for seed in range(101, 113):
        rng = random.Random(seed)
        grid = make_grid(rng)
        clue = {k: rs([grid[r][c] for (r, c) in cells]) for k, cells in lines.items()}
        active = set(lines.keys())  # keep ALL clues (rule load-bearing)
        givens = {}
        # add minimal interior givens until unique (with all clues)
        cells_all = [(r, c) for r in range(9) for c in range(9)]
        rng.shuffle(cells_all)
        if not unique(clue, active, givens):
            for cell in cells_all:
                givens[cell] = grid[cell[0]][cell[1]]
                if unique(clue, active, givens):
                    break
        # carve givens (all clues kept) to minimize
        for cell in list(givens.keys()):
            v = givens.pop(cell)
            if not unique(clue, active, givens):
                givens[cell] = v
        n = len(givens)
        print(f"seed {seed}: interior givens = {n}")
        if best is None or n < best[0]:
            best = (n, seed, grid, clue, dict(givens), set(active))

    n, seed, grid, clue, givens, active = best
    # light clue carve: drop clues that aren't needed given the (minimal) givens
    rng = random.Random(seed * 7)
    order = list(active)
    rng.shuffle(order)
    for k in order:
        active.discard(k)
        if not unique(clue, active, givens):
            active.add(k)
    assert unique(clue, active, givens) is True
    print(
        f"CHOSEN seed {seed}: interior givens={len(givens)}, clues kept={len(active)}"
    )
    with out.open("w") as f:
        json.dump(
            {
                "seed": seed,
                "grid": grid,
                "clue": {f"{s}{i}": clue[(s, i)] for (s, i) in clue},
                "active": [f"{s}{i}" for (s, i) in active],
                "givens": {f"{r},{c}": v for (r, c), v in givens.items()},
            },
            f,
        )
    print(f"wrote {out}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit("usage: generate.py OUT.json")
    main(Path(sys.argv[1]))
