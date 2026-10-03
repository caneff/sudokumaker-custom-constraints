# Shared machinery for an "interactive outside clue" puzzle generator: a
# sudoku grid, a ring of outside clues (one per row/column, both directions),
# and a custom constraint that reads the ring inward. Skyscrapers, Hit Counts,
# and any future line-clue puzzle share this shape; only the clue rule and its
# CP-SAT model differ, and those live in the caller's `Spec`.
#
# Generates a fresh grid, derives the clue for every line, carves minimal
# interior givens and a minimal shown-clue set to a unique solution
# (OR-Tools), then assembles the whole SudokuMaker document and encodes it.
# The carved board travels as one `Board` value; `save_board`/`load_board`
# are its round trip. A `Lane` -- ring global, ring local, or no ring
# (no_ring.py) -- owns the rest: the document, its check, its file names.
#
# `main(spec, argv)` is the command line every example's `build_size.py` ends
# with -- it parses, picks the lane (`lane_kinds`), and calls its `run` (fresh
# search) or `rebuild` (re-encode a committed board against the code in the
# tree right now).
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
from pathlib import PurePath

sys.path.insert(0, str(pathlib.Path(__file__).parent))
import link_codec
from component_scan import describe_mismatch, mismatch
from frame import corner_cells, cosmetics, ring_cell
from link_swap import frame_and_comment_only
from minify import minify_file
from sm_document import code_constraint, find_constraint

# Every generated link opens with a rules sentence (project rule). The Spec
# picks it (`Spec.rules_prefix`); this is the default, and every choice opens
# with REQUIRED_RULES_OPENING. A no-ring board has no inner grid to name, so
# it opens with NO_RING_RULES_PREFIX instead.
RULES_PREFIX = "Normal sudoku rules apply on the inner grid. "
NO_RING_RULES_PREFIX = "Normal sudoku rules apply. "
REQUIRED_RULES_OPENING = "Normal sudoku rules apply"


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
    # straight frame lines (#268). Only a search reads this; whether a rules text
    # says a line is no house is read off the board being encoded, not here.
    bent_lines: bool = True
    # Does this example's framebuild 9x9 GLOBAL board own the plain names
    # (PUZZLE_LINK.txt / gen.json)? See `RingGlobal`. False for
    # numbered-rooms and running-start, whose PUZZLE_LINK.txt is a different,
    # hand-built board that claimed those names first.
    plain_global_9x9: bool = True
    # Which GLOBAL-lane sizes carry the shared house-GAC filter (house-gac.js
    # + HouseGacComponent.js) on every interior row, column and box. Per
    # BOARD, not per example: the filter is a real strength upgrade (#406)
    # but only pays for itself in real-app solve time on some boards
    # (docs/real-app-timing.md, #421), so a size not in this set -- the local
    # lane at any size, always -- never carries it, and a routine rebuild of
    # one size cannot silently add it to another. A size in this set past the
    # filter's 9-cell cap is refused at build time rather than shipped as a
    # link it silently under-solves.
    house_gac: frozenset[int] = frozenset()
    # groups_fn(board) -> [(cells, value), ...]: set, it makes this a no-ring
    # example. Its board is the bare n x n grid with no clue ring around it
    # (`no_ring.NoRing`), its clues are typed into drawn groups, and this names
    # them: grid (row, column) cells and the value typed into each group
    # (None for an empty one). None, the default, is a ring example.
    groups_fn: Callable | None = None
    # The sentence the rules text opens with. A no-ring board has no "inner
    # grid" to name, so its example passes its own.
    rules_prefix: str = RULES_PREFIX


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

    n, bh, bw = board.n, board.bh, board.bw
    m, x = cpsat.sudoku_model(n, (bh, bw))
    for (r, c), v in board.givens.items():
        m.Add(x[r, c] == v)
    # sorted: `active` is a set, whose iteration order is randomized per
    # process (string hash randomization) — sorting keeps constraint order,
    # and so the CP-SAT search path, the same on every run.
    for k in sorted(board.active):
        cells = board.lines[k]
        post_clue(m, x, cells, board.clue[k], n, _ring_name(k), board.box)
    try:
        first, unique = cpsat.solve_unique(m, x, SOLVE_LIMIT)
    except TimeoutError:
        # No verdict either way: a first solve that spent the limit, or a
        # second one that did, reads as a first solve that found nothing.
        return None
    return unique if first is not None else None


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


