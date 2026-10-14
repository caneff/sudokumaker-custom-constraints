"""Enumerate feasible positions of digits 1,2,3 in box 1, and test the band-1 link."""
import itertools, sys
sys.path.insert(0, "docs/research/2026-09-28-three-wolf-moon")
from solve import bool_model
from ortools.sat.python import cp_model

cells = [(r, c) for r in range(3) for c in range(3)]
def run(extra):
    m, _ = bool_model()
    x = {tuple(int(ch) for ch in v.name[1:]): v for v in (m.GetBoolVarFromProtoIndex(i) for i in range(729))}
    extra(m, x)
    s = cp_model.CpSolver(); s.parameters.num_workers = 1; s.parameters.max_time_in_seconds = 30
    return s.StatusName(s.Solve(m))

ok = []
for p1, p2, p3 in itertools.permutations(cells, 3):
    st = run(lambda m, x: [m.Add(x[p[0], p[1], d] == 1) for p, d in ((p1, 0), (p2, 1), (p3, 2))])
    assert st in ("OPTIMAL", "INFEASIBLE"), st
    if st == "OPTIMAL": ok.append((p1, p2, p3))
print("feasible arrangements of 1,2,3 in box 1:", len(ok), "of 504")
for a in ok: print("  1@r%dc%d 2@r%dc%d 3@r%dc%d" % tuple(v + 1 for p in a for v in p))
# link: "2 of row 2 is in box 1"  must equal  "3 of box 3 is in row 2"? test both mismatches
def two_in_b1(m, x, val): m.Add(sum(x[1, c, 1] for c in range(3)) == val)
def one_row1_box3(m, x, val): m.Add(sum(x[0, c, 0] for c in range(6, 9)) == val)
for a, b in ((1, 0), (0, 1), (1, 1), (0, 0)):
    print(f"2-of-row2 in box1={a}, 1-of-row1 in box3={b}:",
          run(lambda m, x: (two_in_b1(m, x, a), one_row1_box3(m, x, b))))
