# Shared machinery for an "interactive outside clue" puzzle generator: a
# sudoku grid, a ring of outside clues (one per row/column, both directions),
# and a custom constraint that reads the ring inward. Skyscrapers, Hit Counts,
# and any future line-clue puzzle share this shape; only the clue rule and its
# CP-SAT model differ, and those live in the caller's `Spec`.
#
# Generates a fresh grid, derives the clue for every line, carves minimal
# interior givens and a minimal shown-clue set to a unique solution
# (OR-Tools), then assembles the whole SudokuMaker document and encodes it.
# `run(spec)` is the entry point: it parses argv, generates, builds the
# document, checks the round trip, and writes the link and gen_<n>x<n>.json.
#
# Args: n box_height box_width [seed_count]   (box_height * box_width == n)
# Writes PUZZLE_LINK_<n>x<n>.txt and gen_<n>x<n>.json next to the caller's script.

import json
import pathlib
import random
import sys
from collections.abc import Callable
from dataclasses import dataclass

from ortools.sat.python import cp_model

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import link_codec
from frame import cosmetics, ring_cell
from minify import minify_js


@dataclass
class Spec:
    dir: pathlib.Path  # example directory: scripts, components, and outputs live here
    title: str  # puzzle title, e.g. "Skyscrapers Interactive" (the "NxN" is appended)
    lines_name: str  # name of the custom "...Lines" constraint, e.g. "Skyscraper Lines"
    components: list[str]  # component filenames, read from `dir`
    min_digit: int  # puzzle's minDigit
    clue_fn: Callable  # clue_fn(values) -> the true clue for one line of digits
    cp_sat_clue_fn: Callable  # cp_sat_clue_fn(m, x, cells, kk, n, tag): posts the CP-SAT clue constraint
    comment_fn: Callable  # comment_fn(n) -> the puzzle's rule text
    extra_cages: Callable | None = (
        None  # extra_cages(interior) -> extra constraints, spliced after {"type": 0}
    )


# Every generated link opens with this sentence (project rule).
RULES_PREFIX = "Normal sudoku rules apply on the inner grid. "

# The local link's rules text closes with this: its lines are drawn paths, not
# rows and columns, so a solver must not read them as houses (spec #232, user
# story 9). One sentence for every example, since the fact is the variant's,
# not the rule's.
LOCAL_RULES_SUFFIX = (
    " Each clue sits at the end of a drawn line, read inward. A line is not a "
    "row, a column, or any other house: a digit may repeat along it."
)


# ---- grid generation ------------------------------------------------------