# The frame's own two backends, shared by every example: the file in _shared
# that holds each one, and the constraint name it ships under. `build_doc`
# embeds them; `rebuild`'s guard reads the names off here, because their code
# is generated from the working tree and is not part of the board.
FRAME_BACKENDS = (
    ("frame-rowcol", "Frame Rows and Columns"),
    ("frame-corners", "Frame Corners"),
)


def frame_backend_code():
    """The frame's own two backends as `(constraint name, minified code)`,
    read from the working tree."""
    shared = pathlib.Path(__file__).parent
    return [
        (title, minify_file(shared / f"{name}.js")) for name, title in FRAME_BACKENDS
    ]


def refresh_frame_backends(doc):
    """Point a decoded document's frame backends at the code in the tree.

    A board this module carved is rebuilt whole, so it picks the current code
    up for free. A hand-built frame board is not: its own script injects only
    that example's constraint, and the shared backends would keep whatever
    copy the board was first encoded with -- which `check_layout.check_houses`
    then reads as a link that declares no interior lines at all. Raises when a
    backend is missing, so a board that should carry them cannot quietly skip
    the refresh.
    """
    for title, code in frame_backend_code():
        find_constraint(doc, title)["definition"]["backend"]["code"] = code
    return doc


# The shared house-GAC filter (#406, #408, #421): opt-in per board
# (`Spec.house_gac`), so it is a separate name from FRAME_BACKENDS, whose two
# entries are always-on and whose absence `refresh_frame_backends` treats as
# an error.
HOUSE_GAC_BACKEND_TITLE = "House GAC"
HOUSE_GAC_COMPONENT_NAME = "HouseGacComponent"

# HouseGacComponent.js's own MAX_CELLS: the largest house it will register on.
# `build_doc` reads it here, not from the JS, so a board past this size fails
# loud at build time instead of registering a component that refuses itself
# at solve time on a link already shipped.
HOUSE_GAC_MAX_CELLS = 9


def house_gac_backend_code():
    """`(constraint name, minified backend code, minified component code)` for
    the shared house-GAC filter, read from the working tree."""
    shared = pathlib.Path(__file__).parent
    return (
        HOUSE_GAC_BACKEND_TITLE,
        minify_file(shared / "house-gac.js"),
        minify_file(shared / f"{HOUSE_GAC_COMPONENT_NAME}.js"),
    )


def house_gac_constraint(n):
    """The house-GAC constraint block for an `n`-cell interior: the shared
    backend plus its one component, no input. `n` is every caller's board
    size, checked here -- not only in `build_doc` -- because a hand-built
    board (running-start's `build_link.py`) appends this constraint directly
    and never calls `build_doc` at all."""
    if n > HOUSE_GAC_MAX_CELLS:
        raise ValueError(
            f"house_gac_constraint: n={n} exceeds HouseGacComponent's "
            f"{HOUSE_GAC_MAX_CELLS}-cell house cap -- every interior row, "
            "column and box on this board would be that many cells, so the "
            "filter refuses to register at all (#421)"
        )
    title, backend_code, component_code = house_gac_backend_code()
    return code_constraint(
        title, backend_code, [(HOUSE_GAC_COMPONENT_NAME, component_code)]
    )


