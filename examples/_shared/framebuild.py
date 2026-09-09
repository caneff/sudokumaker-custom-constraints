# Shared machinery for an "interactive outside clue" puzzle generator: a
# sudoku grid, a ring of outside clues (one per row/column, both directions),
# and a custom constraint that reads the ring inward. Skyscrapers, Hit Counts,
# and any future line-clue puzzle share this shape; only the clue rule and its
# CP-SAT model differ, and those live in the caller's `Spec`.
#
# Generates a fresh grid, derives the clue for every line, carves minimal
# interior givens and a minimal shown-clue set to a unique solution
# (OR-Tools), then assembles the whole SudokuMaker document and encodes it.
# The carved board travels as one `Board` value; `board_files` names the two
# files it is written to, and `save_board`/`load_board` are its round trip.
#
# `main(spec, argv)` is the command line every example's `build_size.py` ends
# with -- it parses, and hands values to `run` (fresh search) or `rebuild`
# (re-encode a committed board against the code in the tree right now).
#
#   n box_height box_width [seed_count] [--paths|--local]
#   --rebuild n [--paths|--local]
#
# Writes PUZZLE_LINK*.txt and gen*.json next to the caller's script.

import argparse
import json
import pathlib
import random
import sys
from collections.abc import Callable
from dataclasses import dataclass, replace

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import link_codec
from component_scan import registered_components
from frame import cosmetics, ring_cell
from link_swap import find_constraint, frame_and_comment_only
from minify import minify_js


@dataclass
class Spec:
    dir: pathlib.Path  # example directory: scripts, components, and outputs live here
    title: str  # puzzle title, e.g. "Skyscrapers Interactive" (the "NxN" is appended)
    constraint_name: str  # the custom constraint's name, e.g. "Skyscrapers"
    components: list[str]  # component filenames the global lane ships, read from `dir`
    min_digit: int  # puzzle's minDigit
    # clue_fn(values, cells, box) -> the true clue for one line. `cells` are
    # the line's (row, column) pairs, nearest the clue first, and `box` is the
    # (box_height, box_width) pair: a rule whose clue depends on the line's
    # direction or on the box shape (outside-sudoku's window) reads both there.
    clue_fn: Callable
    # cp_sat_clue_fn(m, x, cells, kk, n, tag, box): posts the CP-SAT clue
    # constraint. Same `cells` and `box` as clue_fn, so the two say one rule.
    cp_sat_clue_fn: Callable
    comment_fn: Callable  # comment_fn(n) -> the puzzle's rule text
    extra_cages: Callable | None = (
        None  # extra_cages(interior) -> extra constraints, spliced after {"type": 0}
    )
    # What the local lane ships, when main.js registers a different set from
    # main-global.js. None means "the same list", which is what most examples
    # want. Name a lane's set here when its backend registers only part of the
    # other's: a component the lane's own backend never instantiates is dead
    # weight in that lane's link, and the recipient reads it as part of the
    # rule.
    local_components: list[str] | None = None
    # Does a fresh local board for this example GENERATE bent paths? True
    # everywhere but outside-sudoku, whose window is a box extent along the
    # line's DIRECTION and a bent path has none, so its local board draws the
    # straight frame lines (#268). Only `run` reads this; whether a rules text
    # says a line is no house is read off the board being encoded, not here.
    bent_lines: bool = True
    # Does this example's framebuild 9x9 GLOBAL board own the plain names
    # (PUZZLE_LINK.txt / gen.json)? See `board_files`. False for
    # numbered-rooms and running-start, whose PUZZLE_LINK.txt is a different,
    # hand-built board that claimed those names first.
    plain_global_9x9: bool = True


def component_files(spec, local):
    """The component filenames one lane's link carries."""
    if local and spec.local_components is not None:
        return spec.local_components
    return spec.components


def stem(filename):
    """A component file's registered name: `FooComponent.js` -> `FooComponent`."""
    return filename[: -len(".js")]


