"""Rank single bullets from bullets.jsonl by sum-specific, distant eliminations."""
import json, sys
sys.path.insert(0, "docs/research/2026-09-28-three-wolf-moon")
import bullets as b
box = lambda r, c: 3 * (r // 3) + c // 3
rs = [json.loads(l) for l in open("docs/research/2026-09-28-three-wolf-moon/bullets.jsonl")]
cells = {(d, i): c for d, i, c in b.diagonals()}
by = {}
for r in rs:
    by.setdefault((r["dir"], r["idx"]), []).append(r)
rows = []
for k, v in by.items():
    feas = sorted(r["sum"] for r in v if r["status"] == "done")
    lo, hi = feas[0], feas[-1]
    nz = [set(map(tuple, r["elim"])) for r in v if r["status"] == "done" and r["sum"] > 0]
    common = set.intersection(*nz)  # = eliminations of "sum >= 1" (union of feasible sets)
    boxes = {box(*p) for p in cells[k]}
    top3 = set(feas[-3:])
    for r in v:
        if r["status"] != "done" or r["sum"] == 0 or r["sum"] in top3: continue
        spec = set(map(tuple, r["elim"])) - common
        distant = [e for e in spec if box(e[0], e[1]) not in boxes]
        rows.append((len(distant), len(spec), k, r["sum"], lo, hi, sorted(distant)))
rows.sort(key=lambda t: (-t[0], -t[1]))
name = lambda k: f"{k[0]}{k[1]} " + "-".join(f"r{r+1}c{c+1}" for r, c in (cells[k][0], cells[k][-1]))
print("diagonals ranked; sums 0 and each diagonal's top 3 excluded")
for d, s, k, sm, lo, hi, dl in rows[:15]:
    print(f"{name(k):22} len{len(cells[k])} sum={sm:2} (feasible {lo}-{hi})  sum-specific={s:3} distant={d:3}")
print()
for d, s, k, sm, lo, hi, dl in rows[:3]:
    print(name(k), "sum", sm, "distant:", " ".join(f"r{r+1}c{c+1}≠{v+1}" for r, c, v in dl[:40]))
json.dump([{"diag": name(k), "sum": sm, "specific": s, "distant": d} for d, s, k, sm, lo, hi, dl in rows],
          open("docs/research/2026-09-28-three-wolf-moon/rank.json", "w"), indent=0)
