"""Oracle sweep of inherent truths: which (cell,digit) and band/stack patterns are feasible."""
import itertools, json, sys
sys.path.insert(0, "docs/research/2026-09-28-three-wolf-moon")
from solve import bool_model, box, R
from ortools.sat.python import cp_model


def feasible(extra):
    m, read = bool_model()
    x = {v.Name(): v for v in []}
    # rebuild access to x via names
    vars_ = {tuple(int(ch) for ch in p.name[1:]): p for p in [m.GetBoolVarFromProtoIndex(i) for i in range(729)]}
    extra(m, vars_)
    s = cp_model.CpSolver(); s.parameters.num_workers = 1; s.parameters.max_time_in_seconds = 30
    st = s.Solve(m)
    return s.StatusName(st)

out = {}
# 1. every (cell, digit): feasible?
imp = []
for r in R:
    for c in R:
        for d in R:
            st = feasible(lambda m, x: m.Add(x[r, c, d] == 1))
            if st != "OPTIMAL": imp.append((r+1, c+1, d+1, st))
out["impossible_cell_digits"] = imp

# 2. band: box-set row map pi and row-set box map rho per band, all 4 combos
def band_combo(b, pi, rho):
    def f(m, x):
        for i in range(3):
            k = 3*b + i  # box index / row index, 0-based
            # box-set: digit k in box k sits in row 3b+pi[i]
            m.Add(sum(x[3*b+pi[i], c, k] for c in R if box(3*b+pi[i], c) == k) == 1)
            # row-set: digit k in row k sits in box 3b+rho[i]
            m.Add(sum(x[k, c, k] for c in R if box(k, c) == 3*b+rho[i]) == 1)
    return f
cyc, inv = (1, 2, 0), (2, 0, 1)
out["band_combos"] = {f"band{b+1} pi={'cyc' if p==cyc else 'inv'} rho={'cyc' if q==cyc else 'inv'}": feasible(band_combo(b, p, q))
                      for b in range(3) for p in (cyc, inv) for q in (cyc, inv)}

# 3. stack: box-set column map and column-set box map, enumerate all 3!x3! per stack
stack = {}
for s_ in range(3):
    ok = []
    for cp in itertools.permutations(range(3)):
        for bp in itertools.permutations(range(3)):
            def f(m, x, cp=cp, bp=bp):
                for i in range(3):
                    k = 3*i + s_  # box in band i, stack s_
                    col = 3*s_ + cp[i]
                    m.Add(sum(x[r, col, k] for r in R if box(r, col) == k) == 1)
                    cc = 3*s_ + i  # column cc holds digit cc in box (band bp[i], stack s_)
                    m.Add(sum(x[r, cc, cc] for r in R if box(r, cc) == 3*bp[i] + s_) == 1)
            if feasible(f) == "OPTIMAL": ok.append([cp, bp])
    stack[f"stack{s_+1}"] = {"feasible": len(ok), "of": 36, "list": ok}
out["stack_combos"] = stack
json.dump(out, open("docs/research/2026-09-28-three-wolf-moon/truths.json", "w"), indent=1)
print("impossible cell-digits:", len(imp))
for t in imp: print(" r%dc%d=%d %s" % t)
for k, v in out["band_combos"].items(): print(k, v)
for k, v in stack.items(): print(k, v["feasible"], "of 36")