def puzzle_document(spec, board, width, cells, constraints, comment):
    """The document around one board's cells and constraints: the header
    fields every framebuild link shares, in the order they are encoded."""
    n = board.n
    return {
        "formatVersion": "1.6.0",
        "puzzle": {
            "name": f"{spec.title} {n}x{n}",
            "author": "",
            "comment": comment,
            # minDigit/maxDigit pin the digit range to n; the app otherwise
            # defaults a custom puzzle to 1..9 regardless of grid size.
            "type": "custom",
            "width": width,
            "height": width,
            "minDigit": spec.min_digit,
            "maxDigit": n,
            "cells": cells,
            "constraints": constraints,
            "export": {"sudokuPad": {"useIncompleteGridAsSolution": True}},
        },
    }


# ---- the board on disk ----------------------------------------------------


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


# ---- the three lanes ------------------------------------------------------


def named_files(spec, tag):
    """The (link, gen) paths for a board whose file tag is `tag`: the plain
    names when it is empty, `PUZZLE_LINK_<tag>.txt` / `gen_<tag>.json`
    otherwise."""
    link = f"PUZZLE_LINK_{tag}.txt" if tag else "PUZZLE_LINK.txt"
    gen = f"gen_{tag}.json" if tag else "gen.json"
    return spec.dir / link, spec.dir / gen


