"""Independent checker: plain loops over a 1-based grid, no solver code shared."""
import json, sys


def check(g):
    errs = []
    full = set(range(1, 10))
    for i in range(9):
        if set(g[i]) != full: errs.append(f"row {i+1}")
        if {g[r][i] for r in range(9)} != full: errs.append(f"col {i+1}")
        br, bc = 3 * (i // 3), 3 * (i % 3)
        if {g[br + a][bc + b] for a in range(3) for b in range(3)} != full: errs.append(f"box {i+1}")
    boxno = lambda r, c: 3 * (r // 3) + c // 3 + 1
    sets = {
        "box": [(r, c) for r in range(9) for c in range(9) if g[r][c] == boxno(r, c)],
        "row": [(r, c) for r in range(9) for c in range(9) if g[r][c] == r + 1],
        "col": [(r, c) for r in range(9) for c in range(9) if g[r][c] == c + 1],
    }
    for name, cells in sets.items():
        if len(cells) != 9: errs.append(f"{name} set has {len(cells)} cells")
        for proj, lab in ((lambda p: p[0], "rows"), (lambda p: p[1], "cols"), (lambda p: boxno(*p), "boxes")):
            if len({proj(p) for p in cells}) != 9: errs.append(f"{name} set repeats {lab}")
        if sorted(g[r][c] for r, c in cells) != list(range(1, 10)): errs.append(f"{name} set digits")
        vals = [g[r][c] % 9 + 1 for r, c in cells]  # value = digit+1 mod 9
        if sorted(vals) != list(range(1, 10)): errs.append(f"{name} values not a permutation")
        if any(v == g[r][c] for v, (r, c) in zip(vals, cells)): errs.append(f"{name} value fixed point")
    allc = sets["box"] + sets["row"] + sets["col"]
    if len(set(allc)) != 27: errs.append(f"overlap: {27 - len(set(allc))} shared cells")
    return errs, sets


if __name__ == "__main__":
    res = json.load(open(sys.argv[1]))
    for label, r in res.items():
        if r["grid"] is None:
            print(label, "no grid", r["status"]); continue
        errs, sets = check(r["grid"])
        print(label, "PASS" if not errs else errs)
    # control: the checker must reject a mutated grid
    g = [row[:] for row in next(r["grid"] for r in res.values() if r["grid"])]
    g[0][0], g[0][1] = g[0][1], g[0][0]
    print("control (swapped r1c1/r1c2):", "REJECTED" if check(g)[0] else "WRONGLY PASSED")