# Every generated link opens with this sentence (project rule).
RULES_PREFIX = "Normal sudoku rules apply on the inner grid. "

# Seconds per solve in `unique`. A frame board this size is proved in
# milliseconds, so a solve anywhere near the cap is a carve that has gone
# wrong; `unique` returns None for it, which the carve loop reads as "not
# unique" and the final assert in `generate` turns into a loud failure.
SOLVE_LIMIT = 10

# A bent-path link's rules text closes with this: its lines are drawn paths,
# not rows and columns, so a solver must not read them as houses (spec #232,
# user story 9). One sentence for every example, since the fact is the
# variant's, not the rule's. A local board whose drawn lines ARE the frame
# lines does not get it -- there the lines are houses (#268).
LOCAL_RULES_SUFFIX = (
    " Each clue sits at the end of a drawn line, read inward. A line is not a "
    "row, a column, or any other house: a digit may repeat along it."
)


@dataclass(frozen=True)
class Board:
    """One carved puzzle: the grid, the geometry its clues read, and what the
    link shows of them.

    `lines` maps a ring key -- ("T", 3) for the clue above interior column 3 --
    to that line's interior (row, column) cells, nearest the clue first.
    `clue` holds the true clue for every line; `active` names the ones the
    board shows, and the rest are the interactive ones a solver deduces.
    `givens` are the interior cells shown. `seed` records which
    `generate` seed carved it, and is None for a board read back off disk that
    never recorded one.

    Frozen at the field level: `generate` proves a board unique and
    `build_doc` encodes exactly that board, so nothing between the two
    re-points a board at another grid. A variant is
    `dataclasses.replace(board, ...)`, which is how the carve loop and the
    tests build one. The containers themselves are ordinary dicts and lists,
    so a caller that means to bend a board's contents copies them first.
    """

    n: int
    bh: int
    bw: int
    grid: list
    clue: dict
    givens: dict
    active: set
    lines: dict
    seed: int | None = None

    @property
    def box(self):
        """The (box_height, box_width) pair a clue rule sizes itself from."""
        return (self.bh, self.bw)


def _ring_key(name):
    """A ring key as the gen JSON spells it: "T3" -> ("T", 3)."""
    return (name[0], int(name[1:]))


def _ring_name(key):
    """The inverse of `_ring_key`: ("T", 3) -> "T3". The one spelling of a ring
    key as a string, shared by the gen JSON, the ring-cell lookup and the
    CP-SAT variable tags."""
    return f"{key[0]}{key[1]}"


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


def unique(post_clue, board):
    """True when `board`'s interior has exactly one solution, False when it has
    more, None when there is no verdict -- either the first solve found nothing
    inside the time limit (a timeout or an unsatisfiable model) or the search
    for a second solution spent the limit without one.

    `post_clue` is a Spec's cp_sat_clue_fn; unique() needs nothing else off the
    Spec, so a caller with its own line geometry can reuse it.
    """
    # Imported here, not at module scope: the search is the only part of this
    # file that needs a solver, so document assembly (build_doc, check,
    # load_board) and a caller's Spec stay importable without one.
    import cpsat
    from ortools.sat.python import cp_model

    n, bh, bw = board.n, board.bh, board.bw
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
    for (r, c), v in board.givens.items():
        m.Add(x[r, c] == v)
    # sorted: `active` is a set, whose iteration order is randomized per
    # process (string hash randomization) — sorting keeps constraint order,
    # and so the CP-SAT search path, the same on every run.
    for k in sorted(board.active):
        cells = board.lines[k]
        post_clue(m, x, cells, board.clue[k], n, _ring_name(k), board.box)
    s = cpsat.solver(SOLVE_LIMIT)
    if s.Solve(m) not in cpsat.SOLVED:
        return None
    s1 = {(r, c): s.Value(x[r, c]) for r in range(n) for c in range(n)}
    try:
        return not cpsat.has_second_solution(m, x, s1, SOLVE_LIMIT)
    except TimeoutError:
        # The board has a solution but the search for a second one ran out of
        # time: no verdict either way, same answer as a first solve that found
        # nothing.
        return None


