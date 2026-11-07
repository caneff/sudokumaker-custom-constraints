# The board a frame puzzle is carved into, as one value: the `Spec` an example
# hands the shared frame builder, the interior's `Geometry`, the carved
# `Board`, the straight clue lines its size implies (`make_lines`), and the gen
# JSON round trip (`save_board`/`load_board`).
#
# The frame builder is four modules: this one, `carve.py` (the CP-SAT search),
# `document.py` (the shared document parts: rules text, frame backends, House
# GAC) and `lanes.py` (each kind of board's document, check, files and the
# command line every `build_size.py` ends with).

import json
import pathlib
from collections.abc import Callable
from dataclasses import dataclass


@dataclass
class Spec:
    """What one example hands the shared frame builder: its directory, titles,
    components, clue rule (as a function and as CP-SAT constraints) and rules
    text. The builder reads everything example-specific from here."""

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
    # `n` is the board's digit count, which is the side on a square board.
    cp_sat_clue_fn: Callable
    # comment_fn(n, **shape) -> the puzzle's rule text. `n` is the interior's
    # width; a rectangular board (`Board.shape`) also passes `height` and
    # `digits`, a square one passes neither.
    comment_fn: Callable
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
    # straight frame lines. Only a search reads this; whether a rules text
    # says a line is no house is read off the board being encoded, not here.
    bent_lines: bool = True
    # Does this example's frame-builder 9x9 GLOBAL board own the plain names
    # (PUZZLE_LINK.txt / gen.json)? See `RingGlobal`. False for
    # numbered-rooms and running-start, whose PUZZLE_LINK.txt is a different,
    # hand-built board that claimed those names first.
    plain_global_9x9: bool = True
    # Which GLOBAL-lane sizes carry the shared house-GAC filter (house-gac.js
    # + HouseGacComponent.js) on every interior row, column and box. Per
    # BOARD, not per example: the filter is a real strength upgrade but only
    # pays for itself in real-app solve time on some boards
    # (docs/real-app-timing.md), so a size not in this set -- the local
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
    # The interior, for an example whose grid is not a sudoku: grid_fn,
    # model_fn, box_regions and rowcol_houses. Each defaults to the sudoku
    # interior, so an example that sets none of them builds a sudoku board.
    # A rectangular board hands grid_fn and model_fn its `height` and `digits`
    # as keywords too (`Board.shape`); a square one passes neither, so a hook
    # for a sudoku interior takes only the arguments below.
    # grid_fn(rng, n, bh, bw, **shape) -> the solved interior, as rows of
    # digits, `n` wide; None draws `make_grid`'s sudoku.
    grid_fn: Callable | None = None
    # model_fn(n, box, **shape) -> (m, x): the CP-SAT interior `unique` posts
    # givens and clues onto, with `x` keyed by (row, column); None builds
    # `cpsat.sudoku_model`.
    model_fn: Callable | None = None
    # Does the ring board declare the interior's boxes as regions? False
    # leaves the document with no region constraint at all.
    box_regions: bool = True
    # Does the ring board carry the frame-rowcol backend, which declares the
    # interior's rows and columns as houses? False leaves it out; the
    # frame-corners backend stays, since it pins cells no interior reaches.
    rowcol_houses: bool = True
    # The sentence a ring board's rules text opens with; None is RULES_PREFIX.
    # An interior with no sudoku rules to name sets "" and states its whole
    # rule in comment_fn.
    rules_prefix: str | None = None
    # Seconds per solve while carving: a carve step is kept only when its
    # proof finishes inside this. None is SOLVE_LIMIT. A model whose proofs
    # run near SOLVE_LIMIT sets a smaller one, so the board it ships proves
    # with room to spare under `generate`'s final check, which runs at
    # SOLVE_LIMIT.
    carve_limit: float | None = None
    # Does the search look for a board with no interior givens first? True
    # draws each seed's layout once (a layout an earlier seed drew is
    # skipped), proves each on its full ring alone, carves the ring of every
    # layout proved unique there, and keeps the one with the fewest shown
    # clues. A layout whose proof reaches no verdict inside carve_limit is
    # neither: it is proved again at SOLVE_LIMIT before the search gives up on
    # it. Only when no layout proves unique on its ring does it fall back to
    # the default carve, interior givens first, over the same layouts. False
    # stops at the first board with the fewest givens and carves only its
    # ring.
    ring_only: bool = False