def make_grid(rng, n, bh, bw):
    # Start from the standard shift pattern, then shuffle bands, rows, stacks,
    # columns, and digit labels. Every step preserves sudoku validity.
    base = [[((r * bw + r // bh + c) % n) for c in range(n)] for r in range(n)]
    bands = [
        b * bh + r
        for b in rng.sample(range(n // bh), n // bh)
        for r in rng.sample(range(bh), bh)
    ]
    stacks = [
        s * bw + c
        for s in rng.sample(range(n // bw), n // bw)
        for c in rng.sample(range(bw), bw)
    ]
    digits = rng.sample(range(1, n + 1), n)
    return [[digits[base[bands[r]][stacks[c]]] for c in range(n)] for r in range(n)]


def make_lines(n):
    lines = {}
    for r in range(n):
        lines[("L", r)] = [(r, c) for c in range(n)]
        lines[("R", r)] = [(r, c) for c in range(n - 1, -1, -1)]
    for c in range(n):
        lines[("T", c)] = [(r, c) for r in range(n)]
        lines[("B", c)] = [(r, c) for r in range(n - 1, -1, -1)]
    return lines


# The clue's own interior cell, the step inward from it, and the two steps
# across, per ring side. A ring key names one clue cell: "T3"/"B3" sit
# above/below interior column 3, "L2"/"R2" left/right of interior row 2.
_SIDES = {
    "L": lambda i, n: ((i, 0), (0, 1), [(1, 0), (-1, 0)]),
    "R": lambda i, n: ((i, n - 1), (0, -1), [(1, 0), (-1, 0)]),
    "T": lambda i, n: ((0, i), (1, 0), [(0, 1), (0, -1)]),
    "B": lambda i, n: ((n - 1, i), (-1, 0), [(0, 1), (0, -1)]),
}


def make_paths(rng, n):
    """One bent path per ring key, in the shape make_lines returns.

    A path is an L: `a` cells straight in from the clue, then a turn and
    `n - a` cells across, `n` cells in all. With `a` between 2 and n - 1 both
    legs are non-empty, so the path spans more than one row and more than one
    column. Its cells therefore do not all see each other, the app reads the
    line as bare, and digits may repeat along it -- which is the whole point:
    a frame line is a full house and hides every bare-line bug.
    """
    paths = {}
    for side in "LRTB":
        for i in range(n):
            start, inward, across = _SIDES[side](i, n)
            legs = [
                (a, d)
                for a in range(2, n)
                for d in across
                if _in_grid(_step(start, inward, a - 1), d, n - a, n)
            ]
            a, d = rng.choice(legs)
            corner = _step(start, inward, a - 1)
            paths[(side, i)] = [_step(start, inward, k) for k in range(a)] + [
                _step(corner, d, k) for k in range(1, n - a + 1)
            ]
    return paths


def _step(cell, d, k):
    return (cell[0] + d[0] * k, cell[1] + d[1] * k)


def _in_grid(corner, d, k, n):
    """True when `k` further steps of `d` from `corner` all stay on the grid."""
    r, c = _step(corner, d, k)
    return 0 <= r < n and 0 <= c < n


def repeating_lines(grid, lines):
    """The keys whose line holds the same digit twice, read off the solution."""
    return [
        key
        for key, cells in lines.items()
        if len({grid[r][c] for r, c in cells}) < len(cells)
    ]


def unique(post_clue, lines, clue, active, givens, n, bh, bw):
    """True when the interior has exactly one solution. `post_clue` is a
    Spec's cp_sat_clue_fn; unique() needs nothing else off the Spec, so a
    caller with its own line geometry can reuse it (numbered-rooms-lines)."""
    m = cp_model.CpModel()
    x = {(r, c): m.NewIntVar(1, n, f"x{r}{c}") for r in range(n) for c in range(n)}
    for i in range(n):
        m.AddAllDifferent([x[i, c] for c in range(n)])
        m.AddAllDifferent([x[r, i] for r in range(n)])
    for br in range(0, n, bh):
        for bc in range(0, n, bw):
            m.AddAllDifferent(
                [x[br + dr, bc + dc] for dr in range(bh) for dc in range(bw)]
            )
    for (r, c), v in givens.items():
        m.Add(x[r, c] == v)
    # sorted: `active` is a set, whose iteration order is randomized per
    # process (string hash randomization) — sorting keeps constraint order,
    # and so the CP-SAT search path, the same on every run.
    for k in sorted(active):
        cells = lines[k]
        post_clue(m, x, cells, clue[k], n, f"{k[0]}{k[1]}")
    # Pinned to one worker with a fixed seed: CP-SAT's parallel portfolio search
    # is not reproducible run-to-run (the workers race, and which one reports
    # first depends on thread timing). Deterministic so regenerate + `git diff`
    # is a real gate.
    s = cp_model.CpSolver()
    s.parameters.max_time_in_seconds = 10
    s.parameters.num_workers = 1
    s.parameters.random_seed = 0
    if s.Solve(m) not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None
    s1 = {(r, c): s.Value(x[r, c]) for r in range(n) for c in range(n)}
    lits = []
    for (r, c), v in s1.items():
        b = m.NewBoolVar(f"d{r}{c}")
        m.Add(x[r, c] != v).OnlyEnforceIf(b)
        m.Add(x[r, c] == v).OnlyEnforceIf(b.Not())
        lits.append(b)
    m.AddBoolOr(lits)
    s2 = cp_model.CpSolver()
    s2.parameters.max_time_in_seconds = 10
    s2.parameters.num_workers = 1
    s2.parameters.random_seed = 0
    return s2.Solve(m) not in (cp_model.OPTIMAL, cp_model.FEASIBLE)


def generate(spec, n, bh, bw, seeds, hide_key=None, paths=False):
    """Search `seeds` for the leanest board and return the chosen one.

    `paths` builds the local board: bent paths in place of the straight frame
    lines, and a seed whose lines carry no repeated digit is skipped, because
    a bent-path board that happens to repeat nothing proves nothing about bare
    lines. The geometry is drawn from its own random stream, so the frame-line
    case (which ignores its rng) makes every other draw exactly as before.
    """
    best = None
    for seed in seeds:
        lines = make_paths(random.Random(seed * 13), n) if paths else make_lines(n)
        rng = random.Random(seed)
        grid = make_grid(rng, n, bh, bw)
        if paths and not repeating_lines(grid, lines):
            print(f"  seed {seed}: skipped, no line repeats a digit")
            continue
        clue = {
            k: spec.clue_fn([grid[r][c] for (r, c) in cells])
            for k, cells in lines.items()
        }
        active = set(lines.keys())  # every line clued while carving givens
        givens = {}
        cells_all = [(r, c) for r in range(n) for c in range(n)]
        rng.shuffle(cells_all)
        if not unique(spec.cp_sat_clue_fn, lines, clue, active, givens, n, bh, bw):
            for cell in cells_all:
                givens[cell] = grid[cell[0]][cell[1]]
                if unique(spec.cp_sat_clue_fn, lines, clue, active, givens, n, bh, bw):
                    break
        for cell in list(givens.keys()):
            v = givens.pop(cell)
            if not unique(spec.cp_sat_clue_fn, lines, clue, active, givens, n, bh, bw):
                givens[cell] = v
        cnt = len(givens)
        print(f"  seed {seed}: interior givens = {cnt}")
        if best is None or cnt < best[0]:
            best = (cnt, seed, grid, clue, dict(givens), set(active), lines)
    assert best is not None, "no seed produced a board to carve"
    cnt, seed, grid, clue, givens, active, lines = best
    rng = random.Random(seed * 7)
    order = sorted(active)  # sorted: see the note on set order in unique()
    rng.shuffle(order)
    if hide_key:  # stable: ties keep the shuffled order
        order.sort(key=lambda k: hide_key(clue[k]))
    for k in order:
        active.discard(k)
        if not unique(spec.cp_sat_clue_fn, lines, clue, active, givens, n, bh, bw):
            active.add(k)
    assert unique(spec.cp_sat_clue_fn, lines, clue, active, givens, n, bh, bw) is True
    if paths:
        # The property the board exists to carry. Asserted here so a
        # regeneration that loses it fails loud instead of shipping a board
        # whose every line is a house in disguise.
        repeats = repeating_lines(grid, lines)
        assert repeats, "no line carries a repeated digit"
        print(f"  lines with a repeated digit: {len(repeats)} of {len(lines)}")
    print(
        f"CHOSEN seed {seed}: interior givens={len(givens)}, clues shown={len(active)}, "
        f"clues interactive (hidden)={4 * n - len(active)}"
    )
    return seed, grid, clue, givens, active, lines


# ---- document assembly ----------------------------------------------------


def build_doc(spec, n, bh, bw, grid, clue, givens, active, lines, local=False):
    """Assemble the whole SudokuMaker document.

    `local` picks the variant (docs/line-contract.md): the global board runs
    main-global.js and ships no groups, so the backend builds every frame line
    itself; the local board runs main.js and ships each line as a drawn group,
    clue cell first.
    """
    W = n + 2
    idx = lambda r, c: r * W + c
    # interior cell (r,c) 0-indexed sits at board (r+1, c+1)
    cells = [{"value": 1} for _ in range(W * W)]

    # corners: filler givens, belong to no line
    for r, c in [(0, 0), (0, W - 1), (W - 1, 0), (W - 1, W - 1)]:
        cells[idx(r, c)] = {"given": True, "value": 1}

    # interior: a given carries its value; every other cell is EMPTY. The
    # solution is never stored — a non-given value ships as an entered digit.
    interior = []
    for r in range(n):
        for c in range(n):
            cells[idx(r + 1, c + 1)] = (
                {"value": grid[r][c], "given": True} if (r, c) in givens else {}
            )
            interior.append(idx(r + 1, c + 1))

    # clue ring: a shown clue is a given; a hidden (interactive) clue is an
    # EMPTY cell. Never store the hidden value — a non-given value ships as an
    # entered digit, so the recipient opens the link with every clue typed in.
    def ring_index(key):
        return idx(*ring_cell(f"{key[0]}{key[1]}", W))

    for key in lines:
        ci = ring_index(key)
        cells[ci] = {"value": clue[key], "given": True} if key in active else {}

    # regions: interior boxes, ring = -1
    regions = [-1] * (W * W)
    for r in range(n):
        for c in range(n):
            regions[idx(r + 1, c + 1)] = (r // bh) * (n // bw) + (c // bw)

    # transparent row/column cages over the interior (hidden rowcol helpers)
    row_cages = [
        {"cells": [idx(r + 1, c + 1) for c in range(n)], "value": 0} for r in range(n)
    ]
    col_cages = [
        {"cells": [idx(r + 1, c + 1) for r in range(n)], "value": 0} for c in range(n)
    ]
    cage_style = {"text": {"color": "#000000"}, "cage": {"color": "#00000000"}}

    # Global: no drawn groups, so main-global.js builds all 4n frame lines
    # itself from the grid at solve time. Local: each line ships as a group
    # whose cells are the clue then the line inward, which is the order
    # main.js reads (docs/example-layout.md).
    backend_code = minify_js(
        (spec.dir / ("main.js" if local else "main-global.js")).read_text()
    )
    definition_input = (
        [{"id": "groups", "label": "Groups", "params": {"type": "raw"}}]
        if local
        else []
    )
    constraint_input = (
        {
            "groups": [
                {
                    "cells": [
                        ring_index(key),
                        *(idx(r + 1, c + 1) for r, c in lines[key]),
                    ],
                    "value": "",
                }
                for key in sorted(lines)
            ]
        }
        if local
        else {}
    )
    components = [
        {"type": "code", "name": f[:-3], "code": minify_js((spec.dir / f).read_text())}
        for f in spec.components
    ]

    postproc_code = (
        "function postprocessJSON(json) {\n"
        "    json.metadata.norowcol = true;\n"
        '    json.cages.forEach(cage => cage.hidden ? cage.type = "rowcol" : null)\n'
        "}\n"
    )

    constraints = [
        {"type": 1, "regions": regions},
        {"name": "Rows", "type": 301, "cages": row_cages, "style": cage_style},
        {"name": "Columns", "type": 301, "cages": col_cages, "style": cage_style},
        {"type": 0},
        *(spec.extra_cages(interior) if spec.extra_cages else []),
        {
            "name": spec.lines_name,
            "type": 1000,
            "definition": {
                "name": spec.lines_name,
                "input": definition_input,
                "backend": {"type": "code", "code": backend_code},
                "components": components,
            },
            "input": constraint_input,
            "style": {},
        },
        {
            "type": 1000,
            "definition": {
                "name": "JSON Postproc",
                "input": [],
                "backend": {"type": "code", "code": postproc_code},
                "components": [],
            },
            "input": {},
            "style": {},
        },
        *cosmetics(W, cells),
    ]

    return {
        "formatVersion": "1.6.0",
        "puzzle": {
            "name": f"{spec.title} {n}x{n}",
            "author": "",
            "comment": RULES_PREFIX
            + spec.comment_fn(n)
            + (LOCAL_RULES_SUFFIX if local else ""),
            # minDigit/maxDigit pin the digit range to n; the app otherwise
            # defaults a custom puzzle to 0..9 regardless of grid size.
            "type": "custom",
            "width": W,
            "height": W,
            "minDigit": spec.min_digit,
            "maxDigit": n,
            "cells": cells,
            "constraints": constraints,
            "export": {"sudokuPad": {"useIncompleteGridAsSolution": True}},
        },
    }


def check(spec, link, doc, n, local=False):
    back = link_codec.decode_puzzle(link)
    assert back == doc, "link does not decode back to the built document"
    assert doc["puzzle"]["comment"].startswith(RULES_PREFIX), (
        "the rules text must open with the required sentence"
    )
    # A cell holds a value only when it is a given: a non-given value ships as
    # an entered digit, and the recipient opens a board already filled in.
    assert not [
        c for c in doc["puzzle"]["cells"] if "value" in c and not c.get("given")
    ], "a non-given cell carries a value"
    lc = next(
        c
        for c in doc["puzzle"]["constraints"]
        if c.get("definition", {}).get("name") == spec.lines_name
    )
    if local:
        assert len(lc["input"]["groups"]) == 4 * n, "one drawn group per line"
    else:
        assert lc["input"] == {}, "the global board reads no drawn groups"
    assert lc["definition"]["backend"]["code"] == minify_js(
        (spec.dir / ("main.js" if local else "main-global.js")).read_text()
    )
    assert doc["puzzle"]["maxDigit"] == n, "maxDigit must be n, not the 0..9 default"
    assert doc["puzzle"]["minDigit"] == spec.min_digit


def load_gen(dir_, n, tag=None):
    """Read back a gen_<tag>.json (written by run(), below) into the same
    shape build_doc() takes: a rebuild-from-frame script re-encodes a
    committed board without running generate() again. `tag` names the file,
    defaulting to the `<n>x<n>` global board. A local board records its
    generated path geometry under "paths"; a global one has none, and its
    lines are the straight frame lines n implies."""
    g = json.loads((dir_ / f"gen_{tag or f'{n}x{n}'}.json").read_text())
    bh, bw = g["box"]
    grid = g["grid"]
    lines = (
        {(k[0], int(k[1:])): [tuple(c) for c in v] for k, v in g["paths"].items()}
        if "paths" in g
        else make_lines(n)
    )
    clue = {(k[0], int(k[1:])): v for k, v in g["clue"].items()}
    active = {(k[0], int(k[1:])) for k in g["active"]}
    givens = {
        (int(r), int(c)): v for k, v in g["givens"].items() for r, c in [k.split(",")]
    }
    return bh, bw, grid, clue, givens, active, lines


def run(spec, paths=False):
    """Generate a board, build its link, and write the link and gen JSON.

    `paths` builds the LOCAL variant: bent paths instead of straight frame
    lines, shipped as drawn groups on the main.js lane, written as
    PUZZLE_LINK_<n>x<n>_local.txt and gen_<n>x<n>_local.json.
    """
    n, bh, bw = (int(a) for a in sys.argv[1:4])
    assert bh * bw == n, "box_height * box_width must equal n"
    seeds = range(101, 141) if len(sys.argv) < 5 else range(101, 101 + int(sys.argv[4]))
    seed, grid, clue, givens, active, lines = generate(
        spec, n, bh, bw, seeds, paths=paths
    )
    doc = build_doc(spec, n, bh, bw, grid, clue, givens, active, lines, local=paths)
    link = link_codec.encode_link(doc)
    check(spec, link, doc, n, local=paths)
    tag = f"{n}x{n}_local" if paths else f"{n}x{n}"
    (spec.dir / f"PUZZLE_LINK_{tag}.txt").write_text(link + "\n")
    board = {
        "seed": seed,
        "n": n,
        "box": [bh, bw],
        "grid": grid,
        "clue": {f"{s}{i}": clue[(s, i)] for (s, i) in clue},
        "active": [f"{s}{i}" for (s, i) in sorted(active)],
        "givens": {f"{r},{c}": v for (r, c), v in givens.items()},
    }
    if paths:
        # The geometry is generated, not derivable from n, so the board file
        # carries it: build_link.test.py reads the paths back to check the
        # link's drawn groups and the repeated digit.
        board["paths"] = {
            f"{s}{i}": [list(c) for c in lines[(s, i)]] for (s, i) in sorted(lines)
        }
    with (spec.dir / f"gen_{tag}.json").open("w") as f:
        json.dump(board, f, indent=1)
    print(f"wrote PUZZLE_LINK_{tag}.txt ({len(link)} chars) and gen_{tag}.json")