def generate(spec, n, bh, bw, seeds, paths=False):
    """Search `seeds` for the leanest board and return the chosen `Board`.

    `paths` builds the local board: bent paths in place of the straight frame
    lines, and a seed whose lines carry no repeated digit is skipped, because
    a bent-path board that happens to repeat nothing proves nothing about bare
    lines. The geometry is drawn from its own random stream, so the frame-line
    case (which ignores its rng) makes every other draw exactly as before.
    """
    box = (bh, bw)
    best = None
    for seed in seeds:
        lines = make_paths(random.Random(seed * 13), n) if paths else make_lines(n)
        rng = random.Random(seed)
        grid = make_grid(rng, n, bh, bw)
        if paths and not repeating_lines(grid, lines):
            print(f"  seed {seed}: skipped, no line repeats a digit")
            continue
        # every line clued while carving givens
        base = Board(
            n=n,
            bh=bh,
            bw=bw,
            grid=grid,
            clue={
                k: spec.clue_fn([grid[r][c] for (r, c) in cells], cells, box)
                for k, cells in lines.items()
            },
            givens={},
            active=set(lines),
            lines=lines,
            seed=seed,
        )
        givens = {}
        cells_all = [(r, c) for r in range(n) for c in range(n)]
        rng.shuffle(cells_all)
        if not unique(spec.cp_sat_clue_fn, base):
            for cell in cells_all:
                givens[cell] = grid[cell[0]][cell[1]]
                if unique(spec.cp_sat_clue_fn, replace(base, givens=dict(givens))):
                    break
        for cell in list(givens.keys()):
            v = givens.pop(cell)
            if not unique(spec.cp_sat_clue_fn, replace(base, givens=dict(givens))):
                givens[cell] = v
        print(f"  seed {seed}: interior givens = {len(givens)}")
        if best is None or len(givens) < len(best.givens):
            best = replace(base, givens=dict(givens))
    assert best is not None, "no seed produced a board to carve"

    board = best
    active = set(board.active)
    rng = random.Random(board.seed * 7)
    order = sorted(active)  # sorted: see the note on set order in unique()
    rng.shuffle(order)
    for k in order:
        active.discard(k)
        if not unique(spec.cp_sat_clue_fn, replace(board, active=set(active))):
            active.add(k)
    board = replace(board, active=active)
    assert unique(spec.cp_sat_clue_fn, board) is True
    if paths:
        # The property the board exists to carry. Asserted here so a
        # regeneration that loses it fails loud instead of shipping a board
        # whose every line is a house in disguise.
        repeats = repeating_lines(board.grid, board.lines)
        assert repeats, "no line carries a repeated digit"
        print(f"  lines with a repeated digit: {len(repeats)} of {len(board.lines)}")
    print(
        f"CHOSEN seed {board.seed}: interior givens={len(board.givens)}, "
        f"clues shown={len(board.active)}, "
        f"clues interactive (hidden)={4 * n - len(board.active)}"
    )
    return board


# ---- document assembly ----------------------------------------------------


def frame_groups(n, lines):
    """The drawn groups for `lines` on an n x n interior: each group is the
    clue's ring cell, then that line's cells inward, which is the order
    `main.js` reads (docs/example-layout.md).

    A local board's `input.groups`, and the same input a wrapper that reads
    `input.groups` needs on a board whose own lane draws none -- see
    numbered-rooms/build_original.py and skyscraper/build_original.py.
    """
    W = n + 2

    def idx(r, c):
        return r * W + c

    return [
        {
            "cells": [
                idx(*ring_cell(_ring_name(key), W)),
                *(idx(r + 1, c + 1) for r, c in lines[key]),
            ],
            "value": "",
        }
        for key in sorted(lines)
    ]


