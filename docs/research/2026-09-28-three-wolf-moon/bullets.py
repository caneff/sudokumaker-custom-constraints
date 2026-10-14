"""Single-bullet consequence search for Three Wolf Moon.

For each diagonal of length 2-9 and each feasible bullet sum, find every
(cell, digit) the bullet alone rules out beyond the rules' own 63 bans.
Method: repeated solves, each forcing at least one not-yet-seen x literal true;
INFEASIBLE ends the cover, and the unseen literals are exactly the eliminations.
Appends one JSON line per (diagonal, sum) to the output file; skips done ones.

    uv run docs/research/2026-09-28-three-wolf-moon/bullets.py OUT.jsonl
"""
import json, os, sys, time
from ortools.sat.python import cp_model

R = range(9)
box = lambda r, c: 3 * (r // 3) + c // 3
LIMIT = 60


def diagonals():
    out = []
    for d in range(-7, 8):  # \ : r - c = d
        out.append(("\\", d, [(r, r - d) for r in R if 0 <= r - d < 9]))
    for s in range(1, 16):  # / : r + c = s
        out.append(("/", s, [(r, s - r) for r in R if 0 <= s - r < 9]))
    return sorted(out, key=lambda t: len(t[2]))  # short first: partial runs stay useful


def base():
    m = cp_model.CpModel()
    x = {(r, c, d): m.NewBoolVar("") for r in R for c in R for d in R}
    for a in R:
        for d in R:
            m.AddExactlyOne(x[a, c, d] for c in R)
            m.AddExactlyOne(x[r, a, d] for r in R)
            m.AddExactlyOne(x[r, c, d] for r in R for c in R if box(r, c) == a)
        for b in R:
            m.AddExactlyOne(x[a, b, d] for d in R)
    for a in R:
        m.AddExactlyOne(x[a, c, box(a, c)] for c in R)
        m.AddExactlyOne(x[r, a, box(r, a)] for r in R)
        m.AddExactlyOne(x[r, a, r] for r in R)
        m.AddExactlyOne(x[r, c, r] for r in R for c in R if box(r, c) == a)
        m.AddExactlyOne(x[a, c, c] for c in R)
        m.AddExactlyOne(x[r, c, c] for r in R for c in R if box(r, c) == a)
    for r in R:
        for c in R:
            for d in R:
                if [box(r, c), r, c].count(d) >= 2: m.Add(x[r, c, d] == 0)
    # values: per set a permutation of 1..9 with no fixed point (index = digit-1)
    val = {}
    for S in "BRC":
        v = [m.NewIntVar(1, 9, "") for _ in R]
        m.AddAllDifferent(v)
        for k in R: m.Add(v[k] != k + 1)
        val[S] = v
    w = {}
    for r in R:
        for c in R:
            wc = m.NewIntVar(0, 9, "")
            lits = {("B", box(r, c)), ("R", r), ("C", c)}
            for S, k in lits:
                m.Add(wc == val[S][k]).OnlyEnforceIf(x[r, c, k])
            m.Add(wc == 0).OnlyEnforceIf([x[r, c, k].Not() for _, k in lits])
            w[r, c] = wc
    return m, x, w


def solver():
    s = cp_model.CpSolver(); s.parameters.num_workers = 1; s.parameters.max_time_in_seconds = LIMIT
    return s


def cover(cells, total, baseline):
    m, x, w = base()
    m.Add(sum(w[p] for p in cells) == total)
    seen, solves = set(), 0
    while True:
        unseen = [k for k in baseline if k not in seen]
        if not unseen: return seen, solves, "done"
        m.AddBoolOr([x[k] for k in unseen])
        s = solver(); st = s.Solve(m); solves += 1
        name = s.StatusName(st)
        if name == "INFEASIBLE": return seen, solves, "done"
        if name not in ("OPTIMAL", "FEASIBLE"): return seen, solves, name
        seen |= {k for k in unseen if s.Value(x[k])} | {k for k in baseline if s.Value(x[k])}


if __name__ == "__main__":
    out = sys.argv[1]
    done = set()
    if os.path.exists(out):
        for line in open(out): j = json.loads(line); done.add((j["dir"], j["idx"], j["sum"]))
    t0 = time.time()
    # baseline feasible literals (rules only): 729 minus the 63 known bans
    bans = {tuple(v - 1 for v in b[:3]) for b in json.load(open("docs/research/2026-09-28-three-wolf-moon/truths.json"))["impossible_cell_digits"]}
    baseline = [(r, c, d) for r in R for c in R for d in R if (r, c, d) not in bans]
    assert len(baseline) == 666, len(baseline)
    for dr, idx, cells in diagonals():
        for total in range(0, 9 * len(cells) + 1):
            if (dr, idx, total) in done: continue
            m, x, w = base(); m.Add(sum(w[p] for p in cells) == total)
            s = solver(); st = s.StatusName(s.Solve(m))
            if st == "INFEASIBLE":
                rec = {"dir": dr, "idx": idx, "sum": total, "status": "infeasible"}
            elif st not in ("OPTIMAL", "FEASIBLE"):
                rec = {"dir": dr, "idx": idx, "sum": total, "status": st}
            else:
                seen, n, status = cover(cells, total, baseline)
                elim = sorted(set(baseline) - seen) if status == "done" else None
                on = set(cells)
                rec = {"dir": dr, "idx": idx, "sum": total, "status": status, "solves": n,
                       "elim": elim, "elim_off": None if elim is None else [e for e in elim if (e[0], e[1]) not in on]}
            with open(out, "a") as f: f.write(json.dumps(rec) + "\n")
            print(f"{time.time()-t0:7.1f}s {dr}{idx} sum={total} {rec['status']}"
                  f" elim={len(rec.get('elim') or [])} off={len(rec.get('elim_off') or [])}", flush=True)
