"""Rebuild lineup.html from the repo's found grids: DATA line spliced into lineup_template.html."""
import json, glob, os
Z = os.path.dirname(os.path.abspath(__file__))
F = "/home/caneff/orca/workspaces/sudokumaker-custom-constraints/tang/docs/research/zombo-brainanas/found"
ARM = {"bal36": "balance ≥36", "box9": "box 9", "box9_cross": "box 9 + reach", "box9_spread": "box 9 + spread",
       "dist25": "distance 25", "probe": "probe", "spread": "spread", "want2a": "two pockets", "want2b": "two pockets", "want3": "three pockets", "tpl720": "template: 720 opener"}
N = range(9); box = lambda r, c: (r // 3) * 3 + c // 3 + 1
def comps(inf, val):
    seen, out = set(), []
    for r in N:
        for c in N:
            if inf[r][c] == val and (r, c) not in seen:
                st, cur = [(r, c)], []
                seen.add((r, c))
                while st:
                    a, b = st.pop(); cur.append((a, b))
                    for q in ((a+1,b),(a-1,b),(a,b+1),(a,b-1)):
                        if 0 <= q[0] < 9 and 0 <= q[1] < 9 and inf[q[0]][q[1]] == val and q not in seen:
                            seen.add(q); st.append(q)
                out.append(cur)
    return out
rows = []
for f in sorted(glob.glob(F + "/*.json")):
    d = json.load(open(f)); name = os.path.basename(f)[:-5]
    arm, seed = name.rsplit("_", 1)
    if name.startswith("pair_"):  # pair_r7c7_r7c8 -> one arm, seed = the pair
        arm, seed = "pair", name[5:].replace("_", "+")
    grid, inf = d["grid"], [[ch == "*" for ch in row] for row in d["infected"]]
    circles, pockets = [], []
    for val in (True, False):
        for comp in comps(inf, val):
            hits = [p for p in comp if int(grid[p[0]][p[1]]) == len(comp)]
            circles += hits
            if not val and hits: pockets.append(len(comp))
    circles.sort()
    dots = []
    for r in N:
        for c in N:
            for a, b in ((r+1, c), (r, c+1)):
                if a < 9 and b < 9 and not inf[r][c] and not inf[a][b] and abs(int(grid[r][c]) - int(grid[a][b])) == 1:
                    dots.append([r, c, a, b])
    cross = sum(1 for r in N for c in N for a, b in ((r+1, c), (r, c+1)) if a < 9 and b < 9 and inf[r][c] and inf[a][b] and box(r, c) != box(a, b))
    rows.append(dict(id=name, arm=ARM.get(arm, arm), seed=seed, grid=grid, inf=d["infected"], circles=[list(p) for p in circles],
                     pockets=sorted(pockets), circ=len(circles), infected=sum(map(sum, inf)), dots=len(dots), dotEdges=dots, cross=cross,
                     box9=sum(1 for p in circles if box(*p) == 9)))
t = open(Z + "/lineup_template.html").read()
out = t.replace("const DATA=[];\n", "const DATA=" + json.dumps(rows, separators=(",", ":"), ensure_ascii=False) + ";\n", 1)
open(Z + "/lineup.html", "w").write(out); print(len(rows), "grids")