@dataclass(frozen=True)
class Lane:
    """One kind of board a Spec builds. Three exist -- `RingGlobal`,
    `RingLocal` and `no_ring.NoRing` -- and `lane_kinds` says which ones a
    Spec builds. A lane refuses a Spec that is not its kind, so a combination
    with no meaning (a no-ring board that draws no groups) cannot be built.

    A lane owns everything that differs between kinds of board: its document
    (`build_doc`), its drawn groups (`drawn`, None for a lane that draws
    none), its own half of `check` (`_check_lane`), its file names (`files`),
    the backend file its constraint runs (`backend`), and what a rebuild
    refreshes rather than compares (`generated`: the shared backends' titles;
    `derived`: constraint types recomputed from the board). `paths` is
    whether a fresh search draws bent paths.
    """

    spec: Spec
    derived = frozenset()

    def __post_init__(self):
        kinds = lane_kinds(self.spec)
        if not isinstance(self, kinds):
            raise ValueError(
                f"the {self.name} lane cannot build this Spec: it builds "
                f"{', '.join(k.name for k in kinds)} only"
            )

    @property
    def paths(self):
        return self.spec.bent_lines

    def components(self):
        """The component filenames this lane's link carries."""
        return self.spec.components

    def example_constraint(self, groups):
        """The example's own custom constraint: this lane's backend, its
        components, and `groups` as its input (None declares no input)."""
        return code_constraint(
            self.spec.constraint_name,
            minify_file(self.spec.dir / self.backend),
            [
                (PurePath(f).stem, minify_file(self.spec.dir / f))
                for f in self.components()
            ],
            groups=groups,
            named=True,
        )

    def check(self, link, doc, board):
        """Everything a built link must satisfy before it is written: it
        decodes back to `doc`, opens with the rules prefix, stores no value on
        a non-given cell, draws this lane's groups, and ships exactly the
        components its backend registers. `board` is what `doc` was built
        from, so the size is compared against the board rather than read back
        out of the document."""
        spec, n = self.spec, board.n
        back = link_codec.decode_puzzle(link)
        assert back == doc, "link does not decode back to the built document"
        # The Spec picks the sentence, so the builder cannot be the only
        # witness to it: whatever an example chooses still opens with the
        # project rule.
        assert spec.rules_prefix.startswith(REQUIRED_RULES_OPENING), (
            f"the Spec's rules prefix must open with {REQUIRED_RULES_OPENING!r}"
        )
        assert doc["puzzle"]["comment"].startswith(spec.rules_prefix), (
            "the rules text must open with the required sentence"
        )
        # A cell holds a value only when it is a given: a non-given value
        # ships as an entered digit, and the recipient opens a board already
        # filled in.
        assert not [
            c for c in doc["puzzle"]["cells"] if "value" in c and not c.get("given")
        ], "a non-given cell carries a value"
        lc = next(
            c
            for c in doc["puzzle"]["constraints"]
            if c.get("definition", {}).get("name") == spec.constraint_name
        )
        # `_check_lane` names the backend and components itself: an assertion
        # built from the builder's own call passes when that call breaks.
        backend_file, want = self._check_lane(lc, doc, board)
        backend = minify_file(spec.dir / backend_file)
        assert lc["definition"]["backend"]["code"] == backend, (
            f"the link runs the wrong lane's backend ({self.name})"
        )
        names = [c["name"] for c in lc["definition"]["components"]]
        assert names == [PurePath(f).stem for f in want], (
            f"the link carries the wrong lane's components ({self.name}): {names}"
        )
        # A lane's own link must ship exactly what its backend registers, in
        # both directions: the backend must not register a component the link
        # leaves out (that one fails inside the app, where the author never
        # sees it), and the link must not carry a name the backend never
        # registers (that one is dead weight the recipient still reads as part
        # of the rule -- #287, #289, #290, #291). `component_scan.mismatch` is
        # a lexical check: it reads `new <Name>Component` off the backend
        # source, so a class reached through an alias, or named some other
        # way, is invisible to it.
        problems = describe_mismatch(*mismatch(names, backend))
        assert not problems, "; ".join(problems)
        assert doc["puzzle"]["maxDigit"] == n, (
            "maxDigit must be n, not the 1..9 default"
        )
        assert doc["puzzle"]["minDigit"] == spec.min_digit

    def run(self, n, bh, bw, seeds):
        """Search `seeds` for a board on this lane, build its link, and write
        both files."""
        assert bh * bw == n, "box_height * box_width must equal n"
        board = generate(self.spec, n, bh, bw, seeds, paths=self.paths)
        doc = self.build_doc(board)
        link = link_codec.encode_link(doc)
        self.check(link, doc, board)
        link_path, gen_path = self.files(n)
        link_path.write_text(link + "\n")
        save_board(board, gen_path)
        print(f"wrote {link_path.name} ({len(link)} chars) and {gen_path.name}")

    def rebuild(self, n, pair=None):
        """The link for a committed board, re-encoded against the code in the
        tree right now, with no fresh CP-SAT search.

        The grid, givens and shown clues come from the recorded seed; only
        the constraint's code, backend, input and the comment follow the
        working tree. Asserts exactly that against the link it replaces, and
        returns the new link unwritten, so a test can compare bytes.

        `pair` names the (link, gen) files for a board that does not own its
        size's default names (`files(n)`) -- a second board of one size.
        """
        spec = self.spec
        link_path, gen_path = pair or self.files(n)
        assert gen_path.exists(), (
            f"{gen_path.name} does not exist: this example ships no framebuild "
            f"board at n={n} on the {self.name} lane. A link whose board was "
            "not carved here is rebuilt by its own build_link.py."
        )
        board = load_board(gen_path)
        doc = self.build_doc(board)
        link = link_codec.encode_link(doc)
        self.check(link, doc, board)
        assert link_path.exists(), (
            f"{link_path.name} does not exist: there is no committed link for "
            "this board to rebuild"
        )
        before = link_codec.decode_puzzle(link_path.read_text().strip())
        # `frame_and_comment_only` clears the constraint's own input, and a
        # lane that draws groups carries its line geometry there and nowhere
        # else -- a no-ring board its shown clues too, as typed values.
        # Compare it here, or a gen JSON whose "paths" moved rebuilds into a
        # link drawing lines the shown clues no longer describe, and the guard
        # below sees nothing. A lane that draws none compares None to None.
        drawn = find_constraint(before, spec.constraint_name)["input"].get("groups")
        assert drawn == self.drawn(board), (
            "the committed link draws different lines from the recorded "
            "board's -- a rebuild from the recorded seed must not move the "
            "geometry"
        )

        def _without_generated_constraints(d):
            """Drop House GAC whole, not blanked: it is opt-in
            (`spec.house_gac`), so a rebuild that first turns it on adds a
            constraint the old link never carried. Its code is generated, not
            board data (#421). The lane's `derived` constraints go too."""
            d = dict(d)
            d["puzzle"] = dict(d["puzzle"])
            d["puzzle"]["constraints"] = [
                c
                for c in d["puzzle"]["constraints"]
                if c.get("definition", {}).get("name") != HOUSE_GAC_BACKEND_TITLE
                and c.get("type") not in self.derived
            ]
            return d

        # The shared backends' code is generated, so blanked like the example's.
        assert _without_generated_constraints(
            frame_and_comment_only(before, spec.constraint_name, self.generated)
        ) == _without_generated_constraints(
            frame_and_comment_only(doc, spec.constraint_name, self.generated)
        ), (
            "grid, givens, or shown clues changed -- a rebuild from the recorded "
            "seed must only change the constraint code and comment"
        )
        return link


