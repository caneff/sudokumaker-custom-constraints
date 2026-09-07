"""Optimal grid per box-9 pair kind: fix the pair's shading, both circles open,
maximize circles. usage: pairopt.py shard nshards [limit] [stall]  -> hunt/pairopt/full_<pair>_<kind>.json"""
import sys, time, os, glob, json, re
sys.path.insert(0, "/home/caneff/orca/workspaces/sudokumaker-custom-constraints/tang/docs/research")
import zombo_brainanas_cpsat as zb
Z = os.path.dirname(os.path.abspath(__file__)) + "/"
OUT = Z + "hunt/pairopt/"; os.makedirs(OUT, exist_ok=True)
FOUND = "/home/caneff/orca/workspaces/sudokumaker-custom-constraints/tang/docs/research/zombo-brainanas/found/*.json"
shard, n = int(sys.argv[1]), int(sys.argv[2])
limit = int(sys.argv[3]) if len(sys.argv) > 3 else 400
stall = int(sys.argv[4]) if len(sys.argv) > 4 else 90
zb.BIG_POCKET_CELLS = frozenset(p for p in zb.CELLS if zb.box(*p) == 9)
kinds = []  # (pair name, cell a, cell b, shading dict)
for line in open(Z + "kinds2.log").read().splitlines() + open(Z + "kinds.log").read().splitlines():
    m = re.match(r"(r\dc\d)\+(r\dc\d) (II|IU|UI|UU): feasible", line)
    if not m or (7, 7) in ((int(m[1][1])-1, int(m[1][3])-1), (int(m[2][1])-1, int(m[2][3])-1)): continue  # no r8c8 circles
    a = tuple(int(x) - 1 for x in re.findall(r"\d", m[1])); b = tuple(int(x) - 1 for x in re.findall(r"\d", m[2]))
    k = m[3]; kinds.append((f"{m[1]}_{m[2]}_{k}", a, b, {a: int(k[0] == "I"), b: int(k[1] == "I")}))
kinds.sort()
def seen():
    g = {}
    for f in glob.glob(FOUND):
        d = json.load(open(f)); g["".join(d["infected"])] = {p: int(d["infected"][p[0]][p[1]] == "*") for p in zb.CELLS}
    return list(g.values())
def log(line): open(OUT + "PROGRESS.md", "a").write(line + "\n")
for i, (name, a, b, sh) in enumerate(kinds):
    if i % n != shard: continue
    if os.path.exists(OUT + f"full_{name}.json"): continue
    t = time.time(); log(f"{name}: start")
    found = zb.solve_valid(circles={a: None, b: None}, seed=i, limit=limit, min_pockets=1, objective=True,
                           avoid=seen(), min_distance=12, log=log, stall=stall, stop_at=13, fix_shade=sh)
    if found is None:
        log(f"{name}: no grid within {limit}s"); continue
    sol, shade = found; circ = zb.circle_candidates(sol, shade)
    zb.dump(OUT + f"full_{name}.json", sol, shade, dict(sol), circ)
    log(f"{name}: {len(circ)} circles, {len(zb.clued_bananas(sol, shade, circ))} clued bananas, {sum(shade.values())} infected ({time.time()-t:.0f}s)")
log(f"SHARD {shard} DONE")
