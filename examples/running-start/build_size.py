# Build a Running Start puzzle link for any grid size.
#
# Generates a fresh grid, derives the clue for every line, carves minimal
# interior givens and a minimal shown-clue set to a unique solution (OR-Tools),
# then assembles the whole SudokuMaker document parametrically and encodes it.
# The 9x9 example uses puzzle_template.json + build_link.py; this script builds
# the same frame from scratch for sizes that have no template (4x4, 6x6).
#
#   uv run --with ortools --with lzstring examples/running-start/build_size.py 4 2 2
#   uv run --with ortools --with lzstring examples/running-start/build_size.py 6 2 3
#
# Args: n box_height box_width   (box_height * box_width == n)
# Writes PUZZLE_LINK_<n>x<n>.txt and gen_<n>.json next to this script.

import json, pathlib, random, sys, urllib.parse
from ortools.sat.python import cp_model
from lzstring import LZString
sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from minify import minify_js
from frame import cosmetics

HERE = pathlib.Path(__file__).parent
COMPONENTS = ["RunningStartComponent.js", "RunningStartPairComponent.js"]


# ---- grid generation ------------------------------------------------------

def make_grid(rng, n, bh, bw):
    # Start from the standard shift pattern, then shuffle bands, rows, stacks,
    # columns, and digit labels. Every step preserves sudoku validity.
    base = [[((r * bw + r // bh + c) % n) for c in range(n)] for r in range(n)]
    bands = [b * bh + r for b in rng.sample(range(n // bh), n // bh)
             for r in rng.sample(range(bh), bh)]
    stacks = [s * bw + c for s in rng.sample(range(n // bw), n // bw)
              for c in rng.sample(range(bw), bw)]
    digits = rng.sample(range(1, n + 1), n)
    return [[digits[base[bands[r]][stacks[c]]] for c in range(n)] for r in range(n)]


def make_lines(n):
    lines = {}
    for r in range(n):
        lines[('L', r)] = [(r, c) for c in range(n)]
        lines[('R', r)] = [(r, c) for c in range(n - 1, -1, -1)]
    for c in range(n):
        lines[('T', c)] = [(r, c) for r in range(n)]
        lines[('B', c)] = [(r, c) for r in range(n - 1, -1, -1)]
    return lines


def rs(v):
    k = 1
    for i in range(1, len(v)):
        if v[i] > v[i - 1]: k += 1
        else: break
    return k


def unique(lines, clue, active, givens, n, bh, bw):
    m = cp_model.CpModel()
    x = {(r, c): m.NewIntVar(1, n, f"x{r}{c}") for r in range(n) for c in range(n)}
    for i in range(n):
        m.AddAllDifferent([x[i, c] for c in range(n)])
        m.AddAllDifferent([x[r, i] for r in range(n)])
    for br in range(0, n, bh):
        for bc in range(0, n, bw):
            m.AddAllDifferent([x[br + dr, bc + dc] for dr in range(bh) for dc in range(bw)])
    for (r, c), v in givens.items(): m.Add(x[r, c] == v)
    for k in active:
        cells = lines[k]; kk = clue[k]
        for i in range(1, kk): m.Add(x[cells[i]] > x[cells[i - 1]])
        if kk < n: m.Add(x[cells[kk]] < x[cells[kk - 1]])
    s = cp_model.CpSolver(); s.parameters.max_time_in_seconds = 10; s.parameters.num_workers = 8
    if s.Solve(m) not in (cp_model.OPTIMAL, cp_model.FEASIBLE): return None
    s1 = {(r, c): s.Value(x[r, c]) for r in range(n) for c in range(n)}
    lits = []
    for (r, c), v in s1.items():
        b = m.NewBoolVar(f"d{r}{c}")
        m.Add(x[r, c] != v).OnlyEnforceIf(b); m.Add(x[r, c] == v).OnlyEnforceIf(b.Not())
        lits.append(b)
    m.AddBoolOr(lits)
    s2 = cp_model.CpSolver(); s2.parameters.max_time_in_seconds = 10; s2.parameters.num_workers = 8
    return s2.Solve(m) not in (cp_model.OPTIMAL, cp_model.FEASIBLE)


def generate(n, bh, bw):
    lines = make_lines(n)
    best = None
    for seed in range(101, 141):
        rng = random.Random(seed)
        grid = make_grid(rng, n, bh, bw)
        clue = {k: rs([grid[r][c] for (r, c) in cells]) for k, cells in lines.items()}
        active = set(lines.keys())      # every line clued while carving givens
        givens = {}
        cells_all = [(r, c) for r in range(n) for c in range(n)]; rng.shuffle(cells_all)
        if not unique(lines, clue, active, givens, n, bh, bw):
            for cell in cells_all:
                givens[cell] = grid[cell[0]][cell[1]]
                if unique(lines, clue, active, givens, n, bh, bw): break
        for cell in list(givens.keys()):
            v = givens.pop(cell)
            if not unique(lines, clue, active, givens, n, bh, bw): givens[cell] = v
        cnt = len(givens)
        print(f"  seed {seed}: interior givens = {cnt}")
        if best is None or cnt < best[0]:
            best = (cnt, seed, grid, clue, dict(givens), set(active))
    cnt, seed, grid, clue, givens, active = best
    rng = random.Random(seed * 7); order = list(active); rng.shuffle(order)
    for k in order:
        active.discard(k)
        if not unique(lines, clue, active, givens, n, bh, bw): active.add(k)
    assert unique(lines, clue, active, givens, n, bh, bw) is True
    print(f"CHOSEN seed {seed}: interior givens={len(givens)}, clues shown={len(active)}")
    return seed, grid, clue, givens, active, lines


# ---- document assembly ----------------------------------------------------

# One worked example per size: a line, then the left and right clue it gives.
RULE_EXAMPLES = {
    4: "a row with 1324 gives a left clue of 2 (1, 3) and a right clue of 1 (4)",
    6: "a row with 142356 gives a left clue of 2 (1, 4) and a right clue of 1 (6)",
    9: "a row with 142356789 gives a left clue of 2 (1, 4) and a right clue of 1 (9)",
}


CORNER_NOTE = ("The 1s in the corners only fill space for SudokuMaker's solver; "
               "delete them before publishing.")


def rule_text(n):
    rule = ("Running Start: Outside cells on clues must contain a digit, and that "
            "digit indicates the length of the first ascending sequence in that "
            "direction.")
    ex = RULE_EXAMPLES.get(n)
    if ex:
        rule = f"{rule} For example, {ex}."
    return f"{rule}\n\n{CORNER_NOTE}"


def build_doc(n, bh, bw, grid, clue, givens, active, lines):
    W = n + 2
    idx = lambda r, c: r * W + c
    # interior cell (r,c) 0-indexed sits at board (r+1, c+1)
    cells = [{"value": 1} for _ in range(W * W)]

    # corners: filler givens, belong to no line
    for r, c in [(0, 0), (0, W - 1), (W - 1, 0), (W - 1, W - 1)]:
        cells[idx(r, c)] = {"given": True, "value": 1}

    # interior values (full solution); given flag on the given cells
    for r in range(n):
        for c in range(n):
            cell = {"value": grid[r][c]}
            if (r, c) in givens: cell["given"] = True
            cells[idx(r + 1, c + 1)] = cell

    # clue ring: every line carries its true clue value; shown clues are given
    def ring_index(key):
        s, i = key
        if s == 'L': return idx(i + 1, 0)
        if s == 'R': return idx(i + 1, W - 1)
        if s == 'T': return idx(0, i + 1)
        if s == 'B': return idx(W - 1, i + 1)
    for key in lines:
        ci = ring_index(key)
        cell = {"value": clue[key]}
        if key in active: cell["given"] = True
        cells[ci] = cell

    # regions: interior boxes, ring = -1
    regions = [-1] * (W * W)
    for r in range(n):
        for c in range(n):
            regions[idx(r + 1, c + 1)] = (r // bh) * (n // bw) + (c // bw)

    # transparent row/column cages over the interior (hidden rowcol helpers)
    row_cages = [{"cells": [idx(r + 1, c + 1) for c in range(n)], "value": 0} for r in range(n)]
    col_cages = [{"cells": [idx(r + 1, c + 1) for r in range(n)], "value": 0} for c in range(n)]
    cage_style = {"text": {"color": "#000000"}, "cage": {"color": "#00000000"}}

    # running-start groups: clue cell then line read inward
    def group(key):
        ci = ring_index(key)
        line = [idx(r + 1, c + 1) for (r, c) in lines[key]]
        return {"cells": [ci] + line, "value": ""}
    groups = []
    for r in range(n):
        groups.append(group(('L', r))); groups.append(group(('R', r)))
    for c in range(n):
        groups.append(group(('T', c))); groups.append(group(('B', c)))

    rs_backend_code = minify_js((HERE / "main.js").read_text())
    components = [{"type": "code", "name": f[:-3], "code": minify_js((HERE / f).read_text())}
                 for f in COMPONENTS]

    postproc_code = (
        "function postprocessJSON(json) {\n"
        "    json.metadata.norowcol = true;\n"
        '    json.cages.forEach(cage => cage.hidden ? cage.type = "rowcol" : null)\n'
        "}\n")

    constraints = [
        {"type": 1, "regions": regions},
        {"name": "Rows", "type": 301, "cages": row_cages, "style": cage_style},
        {"name": "Columns", "type": 301, "cages": col_cages, "style": cage_style},
        {"type": 0},
        {"name": "Running Start Lines", "type": 1000,
         "definition": {
             "name": "Running Start Lines",
             "input": [{"id": "groups", "label": "Groups", "params": {"type": "raw"}}],
             "backend": {"type": "code", "code": rs_backend_code},
             "components": components},
         "input": {"groups": groups}, "style": {}},
        {"type": 1000,
         "definition": {"name": "JSON Postproc", "input": [],
                        "backend": {"type": "code", "code": postproc_code},
                        "components": []},
         "input": {}, "style": {}},
        *cosmetics(W, cells),
    ]

    return {"formatVersion": "1.6.0", "puzzle": {
        "name": f"Running Start {n}x{n}", "author": "generated",
        "comment": rule_text(n),
        # minDigit/maxDigit pin the digit range to n; the app otherwise
        # defaults a custom puzzle to 0..9 regardless of grid size.
        "type": "custom", "width": W, "height": W, "minDigit": 1, "maxDigit": n,
        "cells": cells, "constraints": constraints,
        "export": {"sudokuPad": {"useIncompleteGridAsSolution": True}}}}


def check(link, doc, n):
    back = json.loads(LZString.decompressFromEncodedURIComponent(
        urllib.parse.unquote(link.split("puzzle=")[-1])))
    assert back == doc, "link does not decode back to the built document"
    rs_c = next(c for c in doc["puzzle"]["constraints"]
                if c.get("definition", {}).get("name") == "Running Start Lines")
    assert len(rs_c["input"]["groups"]) == 4 * n, f"expected {4*n} groups"
    assert rs_c["definition"]["backend"]["code"] == minify_js((HERE / "main.js").read_text())
    assert doc["puzzle"]["maxDigit"] == n, "maxDigit must be n, not the 0..9 default"
    assert doc["puzzle"]["minDigit"] == 1


if __name__ == "__main__":
    n, bh, bw = (int(a) for a in sys.argv[1:4])
    assert bh * bw == n, "box_height * box_width must equal n"
    seed, grid, clue, givens, active, lines = generate(n, bh, bw)
    doc = build_doc(n, bh, bw, grid, clue, givens, active, lines)
    link = "https://sudokumaker.app/?puzzle=" + LZString.compressToEncodedURIComponent(json.dumps(doc))
    check(link, doc, n)
    (HERE / f"PUZZLE_LINK_{n}x{n}.txt").write_text(link + "\n")
    json.dump({"seed": seed, "n": n, "box": [bh, bw], "grid": grid,
               "clue": {f"{s}{i}": clue[(s, i)] for (s, i) in clue},
               "active": [f"{s}{i}" for (s, i) in active],
               "givens": {f"{r},{c}": v for (r, c), v in givens.items()}},
              open(HERE / f"gen_{n}.json", "w"), indent=1)
    print(f"wrote PUZZLE_LINK_{n}x{n}.txt ({len(link)} chars) and gen_{n}.json")