class _RingLane(Lane):
    """The two lanes with a clue ring around the grid: the (n+2) x (n+2)
    board, its frame backends and cosmetics. They differ in the groups they
    draw, whether House GAC may ride along, and the rules text's close."""

    generated = tuple(title for _, title in FRAME_BACKENDS)

    def build_doc(self, board):
        """Assemble the whole SudokuMaker document for `board`."""
        spec = self.spec
        n, bh, bw = board.n, board.bh, board.bw
        W = n + 2
        idx = lambda r, c: r * W + c
        # interior cell (r,c) 0-indexed sits at board (r+1, c+1)
        cells = [{"value": 1} for _ in range(W * W)]

        # corners: empty, and belong to no line. A given here is a digit the
        # recipient reads off the board, so the frame backend pins them instead.
        for r, c in corner_cells(W):
            cells[idx(r, c)] = {}

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
        # EMPTY cell. Never store the hidden value — a non-given value ships as
        # an entered digit, so the recipient opens the link with every clue
        # typed in.
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

        # The frame's own two backends, shared by every example (their rules
        # live in the files' own headers):
        #   frame-rowcol   declares the interior's rows and columns as named
        #                  houses, and hands SudokuPad the same lines at
        #                  publish time. A region constraint gives BOXES ONLY,
        #                  so without this the board is not the puzzle it looks
        #                  like (docs/gotchas.md #9).
        #   frame-corners  pins the four corner cells, which no line, region or
        #                  house reaches; without it the app calls the board
        #                  not unique.
        frame_backends = frame_backend_code()

        # The cap is `house_gac_constraint`'s to enforce -- it raises below
        # when the lane opts in and n is too big -- so it is checked once, for
        # every caller, not duplicated here.
        constraints = [
            {"type": 1, "regions": regions},
            {"type": 0},
            *(spec.extra_cages(interior) if spec.extra_cages else []),
            self.example_constraint(self.drawn(board)),
            *(code_constraint(name, code) for name, code in frame_backends),
            *([house_gac_constraint(n)] if self._house_gac(n) else []),
            *cosmetics(W, cells),
        ]

        comment = spec.rules_prefix + spec.comment_fn(n) + self._rules_close(board)
        return puzzle_document(spec, board, W, cells, constraints, comment)


class RingGlobal(_RingLane):
    """The ring board that draws no groups: main-global.js builds all 4n frame
    lines itself from the grid at solve time.

    The 9x9 is the board every example's timing loop, README and comparison
    links reuse, so it is plain-named (PUZZLE_LINK.txt / gen.json); every
    other size carries its `NxN` tag. An example whose PUZZLE_LINK.txt is some
    other, hand-built board says so with `Spec.plain_global_9x9 = False`, and
    its 9x9 keeps the `9x9` tag.
    """

    name = "global"
    backend = "main-global.js"
    paths = False

    def drawn(self, board):
        return None

    def files(self, n):
        plain = n == 9 and self.spec.plain_global_9x9
        return named_files(self.spec, "" if plain else f"{n}x{n}")

    def _house_gac(self, n):
        # `spec.house_gac` names sizes on this lane only (#421).
        return n in self.spec.house_gac

    def _rules_close(self, board):
        # This lane draws no lines at all, so they are never bent.
        return ""

    def _check_lane(self, lc, doc, board):
        assert lc["input"] == {}, "the global board reads no drawn groups"
        return "main-global.js", self.spec.components