@dataclass(frozen=True)
class Geometry:
    """The interior a search carves: `n` wide, `height` tall, `digits` digits,
    and its `(box_height, box_width)`. A rectangle carries `box=None`: nothing
    reads a rectangle's box, so none is named. Build one with `square` or
    `rect`, which resolve the square defaults once."""

    n: int
    height: int
    digits: int
    box: tuple | None

    @classmethod
    def square(cls, n, bh, bw):
        return cls(n, n, n, (bh, bw))

    @classmethod
    def rect(cls, n, height, digits):
        return cls(n, height, digits, None)

    @property
    def is_rect(self):
        """A rectangle: built by `rect`, so it names no box."""
        return self.box is None

    @property
    def shape(self):
        """The keywords a rectangular board hands its interior hooks:
        `height` and `digits`, or none for a square, so a hook for a square
        interior takes no keyword it does not know."""
        if not self.is_rect:
            return {}
        return {"height": self.height, "digits": self.digits}


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
    # The interior is `n` wide and `height` tall, with `digits` digits; a
    # sudoku has both equal to `n`.
    height: int
    digits: int
    seed: int | None = None

    @property
    def geo(self):
        """This board's `Geometry`. A rectangle's recorded (bh, bw) is only the
        gen JSON's stand-in, so `geo.box` is None for it."""
        if self.height == self.n and self.digits == self.n:
            return Geometry.square(self.n, self.bh, self.bw)
        return Geometry.rect(self.n, self.height, self.digits)

    @property
    def shape(self):
        """The keyword dict the interior hooks receive (see `Geometry.shape`)."""
        return self.geo.shape

    @property
    def box(self):
        """The (box_height, box_width) pair a clue rule sizes itself from;
        None for a rectangle."""
        return self.geo.box


def _ring_key(name):
    """A ring key as the gen JSON spells it: "T3" -> ("T", 3)."""
    return (name[0], int(name[1:]))


def ring_name(key):
    """The inverse of `_ring_key`: ("T", 3) -> "T3". The one spelling of a ring
    key as a string, shared by the gen JSON, the ring-cell lookup and the
    CP-SAT variable tags."""
    return f"{key[0]}{key[1]}"


def make_lines(n, height=None):
    """Every straight clue line of an n-wide, `height`-tall interior (square
    unless `height` says otherwise), keyed by ring key ("L"/"R"/"T"/"B" plus
    the row or column) -> (row, column) cells, nearest the clue first. A left
    or right clue reads a row of n cells; a top or bottom clue reads a column
    of `height`."""
    h = n if height is None else height
    lines = {}
    for r in range(h):
        lines[("L", r)] = [(r, c) for c in range(n)]
        lines[("R", r)] = [(r, c) for c in range(n - 1, -1, -1)]
    for c in range(n):
        lines[("T", c)] = [(r, c) for r in range(h)]
        lines[("B", c)] = [(r, c) for r in range(h - 1, -1, -1)]
    return lines


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
        "clue": {ring_name(k): v for k, v in board.clue.items()},
        "active": [ring_name(k) for k in sorted(board.active)],
        "givens": {f"{r},{c}": v for (r, c), v in board.givens.items()},
    }
    if board.geo.is_rect:
        doc["height"] = board.height
        doc["digits"] = board.digits
    if board.lines != make_lines(board.n, board.height):
        doc["paths"] = {
            ring_name(k): [list(c) for c in board.lines[k]] for k in sorted(board.lines)
        }
    with path.open("w") as f:
        json.dump(doc, f, indent=1)


def load_board(path):
    """Read a gen JSON written by `save_board` back into a `Board`.

    The size comes off the recorded grid, not off the file's name (a grid that
    is not square, or a file that records "digits", is a rectangular board), and the
    flat "T3" ring keys are parsed here -- the one place that spelling is
    undone. A board with no "paths" carries the straight frame lines its size
    implies.
    """
    g = json.loads(path.read_text())
    grid = g["grid"]
    n = len(grid[0])
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
            else make_lines(n, len(grid))
        ),
        height=len(grid),
        digits=g.get("digits", n),
        seed=g.get("seed"),
    )
