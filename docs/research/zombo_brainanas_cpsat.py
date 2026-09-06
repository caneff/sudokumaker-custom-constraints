"""Zombo Brainanas (Infections + Choco Banana) — CP-SAT generator prototype.

    uv run --with ortools docs/research/zombo_brainanas_cpsat.py sample 3
    uv run --with ortools docs/research/zombo_brainanas_cpsat.py gen 3 out.json
    uv run --with ortools docs/research/zombo_brainanas_cpsat.py verify out.json

Rules (map #342): normal 9x9 sudoku. Patient zero = digit equal to its box
number, exactly one per row and column, infected. Infected cells infect every
orthogonally adjacent smaller digit, to closure. Zombo: every connected
infected group is a rectangle. Brainana: every connected uninfected group is
not. Cluster: a circled digit equals the size of its own group.

Modelling. Digits, infection and closure are exact. Zombo is exact through
the lemma "connected + no 2x2 window with exactly three infected cells <=>
rectangle". Brainana and an uninfected circle are enforced lazily: solve,
check the solution, and when an uninfected component is a rectangle (or a
circled pocket has the wrong size) add a cut that forbids exactly that
component pattern (its cells uninfected, its orthogonal border infected), then
re-solve. Every cut excludes only invalid solutions, so uniqueness proofs are
exact. An infected circle is exact: some rectangle of area == digit around the
circle is the component.

# ponytail: research prototype — the shipped generator is a wayfinder decision.
"""

import json
import random
import sys
from pathlib import Path

from ortools.sat.python import cp_model as cp

N = 9
CELLS = [(r, c) for r in range(N) for c in range(N)]