class RingLocal(_RingLane):
    """The ring board that ships each line as a drawn group, clue cell first,
    which is the order main.js reads (docs/line-contract.md,
    docs/example-layout.md). Whether those lines bend is the Spec's
    `bent_lines`, so a caller names the lane and the example names its own
    geometry.

    Its 9x9 is PUZZLE_LINK_local.txt / gen_local.json -- nothing else claims
    those names -- and every other size is tagged `NxN_local`.
    """

    name = "local"
    backend = "main.js"

    def components(self):
        if self.spec.local_components is not None:
            return self.spec.local_components
        return self.spec.components

    def drawn(self, board):
        return frame_groups(board.n, board.lines)

    def files(self, n):
        return named_files(self.spec, "local" if n == 9 else f"{n}x{n}_local")

    def _house_gac(self, n):
        # Never on this lane: no measured local board cleared the timing bar
        # (docs/research/421-frame-link-timing.md).
        return False

    def _rules_close(self, board):
        # Whether the drawn lines bend is read off `board` itself, so a link
        # never tells a solver a digit may repeat along cells that are a
        # plain row.
        return LOCAL_RULES_SUFFIX if board.lines != make_lines(board.n) else ""

    def _check_lane(self, lc, doc, board):
        spec = self.spec
        groups = lc["input"].get("groups", [])
        assert len(groups) == 4 * board.n, "one drawn group per line"
        want = (
            spec.local_components
            if spec.local_components is not None
            else spec.components
        )
        return "main.js", want


def lane_kinds(spec):
    """The lane classes `spec` builds, the default first and the `--local`
    one last.

    A ring Spec builds both ring lanes. A Spec with a `groups_fn` builds the
    no-ring lane and only that: its clues live in its drawn groups, so a
    no-ring board that draws none has no lane, and the flag names the one
    lane either way.
    """
    if spec.groups_fn is None:
        return (RingGlobal, RingLocal)
    # Imported here: no_ring builds its lane on this module's `Lane`.
    from no_ring import NoRing

    return (NoRing,)


def main(spec, argv=None):
    """The command line every example's `build_size.py` ends with.

        <n> <box_height> <box_width> [seed_count] [--paths|--local]
        --rebuild <n> [--paths|--local]

    `--paths` and `--local` are two names for the same lane: both build the
    LOCAL board. The Spec's `bent_lines` -- not the flag -- says whether that
    board's drawn lines bend. A no-ring Spec has one lane, which the flag
    names either way (`lane_kinds`).

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
        help="build the drawn-groups lane (main.js) instead; a no-ring Spec has "
        "only that lane",
    )
    args = p.parse_args(argv)
    kinds = lane_kinds(spec)
    lane = (kinds[-1] if args.local else kinds[0])(spec)

    if args.rebuild and (args.box_height is not None or args.box_width is not None):
        p.error("--rebuild re-encodes a committed board: pass n and the lane only")
    if args.rebuild:
        link_path, _ = lane.files(args.n)
        link = lane.rebuild(args.n)
        link_path.write_text(link + "\n")
        print(
            f"wrote {link_path.name} ({len(link)} chars) -- "
            "current component code, same board"
        )
        return
    if args.box_height is None or args.box_width is None:
        p.error("a fresh search needs n, box_height and box_width")
    lane.run(
        args.n,
        args.box_height,
        args.box_width,
        range(101, 101 + args.seed_count),
    )
