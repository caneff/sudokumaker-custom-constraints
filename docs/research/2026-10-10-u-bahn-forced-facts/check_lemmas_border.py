"""Throwaway: enumerate every valid U-Bahn network on a small board and test hand-derived lemmas."""
import sys, time
from collections import Counter, defaultdict
from functools import lru_cache

R, C = int(sys.argv[1]), int(sys.argv[2])
N_, E_, S_, W_ = 8, 4, 2, 1
POP = [bin(i).count("1") for i in range(16)]

def kind(m):
    d = POP[m]
    if d == 0: return "e"
    if d == 2: return "s" if m in (N_ | S_, E_ | W_) else "t"
    return "b" if d == 3 else "x"

@lru_cache(None)
def rows_for(up, last):
    """All (cells, down) for one row given the up-arm mask; cells is a tuple of arm masks."""
    out = []
    for h in range(1 << (C - 1)):
        for down in (range(1) if last else range(1 << C)):
            cells = []
            for c in range(C):
                m = 0
                if up >> c & 1: m |= N_
                if down >> c & 1: m |= S_
                if c < C - 1 and h >> c & 1: m |= E_
                if c > 0 and h >> (c - 1) & 1: m |= W_
                if POP[m] == 1: break
                cells.append(m)
            else:
                out.append((tuple(cells), down))
    return out

def connected(g):
    used = [(r, c) for r in range(R) for c in range(C) if g[r][c]]
    if not used: return False
    seen, st = {used[0]}, [used[0]]
    while st:
        r, c = st.pop(); m = g[r][c]
        for bit, dr, dc in ((N_, -1, 0), (E_, 0, 1), (S_, 1, 0), (W_, 0, -1)):
            if m & bit and (r + dr, c + dc) not in seen:
                seen.add((r + dr, c + dc)); st.append((r + dr, c + dc))
    return len(seen) == len(used)

fails, total = Counter(), 0
row_clues_mid, row_clues_top = set(), set()
seen_bridge = [0]

def line_stats(cells, vertical_axis):
    """Counts for one row (vertical_axis=False) or column (True). 'along' = arms along the line."""
    along = (N_ | S_) if vertical_axis else (E_ | W_)
    k = Counter(kind(m) for m in cells)
    one_along = sum(1 for m in cells if POP[m] == 3 and POP[m & along] == 1)  # branch with stem along the line
    return k["t"], k["s"], k["b"], k["x"], one_along

def check(g):
    global total
    total += 1
    T = S = B = X = 0
    rows = [line_stats(g[r], False) for r in range(R)]
    cols = [line_stats([g[r][c] for r in range(R)], True) for c in range(C)]
    d = [sum(1 for c in range(C) if g[r][c] & S_) for r in range(R)]  # edges below row r
    usedrow = [any(g[r]) for r in range(R)]
    first, last = usedrow.index(True), R - 1 - usedrow[::-1].index(True)
    # L9 blank rows only outside
    if not all(usedrow[first:last + 1]): fails["L9 blank row inside"] += 1
    pre = 0
    for r in range(R):
        t, s, b, x, p = rows[r]          # p = branches with exactly one horizontal arm (stem horizontal: |- -|)
        T += t; S += s; B += b; X += x
        if (p - t) % 2: fails["L3 row: sideways branches != turns mod 2"] += 1
        if t % 2 and b == 0: fails["L4 odd turns needs a branch"] += 1
        if x and t + p < 2: fails["L7 cross needs two run ends"] += 1
        if t == 0 and b == 0 and (x or any(m == (E_ | W_) for m in g[r])): fails["L13"] += 1
        if t + s + b + x == 1 and s != 1: fails["L8 lone cell is a straight"] += 1
        if t + s + b + x == 1 and not any(m == (N_ | S_) for m in g[r]): fails["L8b lone straight vertical"] += 1
        pre += b
        if r < R - 1:
            if (d[r] - pre) % 2: fails["L5 boundary parity"] += 1
            if first <= r < last and d[r] < (2 if pre % 2 == 0 else 1): fails["L5b boundary minimum"] += 1
        V = (d[r - 1] if r else 0) + d[r]
        if V < t + b + 2 * x + (t % 2): fails["L11 vertical-end lower bound"] += 1
        pmax = b if (b - t) % 2 == 0 else b - 1
        if V > t + 2 * s + 2 * x + b + pmax: fails["L11 vertical-end upper bound"] += 1
        (row_clues_top if r in (0, R - 1) else row_clues_mid).add((t, s, b, x))
    # L2 first used row behaves like a border row
    t, s, b, x, p = rows[first]
    if x or t % 2 or t < 2 or p or d[first] != t + b or any(m == (N_ | S_) for m in g[first]):
        fails["L2 first used row"] += 1
    t, s, b, x, p = rows[last]
    if x or t % 2 or t < 2 or p or (d[last - 1] != t + b): fails["L2 last used row"] += 1
    oddR = sum(1 for r in rows if r[0] % 2); oddC = sum(1 for c in cols if c[0] % 2)
    for t, s, b, x, q in cols:           # q = branches with exactly one vertical arm (T and upside-down T)
        if (q - t) % 2: fails["L3 col: upright branches != turns mod 2"] += 1
    if B < oddR + oddC: fails["L6 B >= odd rows + odd cols"] += 1
    if B % 2: fails["B even"] += 1
    if T < 4: fails["L10 T>=4"] += 1
    P = sum(r[4] for r in rows); Q = sum(c[4] for c in cols)
    if P + Q != B or (T - P) % 2 or (T - Q) % 2: fails["L10 T=P=Q mod 2"] += 1
    Ecount = (2 * T + 2 * S + 3 * B + 4 * X) // 2
    if Ecount - (T + S + B + X) + 1 != B // 2 + X + 1: fails["L14"] += 1
    # L15 a single edge across a row boundary needs two used rows on each side
    for r in range(R - 1):
        if d[r] == 1 and (r - first + 1 < 2 or last - r < 2): fails["L15 bridge needs 2 rows each side"] += 1
        if d[r] == 1: seen_bridge[0] += 1
        if d[r] < max(rows[r][3], rows[r + 1][3]): fails["L17 boundary >= crosses either side"] += 1
    # L16 in the first used row turns alternate: opens-right then opens-left, nothing but blanks between runs
    op = [m for m in g[first] if kind(m) == "t"]
    if any(m != (E_ | S_ if i % 2 == 0 else S_ | W_) for i, m in enumerate(op)): fails["L16 turn alternation"] += 1
    if any(POP[m] == 3 and m != (E_ | S_ | W_) for m in g[first]): fails["L16 branches point down"] += 1
    # L12 a branch alone in its row and its column
    for r in range(R):
        for c in range(C):
            if POP[g[r][c]] == 3 and rows[r][2] == 1 and cols[c][2] == 1 and (rows[r][0] + cols[c][0]) % 2 == 0:
                fails["L12 lone branch parity"] += 1

def dfs(r, up, g):
    if r == R:
        if connected(g): check(g)
        return
    for cells, down in rows_for(up, r == R - 1):
        g.append(cells); dfs(r + 1, down, g); g.pop()

t0 = time.time(); dfs(0, 0, [])
print(f"{R}x{C}: {total} connected valid networks, {time.time()-t0:.1f}s")
print("boundaries with exactly one edge:", seen_bridge[0]); print("lemma failures:", dict(fails) if fails else "none")

print("row tuple (0,1,0,0) realised in a middle row:", (0,1,0,0) in row_clues_mid)
