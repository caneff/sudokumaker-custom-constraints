"""A found U-Bahn network as a Penpa+ link (#774), standard library only.

The wire format and the layout of three published U-Bahn links:
docs/research/2026-10-10-u-bahn-penpa-link.md (§ numbers below are its).
The board is the grid with `k` clue rows above and `k` clue columns to its
left, ordinary cells of the table, with one row and one column of piece icons
beside the grid; the top-left `(k-1)` square is left out of the cell list.
The `k` pieces run from the outside in: [blank,] cross, branch, straight,
turn (Chris's ruling on #774); blank is the option's fifth clue. The link
opens in the Line tool and carries a lines-only answer check
(`sol_loopline`, § 3).

`link` returns the URL as one string. A link is a 10 KB blob: write it to a
file, never to chat.
"""

import base64
import json
import sys
import zlib
from itertools import pairwise
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
# isort: split
import network

PAGE = "https://swaroopg92.github.io/penpa-edit/"
CELL_SIZE = 38
MARGIN = 2  # hidden cells on every side of the table (§ 1.4)

# The pieces from the outside in, as `network.KIND_NAMES` spells them.
PIECE_ORDER = ("cross", "branch", "straight", "turn")
BLANK_FIRST = ("blank", *PIECE_ORDER)

# Abbreviations applied to the whole payload text, in this order (§ 1.2).
COMPRESS_SUB = (
    ("z", "zZ"),
    ('"qa"', "z9"),
    ('"pu_q"', "zQ"),
    ('"pu_a"', "zA"),
    ('"grid"', "zG"),
    ('"edit_mode"', "zM"),
    ('"surface"', "zS"),
    ('"line"', "zL"),
    ('"lineE"', "zE"),
    ('"wall"', "zW"),
    ('"cage"', "zC"),
    ('"number"', "zN"),
    ('"symbol"', "zY"),
    ('"special"', "zP"),
    ('"board"', "zB"),
    ('"command_redo"', "zR"),
    ('"command_undo"', "zU"),
    ('"command_replay"', "z8"),
    ('"numberS"', "z1"),
    ('"freeline"', "zF"),
    ('"freelineE"', "z2"),
    ('"thermo"', "zT"),
    ('"arrows"', "z3"),
    ('"direction"', "zD"),
    ('"squareframe"', "z0"),
    ('"polygon"', "z5"),
    ('"deletelineE"', "z4"),
    ('"killercages"', "z6"),
    ('"nobulbthermo"', "z7"),
    ('"__a"', "z_"),
    ("null", "zO"),
)

# The question layer's keys, in the order Penpa+ writes them (§ 1.5).
LAYER_KEYS = (
    "command_redo",
    "command_undo",
    "command_replay",
    "surface",
    "number",
    "numberS",
    "symbol",
    "freeline",
    "freelineE",
    "thermo",
    "arrows",
    "direction",
    "squareframe",
    "polygon",
    "line",
    "lineE",
    "wall",
    "cage",
    "deletelineE",
    "killercages",
    "nobulbthermo",
)
_LAYER_EMPTY = {
    "command_redo": {"__a": []},
    "command_undo": {"__a": []},
    "command_replay": {"__a": []},
    "thermo": [],
    "arrows": [],
    "direction": [],
    "squareframe": [],
    "polygon": [],
    "killercages": [],
    "nobulbthermo": [],
}

# The answer check: lines only, in the one style the check counts (§ 3).
CHECK_FLAGS = (
    "sol_surface_exact",
    "sol_surface",
    "sol_number",
    "sol_loopline_exact",
    "sol_loopline",
    "sol_ignoreloopline",
    "sol_loopedge_exact",
    "sol_loopedge",
    "sol_ignoreborder",
    "sol_wall",
    "sol_square",
    "sol_circle",
    "sol_tri",
    "sol_arrow",
    "sol_math",
    "sol_battleship",
    "sol_tent",
    "sol_star",
    "sol_akari",
    "sol_mine",
)
OR_FLAGS = (
    "sol_or_surface",
    "sol_or_number",
    "sol_or_loopline",
    "sol_or_loopedge",
    "sol_or_wall",
    "sol_or_square",
    "sol_or_circle",
    "sol_or_tri",
    "sol_or_arrow",
    "sol_or_math",
    "sol_or_battleship",
    "sol_or_tent",
    "sol_or_star",
    "sol_or_akari",
    "sol_or_mine",
)