def box(r, c):
    return (r // 3) * 3 + c // 3 + 1


def nb(p):
    r, c = p
    for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        q = (r + dr, c + dc)
        if 0 <= q[0] < N and 0 <= q[1] < N:
            yield q


def rects():
    """Every axis-aligned rectangle of area <= 9 as (cells, border)."""
    out = []
    for h in range(1, 10):
        for w in range(1, 10):
            if h * w > 9:
                continue
            for r in range(N - h + 1):
                for c in range(N - w + 1):
                    cells = frozenset(
                        (r + i, c + j) for i in range(h) for j in range(w)
                    )
                    border = frozenset(q for p in cells for q in nb(p)) - cells
                    out.append((cells, border))
    return out


RECTS = rects()


def build(givens=None, circles=None, cuts=(), maximize_clues=False, seed=0):
    """The model. givens {cell: digit}; circles {cell: digit or None}."""
    m = cp.CpModel()
    x = {p: m.NewIntVar(1, 9, f"x{p}") for p in CELLS}
    inf = {p: m.NewBoolVar(f"i{p}") for p in CELLS}
    pz = {p: m.NewBoolVar(f"z{p}") for p in CELLS}
    for r in range(N):
        m.AddAllDifferent([x[r, c] for c in range(N)])
        m.AddAllDifferent([x[c, r] for c in range(N)])
    for b in range(3):
        for bb in range(3):
            m.AddAllDifferent(
                [
                    x[r, c]
                    for r in range(3 * b, 3 * b + 3)
                    for c in range(3 * bb, 3 * bb + 3)
                ]
            )
    for p in CELLS:
        m.Add(x[p] == box(*p)).OnlyEnforceIf(pz[p])
        m.Add(x[p] != box(*p)).OnlyEnforceIf(pz[p].Not())
        m.AddImplication(pz[p], inf[p])
    for r in range(N):
        m.AddExactlyOne(pz[r, c] for c in range(N))
        m.AddExactlyOne(pz[c, r] for c in range(N))
    # Spread and closure. lt[p,q]: x[p] < x[q].
    for p in CELLS:
        srcs = []
        for q in nb(p):
            lt = m.NewBoolVar("")
            m.Add(x[p] < x[q]).OnlyEnforceIf(lt)
            m.Add(x[p] > x[q]).OnlyEnforceIf(lt.Not())
            m.AddBoolOr([inf[q].Not(), lt.Not(), inf[p]])  # spread
            s = m.NewBoolVar("")
            m.AddBoolAnd([inf[q], lt]).OnlyEnforceIf(s)
            m.AddBoolOr([inf[q].Not(), lt.Not()]).OnlyEnforceIf(s.Not())
            srcs.append(s)
        m.AddBoolOr([*srcs, pz[p], inf[p].Not()])  # closure: infected needs a source
    # Zombo: no 2x2 window with exactly three infected.
    for r in range(N - 1):
        for c in range(N - 1):
            m.Add(
                sum([inf[r, c], inf[r + 1, c], inf[r, c + 1], inf[r + 1, c + 1]]) != 3
            )
    # Brainana, cheap exact part: no isolated uninfected cell.
    for p in CELLS:
        m.AddBoolOr([inf[p]] + [inf[q].Not() for q in nb(p)])
    for p, v in (givens or {}).items():
        m.Add(x[p] == v)
    for p, v in (circles or {}).items():
        if v is not None:
            m.Add(x[p] == v)
        # infected circle: some rectangle of area == digit around p is its component
        opts = []
        for cells, border in RECTS:
            if p not in cells:
                continue
            comp = m.NewBoolVar("")
            m.AddBoolAnd(
                [inf[q] for q in cells] + [inf[q].Not() for q in border]
            ).OnlyEnforceIf(comp)
            m.Add(x[p] == len(cells)).OnlyEnforceIf(comp)
            opts.append(comp)
        m.AddBoolOr([*opts, inf[p].Not()])
    for uninf_cells, inf_cells in cuts:
        m.AddBoolOr([inf[q] for q in uninf_cells] + [inf[q].Not() for q in inf_cells])
    if maximize_clues:
        # A sampled grid is only settable if enough cells can carry a circle:
        # infected cells whose digit equals the area of their rectangle.
        clue = {p: [] for p in CELLS}
        for cells, border in RECTS:
            comp = m.NewBoolVar("")
            m.AddBoolAnd(
                [inf[q] for q in cells] + [inf[q].Not() for q in border]
            ).OnlyEnforceIf(comp)
            for p in cells:
                hit = m.NewBoolVar("")
                m.AddBoolAnd([comp]).OnlyEnforceIf(hit)
                m.Add(x[p] == len(cells)).OnlyEnforceIf(hit)
                clue[p].append(hit)
        # Small random per-cell weights break ties so seeds give different grids.
        rng = random.Random(seed)
        noise = sum(rng.randint(0, 3) * x[p] for p in CELLS)
        m.Maximize(1000 * sum(h for hs in clue.values() for h in hs) + noise)
    return m, x, inf


def comps(shade, val):
    seen, out = set(), []
    for p in CELLS:
        if shade[p] == val and p not in seen:
            st, cur = [p], []
            seen.add(p)
            while st:
                a = st.pop()
                cur.append(a)
                for q in nb(a):
                    if shade[q] == val and q not in seen:
                        seen.add(q)
                        st.append(q)
            out.append(frozenset(cur))
    return out


def isrect(cells):
    rs = [r for r, _ in cells]
    cs = [c for _, c in cells]
    return len(cells) == (max(rs) - min(rs) + 1) * (max(cs) - min(cs) + 1)


def violation(sol, shade, circles):
    """A cut (uninf cells, inf cells) for the first lazy rule this solution breaks, else None."""
    for comp in comps(shade, 0):
        border = frozenset(q for p in comp for q in nb(p)) - comp
        if isrect(comp):
            return (comp, border)
        for p in comp:
            if p in circles and sol[p] != len(comp):
                return (comp, border)
    for comp in comps(shade, 1):
        assert isrect(comp), "zombo lemma broken"
    return None


def solve_valid(
    givens=None,
    circles=None,
    cuts=None,
    exclude=(),
    seed=0,
    maximize_clues=False,
    limit=120,
):
    """A valid solution (sol, shade) or None. `exclude`: solutions to forbid. Grows `cuts` in place."""
    cuts = cuts if cuts is not None else []
    circles = circles or {}
    while True:
        m, x, inf = build(givens, circles, cuts, maximize_clues, seed)
        for sol in exclude:  # not all cells equal
            diffs = []
            for p, v in sol.items():
                d = m.NewBoolVar("")
                m.Add(x[p] != v).OnlyEnforceIf(d)
                m.Add(x[p] == v).OnlyEnforceIf(d.Not())
                diffs.append(d)
            m.AddBoolOr(diffs)
        s = cp.CpSolver()
        s.parameters.random_seed = seed
        s.parameters.num_workers = 8
        s.parameters.max_time_in_seconds = limit
        st = s.Solve(m)
        if st not in (cp.OPTIMAL, cp.FEASIBLE):
            assert st == cp.INFEASIBLE, f"solver status {s.StatusName(st)}"
            return None
        sol = {p: s.Value(x[p]) for p in CELLS}
        shade = {p: s.Value(inf[p]) for p in CELLS}
        cut = violation(sol, shade, circles)
        if cut is None:
            return sol, shade
        cuts.append(cut)


def unique(givens, circles, cuts):
    """True iff exactly one valid solution."""
    first = solve_valid(givens, circles, cuts)
    assert first is not None, "no solution"
    return solve_valid(givens, circles, cuts, exclude=[first[0]]) is None


def show(sol, shade, givens=None, circles=None):
    rows = []
    for r in range(N):
        cells = []
        for c in range(N):
            p = (r, c)
            d = str(sol[p]) if givens is None or p in givens else "."
            if circles and p in circles:
                d = f"({sol[p]})" if givens is None or p in givens else "( )"
            cells.append(f"{d:>3}{'*' if shade[p] else ' '}")
        rows.append("".join(cells))
    return "\n".join(rows)


def sample(seed):
    """A random valid grid with many circle-able cells: 20 s of maximising."""
    return solve_valid(seed=seed, maximize_clues=True, limit=20)


def circle_candidates(sol, shade):
    """Cells whose digit equals the size of their own group."""
    out = {}
    for val in (0, 1):
        for comp in comps(shade, val):
            for p in comp:
                if sol[p] == len(comp):
                    out[p] = sol[p]
    return out


def generate(seed, log=print):
    rng = random.Random(seed)
    sol, shade = sample(seed)
    circles = circle_candidates(sol, shade)
    log(f"seed {seed}: {len(circles)} circle candidates")
    log(show(sol, shade, circles=circles))
    cuts = []
    givens = dict(sol)
    order = list(CELLS)
    rng.shuffle(order)
    for p in order:
        trial = {q: v for q, v in givens.items() if q != p}
        if unique(trial, circles, cuts):
            givens = trial
            log(f"drop {p}: {len(givens)} givens, {len(cuts)} cuts")
    # then try dropping circles
    for p in list(circles):
        trial = {q: v for q, v in circles.items() if q != p}
        if unique(givens, trial, cuts):
            circles = trial
            log(f"drop circle {p}: {len(circles)} circles")
    return sol, shade, givens, circles


def main():
    cmd = sys.argv[1]
    if cmd == "sample":
        for seed in range(int(sys.argv[2])):
            sol, shade = sample(seed)
            print(
                f"seed {seed}: infected comps {sorted(len(c) for c in comps(shade, 1))}"
            )
            print(show(sol, shade, circles=circle_candidates(sol, shade)))
    elif cmd == "gen":
        seed, out = int(sys.argv[2]), sys.argv[3]
        sol, shade, givens, circles = generate(seed)
        Path(out).write_text(
            json.dumps(
                {
                    "grid": [
                        "".join(str(sol[r, c]) for c in range(N)) for r in range(N)
                    ],
                    "infected": [
                        "".join("*" if shade[r, c] else "." for c in range(N))
                        for r in range(N)
                    ],
                    "givens": sorted(givens),
                    "circles": sorted(circles),
                },
                indent=1,
            )
        )
        print(show(sol, shade, givens, circles))
        print(f"{len(givens)} givens, {len(circles)} circles -> {out}")
    elif cmd == "verify":
        d = json.loads(Path(sys.argv[2]).read_text())
        sol = {(r, c): int(d["grid"][r][c]) for r, c in CELLS}
        givens = {tuple(p): sol[tuple(p)] for p in d["givens"]}
        circles = {tuple(p): sol[tuple(p)] for p in d["circles"]}
        print("unique" if unique(givens, circles, []) else "NOT unique")


if __name__ == "__main__":
    main()