def build_doc(spec, board, local=False):
    """Assemble the whole SudokuMaker document for `board`.

    `local` picks the variant (docs/line-contract.md): the global board runs
    main-global.js and ships no groups, so the backend builds every frame line
    itself; the local board runs main.js and ships each line as a drawn group,
    clue cell first.

    Whether those drawn lines bend -- which only the rules text cares about --
    is read off `board` itself, so a link never tells a solver a digit may
    repeat along cells that are a plain row. The global lane draws no lines at
    all, so it is never bent.
    """
    n, bh, bw = board.n, board.bh, board.bw
    bent = local and board.lines != make_lines(n)
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
                {"value": board.grid[r][c], "given": True}
                if (r, c) in board.givens
                else {}
            )
            interior.append(idx(r + 1, c + 1))

    # clue ring: a shown clue is a given; a hidden (interactive) clue is an
    # EMPTY cell. Never store the hidden value — a non-given value ships as an
    # entered digit, so the recipient opens the link with every clue typed in.
    for key in board.lines:
        ci = idx(*ring_cell(_ring_name(key), W))
        cells[ci] = (
            {"value": board.clue[key], "given": True} if key in board.active else {}
        )

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
    constraint_input = {"groups": frame_groups(n, board.lines)} if local else {}
    components = [
        {"type": "code", "name": stem(f), "code": minify_js((spec.dir / f).read_text())}
        for f in component_files(spec, local)
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
            "name": spec.constraint_name,
            "type": 1000,
            "definition": {
                "name": spec.constraint_name,
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
            + (LOCAL_RULES_SUFFIX if bent else ""),
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


def check(spec, link, doc, board, local=False):
    """Everything a built link must satisfy before it is written: it decodes
    back to `doc`, opens with the rules prefix, stores no value on a non-given
    cell, draws its lane's groups, and ships exactly the components its backend
    registers. `board` is what `doc` was built from, so the size is compared
    against the board rather than read back out of the document."""
    n = board.n
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
        if c.get("definition", {}).get("name") == spec.constraint_name
    )
    if local:
        assert len(lc["input"]["groups"]) == 4 * n, "one drawn group per line"
    else:
        assert lc["input"] == {}, "the global board reads no drawn groups"
    backend = minify_js(
        (spec.dir / ("main.js" if local else "main-global.js")).read_text()
    )
    assert lc["definition"]["backend"]["code"] == backend
    # Read the lane off `local` here, not off component_files(): an assertion
    # built from the same call the builder used would still pass if that call
    # stopped reading the lane at all.
    names = [c["name"] for c in lc["definition"]["components"]]
    want = (
        spec.local_components
        if local and spec.local_components is not None
        else spec.components
    )
    assert names == [stem(f) for f in want], (
        f"the link carries the wrong lane's components (local={local}): {names}"
    )
    # A lane's own link must ship exactly what its backend registers, in both
    # directions: the backend must not register a component the link leaves
    # out (that one fails inside the app, where the author never sees it),
    # and the link must not carry a name the backend never registers (that
    # one is dead weight the recipient still reads as part of the rule --
    # #287, #289, #290, #291). `registered_components` is a lexical check: it
    # reads `new <Name>Component` off the backend source, so a class reached
    # through an alias, or named some other way, is invisible to it.
    registered = registered_components(backend)
    unshipped = sorted(registered - set(names))
    assert not unshipped, (
        f"the backend registers components the link omits: {unshipped}"
    )
    dead = sorted(set(names) - registered)
    assert not dead, f"the link ships components the backend never registers: {dead}"
    assert doc["puzzle"]["maxDigit"] == n, "maxDigit must be n, not the 0..9 default"
    assert doc["puzzle"]["minDigit"] == spec.min_digit


# ---- the board on disk ----------------------------------------------------


def board_files(spec, n, local=False):
    """The (link, gen) paths one board owns, stated here once.

    The 9x9 is the board every example's timing loop, README and comparison
    links reuse, so it is plain-named: PUZZLE_LINK.txt / gen.json on the
    global lane, PUZZLE_LINK_local.txt / gen_local.json on the local one.
    Every other size carries its `NxN` tag, and a local board's tag ends
    `_local`.

    An example whose PUZZLE_LINK.txt is some other, hand-built board says so
    with `Spec.plain_global_9x9 = False`, and its framebuild 9x9 global board
    keeps the `9x9` tag. Nothing else claims the local plain names, so the
    local 9x9 is plain-named either way.
    """
    if n == 9 and (local or spec.plain_global_9x9):
        tag = "local" if local else ""
    else:
        tag = f"{n}x{n}_local" if local else f"{n}x{n}"
    link = f"PUZZLE_LINK_{tag}.txt" if tag else "PUZZLE_LINK.txt"
    gen = f"gen_{tag}.json" if tag else "gen.json"
    return spec.dir / link, spec.dir / gen


def save_board(board, path):
    """Write `board` to `path` as the gen JSON `load_board` reads back.

    A board whose lines are not the straight frame lines `n` implies records
    its geometry under "paths": bent paths are generated, not derivable.
    """
    doc = {
        "seed": board.seed,
        "n": board.n,
        "box": [board.bh, board.bw],
        "grid": board.grid,
        "clue": {_ring_name(k): v for k, v in board.clue.items()},
        "active": [_ring_name(k) for k in sorted(board.active)],
        "givens": {f"{r},{c}": v for (r, c), v in board.givens.items()},
    }
    if board.lines != make_lines(board.n):
        doc["paths"] = {
            _ring_name(k): [list(c) for c in board.lines[k]]
            for k in sorted(board.lines)
        }
    with path.open("w") as f:
        json.dump(doc, f, indent=1)


def load_board(path):
    """Read a gen JSON written by `save_board` back into a `Board`.

    The size comes off the recorded grid, not off the file's name, and the
    flat "T3" ring keys are parsed here -- the one place that spelling is
    undone. A board with no "paths" carries the straight frame lines its size
    implies.
    """
    g = json.loads(path.read_text())
    grid = g["grid"]
    n = len(grid)
    bh, bw = g["box"]
    return Board(
        n=n,
        bh=bh,
        bw=bw,
        grid=grid,
        clue={_ring_key(k): v for k, v in g["clue"].items()},
        givens={
            (int(r), int(c)): v
            for k, v in g["givens"].items()
            for r, c in [k.split(",")]
        },
        active={_ring_key(k) for k in g["active"]},
        lines=(
            {_ring_key(k): [tuple(c) for c in v] for k, v in g["paths"].items()}
            if "paths" in g
            else make_lines(n)
        ),
        seed=g.get("seed"),
    )


# ---- the two build lanes --------------------------------------------------


def run(spec, n, bh, bw, seeds, local=False):
    """Search `seeds` for a board, build its link, and write both files.

    `local` picks the lane: the global board runs main-global.js and draws no
    groups; the local board runs main.js and ships every line as a drawn
    group. Whether those lines bend is the Spec's `bent_lines`, so a caller
    names the lane and the example names its own geometry.
    """
    assert bh * bw == n, "box_height * box_width must equal n"
    board = generate(spec, n, bh, bw, seeds, paths=local and spec.bent_lines)
    doc = build_doc(spec, board, local=local)
    link = link_codec.encode_link(doc)
    check(spec, link, doc, board, local=local)
    link_path, gen_path = board_files(spec, n, local)
    link_path.write_text(link + "\n")
    save_board(board, gen_path)
    print(f"wrote {link_path.name} ({len(link)} chars) and {gen_path.name}")


def rebuild(spec, n, local=False):
    """The link for a committed board, re-encoded against the code in the tree
    right now, with no fresh CP-SAT search.

    The grid, givens and shown clues come straight from the recorded seed, so
    only the constraint's own configuration (component code, backend, input)
    and the comment follow the working tree: a shipped link never carries a
    component snapshot from whenever its search last ran. Asserts exactly that
    against the link it replaces, and returns the new link without writing it,
    so a test can compare bytes without touching the tree.
    """
    link_path, gen_path = board_files(spec, n, local)
    assert gen_path.exists(), (
        f"{gen_path.name} does not exist: this example ships no framebuild "
        f"board at n={n} on the {'local' if local else 'global'} lane. A link "
        "whose board was not carved here is rebuilt by its own build_link.py."
    )
    board = load_board(gen_path)
    doc = build_doc(spec, board, local=local)
    link = link_codec.encode_link(doc)
    check(spec, link, doc, board, local=local)
    assert link_path.exists(), (
        f"{link_path.name} does not exist: there is no committed link for this "
        "board to rebuild"
    )
    before = link_codec.decode_puzzle(link_path.read_text().strip())
    if local:
        # `frame_and_comment_only` clears the constraint's own input, and on
        # the local lane that input IS the line geometry -- the only place a
        # drawn board's lines appear in the document. Compare it here, or a
        # gen JSON whose "paths" moved rebuilds into a link drawing lines the
        # shown clues no longer describe, and the guard below sees nothing.
        drawn = find_constraint(before, spec.constraint_name)["input"].get("groups")
        assert drawn == frame_groups(board.n, board.lines), (
            "the committed link draws different lines from the recorded "
            "board's -- a rebuild from the recorded seed must not move the "
            "geometry"
        )
    assert frame_and_comment_only(
        before, spec.constraint_name
    ) == frame_and_comment_only(doc, spec.constraint_name), (
        "grid, givens, or shown clues changed -- a rebuild from the recorded "
        "seed must only change the constraint code and comment"
    )
    return link


def main(spec, argv=None):
    """The command line every example's `build_size.py` ends with.

        <n> <box_height> <box_width> [seed_count] [--paths|--local]
        --rebuild <n> [--paths|--local]

    `--paths` and `--local` are two names for the same lane: both build the
    LOCAL board. The Spec's `bent_lines` -- not the flag -- says whether that
    board's drawn lines bend.

    `argv` defaults to the process's, and is passed explicitly by
    `framebuild.test.py`: nothing below `main` reads `sys.argv`.
    """
    p = argparse.ArgumentParser(description=f"Build a {spec.title} puzzle link.")
    p.add_argument("n", type=int, help="interior size")
    p.add_argument("box_height", type=int, nargs="?")
    p.add_argument("box_width", type=int, nargs="?")
    p.add_argument("seed_count", type=int, nargs="?", default=40)
    p.add_argument(
        "--rebuild",
        action="store_true",
        help="re-encode the committed board of this size against the current code",
    )
    p.add_argument(
        "--paths",
        "--local",
        dest="local",
        action="store_true",
        help="build the local board (main.js, drawn groups) instead",
    )
    args = p.parse_args(argv)

    if args.rebuild and (args.box_height is not None or args.box_width is not None):
        p.error("--rebuild re-encodes a committed board: pass n and the lane only")
    if args.rebuild:
        link_path, _ = board_files(spec, args.n, args.local)
        link = rebuild(spec, args.n, local=args.local)
        link_path.write_text(link + "\n")
        print(
            f"wrote {link_path.name} ({len(link)} chars) -- "
            "current component code, same board"
        )
        return
    if args.box_height is None or args.box_width is None:
        p.error("a fresh search needs n, box_height and box_width")
    run(
        spec,
        args.n,
        args.box_height,
        args.box_width,
        range(101, 101 + args.seed_count),
        local=args.local,
    )