# The `mode` object as the published U-Bahn link with a check writes it:
# the Line tool, normal submode, style 3 (green), in the solver's layer.
_MODE = {
    "qa": "pu_a",
    "grid": ["1", "2", "1"],
    "pu_q": {
        "edit_mode": "number",
        "surface": ["", 1],
        "line": ["5", 2],
        "lineE": ["1", 21],
        "wall": ["", 2],
        "cage": ["1", 10],
        "number": ["1", 1],
        "symbol": ["cross", 1],
        "special": ["thermo", ""],
        "board": ["", ""],
        "move": ["1", ""],
        "combi": ["battleship", ""],
        "sudoku": ["1", 1],
    },
    "pu_a": {
        "edit_mode": "line",
        "surface": ["", 8],
        "line": ["1", 3],
        "lineE": ["1", 3],
        "wall": ["", 3],
        "cage": ["1", 10],
        "number": ["1", 2],
        "symbol": ["circle_L", 1],
        "special": ["thermo", ""],
        "board": ["", ""],
        "move": ["1", ""],
        "combi": ["battleship", ""],
        "sudoku": ["1", 9],
    },
}

# The cross icon's four flags are [right, down, left, up] (§ 1.5). Per piece,
# the icon beside a strip of clue rows and beside a strip of clue columns.
# The turn's icon sits in the one cell the innermost row and column share.
_ICONS = {
    "cross": ([1, 1, 1, 1], [1, 1, 1, 1]),
    "branch": ([1, 1, 1, 0], [1, 1, 0, 1]),
    "straight": ([1, 0, 1, 0], [0, 1, 0, 1]),
    "turn": ([1, 1, 0, 0], [1, 1, 0, 0]),
}
BLANK_ICON = "□"  # a number's text: a blank cell has no line to draw

TITLE = "U-Bahn"
RULES = (
    "Draw a totally connected loop network through the centers of some "
    "cells, which may branch or turn, but may not have any dead ends. "
    "Lines of the network cross cells only through their centers."
    "\n"
    "A number outside the grid says how many cells of the shape beside it "
    "(from the outside in: {shapes}) the row or column holds."
)
_ESCAPES = ((",", "%2C"), ("\n", "%2D"), ("&", "%2E"), ("=", "%2F"))
_SHAPE_WORDS = {
    "blank": "no line at all",
    "cross": "cross",
    "branch": "branch",
    "straight": "straight",
    "turn": "turn",
}


def _json(value):
    return json.dumps(value, separators=(",", ":"))


def _escape(text):
    """A header field: the characters the header's own syntax uses, spelt
    the way Penpa+ reads them back (§ 1.3)."""
    for plain, escaped in _ESCAPES:
        text = text.replace(plain, escaped)
    return text


def encrypt(text):
    """Raw deflate, then base64 without padding (§ 1.2, `encrypt_data`)."""
    deflater = zlib.compressobj(9, zlib.DEFLATED, -15)
    packed = deflater.compress(text.encode("utf-8")) + deflater.flush()
    return base64.b64encode(packed).decode("ascii").rstrip("=")


def center_point(nx, ny):
    """The index of the point nearest the middle of an `nx` by `ny` table
    (§ 1.4): a vertex where both counts are even, a cell centre where both
    are odd, an edge midpoint when they differ. Checked against the five
    published headers for square tables only; the mixed case is read from
    the same geometry."""
    nx0, ny0 = nx + 2 * MARGIN, ny + 2 * MARGIN
    size = nx0 * ny0
    x, y = MARGIN + nx // 2, MARGIN + ny // 2
    if nx % 2 == 0 and ny % 2 == 0:
        return size + (x - 1) + (y - 1) * nx0
    if nx % 2 == 1 and ny % 2 == 1:
        return x + y * nx0
    if nx % 2 == 0:
        # Middle of a vertical edge: the right edge of the cell left of it.
        return 3 * size + (x - 1) + y * nx0
    # Middle of a horizontal edge: the bottom edge of the cell above it.
    return 2 * size + x + (y - 1) * nx0


def _layer(**filled):
    layer = {}
    for key in LAYER_KEYS:
        value = filled.get(key)
        if value is None:
            value = json.loads(json.dumps(_LAYER_EMPTY.get(key, {})))
        layer[key] = value
    return layer


def _cell_list(nx, ny, k):
    """Cell-centre indices of the table, row by row, without the notch."""
    nx0 = nx + 2 * MARGIN
    return [
        x + y * nx0
        for y in range(MARGIN, ny + MARGIN)
        for x in range(MARGIN, nx + MARGIN)
        if not (x < MARGIN + k - 1 and y < MARGIN + k - 1)
    ]


def _deltas(indices):
    """The first index, then each step to the next (§ 1.4)."""
    return [indices[0]] + [b - a for a, b in pairwise(indices)]


def _rules_text(pieces):
    return RULES.format(shapes=", ".join(_SHAPE_WORDS[p] for p in pieces))


