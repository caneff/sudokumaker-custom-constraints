# Build SudokuMaker docs for the two SudokuPad DFM puzzles on our 9x9 base board,
# using the app's built-in NumberedRooms (504), CountingCircles (306) and diagonals (10/11).
import json, copy, math
base = json.load(open("ours.json"))
theirs = json.load(open("theirs.json"))
N = 9
def blank(doc, title, rules):
    d = copy.deepcopy(doc); p = d["puzzle"]
    p["cells"] = [{} for _ in range(N * N)]
    p["name"] = title; p["comment"] = rules
    return d
def dfm_idx(p): return [i for i, c in enumerate(p["constraints"]) if c.get("definition", {}).get("components")][0]
def outer(x, y): return (x + 1) + (y + 1) * (N + 2)
def check_nr(sol, clues):
    bad = 0
    for (x, y, v) in clues:
        if y == -1: line = [sol[r][x] for r in range(N)]
        elif y == N: line = [sol[r][x] for r in range(N - 1, -1, -1)]
        elif x == -1: line = [sol[y][c] for c in range(N)]
        else: line = [sol[y][c] for c in range(N - 1, -1, -1)]
        if line[line[0] - 1] != v: bad += 1; print("NR mismatch", x, y, v, line)
    return bad
def check_cc(sol, cells):
    vals = [sol[c // N][c % N] for c in cells]
    return sum(1 for v in vals if vals.count(v) != v), sum(1 for v in vals if v == 5)
def check_dfm(sol):
    return sum(1 for r in range(N) for c in range(N) if sol[r][c] == 5 and not ((r > 0 and sol[r-1][c] == 1) or (r < N-1 and sol[r+1][c] == 9)))

# Puzzle 1: Numbered Rooms
sp = json.load(open("sp.json")); sol = [[int(ch) for ch in sp["metadata"]["solution"][r*N:(r+1)*N]] for r in range(N)]
clues = [(math.floor(o["center"][1]), math.floor(o["center"][0]), int(o["text"])) for o in sp["overlays"]]
print("P1 clues", len(clues), "NR mismatches", check_nr(sol, clues), "DFM violations", check_dfm(sol))
d1 = blank(base, "Dutch Flat Mates (Numbered Rooms)", "Normal sudoku rules apply.\n\nDutch Flatmates: every 5 has a 1 directly above it or a 9 directly below it (or both).\n\nNumbered Rooms: a clue outside the grid is the digit in the Nth cell in that direction, where N is the digit in the first cell. (Puzzle by GoodCity.)")
d1["puzzle"]["constraints"].append({"type": 504, "clues": [{"outerCell": outer(x, y), "value": v} for x, y, v in clues], "style": {"color": "#000000"}})
# Puzzle 2: Counting Circles + diagonals
sp2 = json.load(open("sp2.json")); sol2 = [[int(ch) for ch in sp2["metadata"]["solution"][r*N:(r+1)*N]] for r in range(N)]
circles = sorted({int(u["center"][0]) * N + int(u["center"][1]) for u in sp2["underlays"]})
print("P2 circles", len(circles), "CC (violations, fives in circles)", check_cc(sol2, circles), "DFM violations", check_dfm(sol2),
      "diag ok", len({sol2[i][i] for i in range(N)}) == N and len({sol2[i][N-1-i] for i in range(N)}) == N)
d2 = blank(base, "Dutch Flat Mates (Counting Circles)", "Normal sudoku rules apply. Digits may not repeat along the indicated diagonals.\n\nDutch Flatmates: every 5 has a 1 directly above it or a 9 directly below it (or both).\n\nCounting Circles: a digit in a circle is the number of circles containing that digit. (Puzzle by Flinty.)")
d2["puzzle"]["constraints"] += [{"type": 10, "style": {"color": "#34bbe6ff", "thickness": 0.02}}, {"type": 11, "style": {"color": "#34bbe6ff", "thickness": 0.02}},
    {"type": 306, "cells": circles, "style": {"size": 0.75, "fill": "#ffffffff", "stroke": {"thickness": 0.02, "color": "#000000ff"}}}]
for name, d in (("p1", d1), ("p2", d2)):
    json.dump(d, open(f"{name}_ourcode.json", "w"))
    t = copy.deepcopy(d); p = t["puzzle"]; p["constraints"][dfm_idx(p)] = copy.deepcopy(theirs["puzzle"]["constraints"][dfm_idx(theirs["puzzle"])])
    json.dump(t, open(f"{name}_theircode.json", "w"))
print("written")