def payload(rows, cols, found, blank_clue=False):
    """The inflated, unabbreviated text of the `p` parameter: 19 lines."""
    pieces = BLANK_FIRST if blank_clue else PIECE_ORDER
    k = len(pieces)
    nx, ny = cols + k, rows + k
    nx0 = nx + 2 * MARGIN
    size = nx0 * (ny + 2 * MARGIN)
    g = MARGIN + k  # padded x and y of the grid's first cell

    def cell(x, y):
        return x + y * nx0

    row_numbers, col_numbers = network.outside_numbers(found, rows, cols)
    kinds = [network.KIND_NAMES.index(p) for p in pieces]
    number = {}
    for j, kind in enumerate(kinds):
        for c in range(cols):
            number[cell(g + c, MARGIN + j)] = [str(col_numbers[c][kind]), 1, "1"]
        for r in range(rows):
            number[cell(MARGIN + j, g + r)] = [str(row_numbers[r][kind]), 1, "1"]

    symbol = {}
    for j, piece in enumerate(pieces):
        if piece == "blank":
            number[cell(g - 1, MARGIN + j)] = [BLANK_ICON, 1, "1"]
            number[cell(MARGIN + j, g - 1)] = [BLANK_ICON, 1, "1"]
            continue
        beside_rows, beside_cols = _ICONS[piece]
        # The icon for clue row y sits in the last clue column, and the icon
        # for clue column x in the last clue row; the innermost piece's two
        # icons are the one cell where those meet.
        symbol[cell(g - 1, MARGIN + j)] = [beside_rows, "cross", 1]
        symbol[cell(MARGIN + j, g - 1)] = [beside_cols, "cross", 1]

    # Thick dividers along the right of the last clue column and the bottom
    # of the last clue row, in vertex indices (§ 1.4), style 21.
    def vertex(x, y):
        return size + x + y * nx0

    divider = {}
    for y in range(MARGIN, ny + MARGIN):
        a, b = vertex(g - 1, y - 1), vertex(g - 1, y)
        divider[f"{a},{b}"] = 21
    for x in range(MARGIN, nx + MARGIN):
        a, b = vertex(x - 1, g - 1), vertex(x, g - 1)
        divider[f"{a},{b}"] = 21

    question = _layer(number=number, symbol=symbol, lineE=divider)
    center = center_point(nx, ny)
    header = [
        "square",
        str(nx),
        str(ny),
        str(CELL_SIZE),
        "0",
        "1",
        "1",
        str((nx + 1) * CELL_SIZE),
        str((ny + 1) * CELL_SIZE),
        str(center),
        str(center),
        "0",
        "0",
        "0",
        "0",
        "Title: " + _escape(TITLE),
        "Author: ",
        "",
        _escape(_rules_text(pieces)),
        "OFF",
        "false",
    ]
    lines = [
        ",".join(header),
        _json([0, 0, 0, 0]),
        '["1","2","1"]~"line"~["1",3]',
        _json(question),
        "",
        _json(_deltas(_cell_list(nx, ny, k))),
        "[]",
        _json({flag: flag == "sol_loopline" for flag in CHECK_FLAGS}),
        '"x"',
        '"x"',
        "[3,1,3]",
        _json(_MODE),
        '"x"',
        "0",
        _json(_layer()),
        "x",
        _json(dict.fromkeys(OR_FLAGS, False)),
        "[]",
        "Congratulations!",
    ]
    return "\n".join(lines)


def answer(rows, cols, found, blank_clue=False):
    """The inflated text of the `a` parameter: the network's segments as
    `"<low>,<high>,1"` between cell-centre indices, sorted the way
    JavaScript sorts strings, in the second of six arrays (§ 3, § 5 step 9)."""
    k = len(BLANK_FIRST if blank_clue else PIECE_ORDER)
    nx0 = cols + k + 2 * MARGIN
    g = MARGIN + k

    def cell(rc):
        return (g + rc[1]) + (g + rc[0]) * nx0

    segments = sorted("{},{},1".format(*sorted((cell(a), cell(b)))) for a, b in found)
    return _json([[], segments, [], [], [], []])


def abbreviate(text):
    """`COMPRESS_SUB` applied to the whole payload text, in order (§ 1.2)."""
    for plain, token in COMPRESS_SUB:
        text = text.replace(plain, token)
    return text


def link(rows, cols, found, blank_clue=False):
    """The Penpa+ solve link for a network on a `rows` by `cols` board: its
    outside numbers as clues, its edges as the embedded answer."""
    text = abbreviate(payload(rows, cols, found, blank_clue))
    return (
        f"{PAGE}#m=solve&p={encrypt(text)}"
        f"&a={encrypt(answer(rows, cols, found, blank_clue))}"
    )
