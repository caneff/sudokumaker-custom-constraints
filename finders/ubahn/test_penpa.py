"""The U-Bahn Penpa+ link encoder (#774), checked without a browser.

The decoder here is written from the research note's § 1.2 and shares no code
with `penpa.py`: it inflates a link, undoes the abbreviation table in reverse
order and reads the layers. The three published U-Bahn links under
`fixtures/` must decode with it, and so must every link the encoder makes,
back to the outside numbers and the answer edges that went in.

    uv run finders/ubahn/test_penpa.py

The note: docs/research/2026-10-10-u-bahn-penpa-link.md
"""

import base64
import json
import re
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "hunt"))
import network
import penpa
from subprocess_env import success_env

FIXTURES = HERE / "fixtures"
FINDER = HERE / "ubahn_finder.py"

ok = True


def check(name, cond):
    global ok
    status = "ok" if cond else "FAIL"
    if not cond:
        ok = False
    print(f"{status}: {name}")


# The note's § 1.2 table, plain side then token, in application order. Typed
# out again here on purpose: the encoder's copy is checked against it by the
# published links decoding at all.
TABLE = [
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
]


def inflate(text):
    padded = text + "=" * (-len(text) % 4)
    return zlib.decompress(base64.b64decode(padded), -15).decode("utf-8")


def unabbreviate(text):
    for plain, token in reversed(TABLE):
        text = text.replace(token, plain)
    return text


def parameter(url, name):
    match = re.search(rf"[?#&]{name}=([^&]*)", url)
    return match.group(1) if match else None


class Decoded:
    """A link read back: the payload's lines, the header fields, the question
    layer, the centerlist and the answer's edge strings."""

    def __init__(self, url):
        self.url = url
        self.lines = unabbreviate(inflate(parameter(url, "p"))).split("\n")
        self.header = self.lines[0].split(",")
        self.nx, self.ny, self.size = (int(v) for v in self.header[1:4])
        self.canvas = (int(self.header[7]), int(self.header[8]))
        self.center = (int(self.header[9]), int(self.header[10]))
        self.space = json.loads(self.lines[1])
        self.layer = json.loads(self.lines[3])
        self.number = {int(k): v for k, v in self.layer["number"].items()}
        self.symbol = {int(k): v for k, v in self.layer["symbol"].items()}
        self.flags = json.loads(self.lines[7])
        deltas = json.loads(self.lines[5])
        self.centerlist = [deltas[0]]
        for step in deltas[1:]:
            self.centerlist.append(self.centerlist[-1] + step)
        answer = parameter(url, "a")
        self.answer = json.loads(inflate(answer)) if answer else None

    @property
    def nx0(self):
        return self.nx + 4

    def xy(self, index):
        """Padded (x, y) of a cell-centre index; the first real cell is 2, 2."""
        return index % self.nx0, index // self.nx0


def read(path):
    return Decoded((FIXTURES / path).read_text().strip())


def edges_of(decoded, clue_size):
    """The answer's edges as ((r, c), (r2, c2)), counted from the grid's
    first cell, which sits `clue_size` cells in from the board's corner."""
    edges = set()
    for entry in decoded.answer[1]:
        a, b, style = entry.split(",")
        assert style == "1", entry
        (xa, ya), (xb, yb) = decoded.xy(int(a)), decoded.xy(int(b))
        g = 2 + clue_size
        edges.add(tuple(sorted(((ya - g, xa - g), (yb - g, xb - g)))))
    return frozenset(edges)


def clues_of(decoded, clue_size, rows, cols):
    """(per row, per column) clue lists as written: for each clue position
    from the outside in, the number beside the grid. Rows read the columns
    of clue cells, columns the clue rows."""
    g = 2 + clue_size

    def num(x, y):
        cell = decoded.number.get(x + y * decoded.nx0)
        return int(cell[0]) if cell and cell[0].isdigit() else None

    by_row = [[num(2 + j, g + r) for j in range(clue_size)] for r in range(rows)]
    by_col = [[num(g + c, 2 + j) for j in range(clue_size)] for c in range(cols)]
    return by_row, by_col


def kind_counts(edges, rows, cols, order):
    """Per row and per column, the count of each kind in `order`, by degree
    of every cell: the layout check that confirmed Niverio's link."""
    deg = {(r, c): 0 for r in range(rows) for c in range(cols)}
    nbrs = {cell: set() for cell in deg}
    for a, b in edges:
        nbrs[a].add((b[0] - a[0], b[1] - a[1]))
        nbrs[b].add((a[0] - b[0], a[1] - b[1]))
        deg[a] += 1
        deg[b] += 1

    def kind(cell):
        d = deg[cell]
        if d == 0:
            return "blank"
        if d == 3:
            return "branch"
        if d == 4:
            return "cross"
        return (
            "straight"
            if sum(abs(s) for s in map(sum, zip(*nbrs[cell], strict=True))) == 0
            else "turn"
        )

    rows_out = [
        [sum(1 for c in range(cols) if kind((r, c)) == k) for k in order]
        for r in range(rows)
    ]
    cols_out = [
        [sum(1 for r in range(rows) if kind((r, c)) == k) for k in order]
        for c in range(cols)
    ]
    return rows_out, cols_out


RULED = ["cross", "branch", "straight", "turn"]


# --- The three published links decode, and their layout reads as the note says
knt = read("publ-knt.txt")
dandelo = read("publ-dandelo.txt")
niverio = read("publ-niverio.txt")
check(
    "the published links decode to a 12, 10 and 14 board",
    (knt.nx, dandelo.nx, niverio.nx) == (12, 10, 14),
)
check(
    "the published headers' centre points are 375, 286 and 476",
    (knt.center[0], dandelo.center[0], niverio.center[0]) == (375, 286, 476),
)
check(
    "a published canvas is (n + 1) cell sizes square",
    all(
        d.canvas == ((d.nx + 1) * d.size, (d.ny + 1) * d.size)
        for d in (knt, dandelo, niverio)
    ),
)
check(
    "KNT's link holds 19 clue numbers and 7 cross icons",
    len(knt.number) == 19 and len(knt.symbol) == 7,
)
check(
    "Niverio's answer reproduces all 25 of its clue numbers, "
    "cross-branch-straight-turn",
    clues_of(niverio, 4, 10, 10)[0]
    and all(
        got is None or got == want
        for got_rows, want_rows in zip(
            clues_of(niverio, 4, 10, 10),
            kind_counts(edges_of(niverio, 4), 10, 10, RULED),
            strict=True,
        )
        for got_row, want_row in zip(got_rows, want_rows, strict=True)
        for got, want in zip(got_row, want_row, strict=True)
    ),
)

# --- Header arithmetic against the five published values
check(
    "centre point of 12x12, 10x10, 14x14 and 9x9 boards",
    [penpa.center_point(n, n) for n in (12, 10, 14, 9)] == [375, 286, 476, 84],
)

# --- A hand-built network: the 3x3 block with a cross, four branches
# and four turns, in the top-left of a 4x4 board.
BLOCK = frozenset(
    [((r, c), (r, c + 1)) for r in range(3) for c in range(2)]
    + [((r, c), (r + 1, c)) for r in range(2) for c in range(3)]
)
ROWS, COLS = 4, 4
check("the hand-built network is a network", not network.why_not_network(BLOCK, 4, 4))

url = penpa.link(ROWS, COLS, BLOCK)
d = Decoded(url)
check(
    "the link is on the Penpa+ page in solve mode",
    url.startswith(penpa.PAGE + "#m=solve&p="),
)
check(
    "the header reads a square board of cells plus four clue strips",
    d.header[0] == "square" and (d.nx, d.ny) == (8, 8),
)
check("the board has no hidden margin", d.space == [0, 0, 0, 0])
check(
    "the canvas is the board plus one cell on each axis",
    d.canvas == ((8 + 1) * d.size, (8 + 1) * d.size),
)
check(
    "centre point from the header formula", d.center == (penpa.center_point(8, 8),) * 2
)
check("there are 19 payload lines", len(d.lines) == 19)

numbers_in = network.outside_numbers(BLOCK, ROWS, COLS)
by_row, by_col = clues_of(d, 4, ROWS, COLS)
order = [network.KIND_NAMES.index(k) for k in RULED]
check(
    "the clue cells carry the outside numbers, cross-branch-straight-turn, "
    "from the outside in",
    by_row == [[numbers_in[0][r][k] for k in order] for r in range(ROWS)]
    and by_col == [[numbers_in[1][c][k] for k in order] for c in range(COLS)],
)
check(
    "recounting the answer by degree through the layout gives the same clues",
    (by_row, by_col) == kind_counts(edges_of(d, 4), ROWS, COLS, RULED),
)
check("the answer decodes to the finder's edges", edges_of(d, 4) == BLOCK)
check(
    "the answer text is lines only: six arrays, only the second filled",
    len(d.answer) == 6
    and d.answer[1]
    and all(not d.answer[i] for i in (0, 2, 3, 4, 5)),
)
check("the answer strings are sorted", d.answer[1] == sorted(d.answer[1]))
check(
    "the answer names edge (0,0)-(0,1) at padded (6,6)-(7,6) of a 12-wide "
    "table as 78,79",
    "78,79,1" in d.answer[1],
)
check(
    "only the lines-only check flag is on",
    [k for k, v in d.flags.items() if v] == ["sol_loopline"],
)
# Every clue cell: 4 clue rows x 4 columns + 4 clue columns x 4 rows; the
# icons are symbols, not numbers.
check(
    "32 clue numbers, zero shown as 0",
    len(d.number) == 32
    and all(v[0].isdigit() and v[1:] == [1, "1"] for v in d.number.values()),
)
check(
    "seven cross icons",
    len(d.symbol) == 7 and all(v[1] == "cross" for v in d.symbol.values()),
)
sym = {d.xy(i): v[0] for i, v in d.symbol.items()}
check(
    "icons sit at the ends of the clue strips: cross, T, straight, then the "
    "shared turn",
    sym[(5, 2)] == [1, 1, 1, 1]
    and sym[(5, 3)] == [1, 1, 1, 0]
    and sym[(5, 4)] == [1, 0, 1, 0]
    and sym[(2, 5)] == [1, 1, 1, 1]
    and sym[(3, 5)] == [1, 1, 0, 1]
    and sym[(4, 5)] == [0, 1, 0, 1]
    and sym[(5, 5)] == [1, 1, 0, 0],
)

# Structural: every drawn cell is on the board, the centerlist is the L.
cells = set(d.centerlist)
check(
    "the centerlist is the L-shaped table without the notch",
    cells
    == {
        x + y * d.nx0
        for y in range(2, 10)
        for x in range(2, 10)
        if not (x < 5 and y < 5)
    },
)
check(
    "every number and icon sits in a listed cell",
    set(d.number) <= cells and set(d.symbol) <= cells,
)
g = 6
grid_cells = {x + y * d.nx0 for y in range(g, g + ROWS) for x in range(g, g + COLS)}
check(
    "every answer endpoint is a grid cell",
    all(int(i) in grid_cells for e in d.answer[1] for i in e.split(",")[:2]),
)

# The abbreviation table escapes `z` first, so a `z` in the text survives it
# and so does a token-shaped one.
tricky = 'zebra "line" zL null zO "z9"'
packed = penpa.abbreviate(tricky)
check(
    "a z and a token-shaped text survive abbreviation",
    packed != tricky and unabbreviate(packed) == tricky,
)

# Exact answer text for a 2x2 ring: board 6x6, padded width 10, grid at 6.
ring = frozenset(
    [((0, 0), (0, 1)), ((0, 0), (1, 0)), ((0, 1), (1, 1)), ((1, 0), (1, 1))]
)
ring_link = Decoded(penpa.link(2, 2, ring))
check(
    "a 2x2 ring's answer is exactly its four sorted index pairs",
    ring_link.answer
    == [[], ["66,67,1", "66,76,1", "67,77,1", "76,77,1"], [], [], [], []],
)

# --- The blank-clue option: a fifth row and column, outside the cross
five = Decoded(penpa.link(ROWS, COLS, BLOCK, blank_clue=True))
check("the blank option adds a fifth strip: board 9x9", (five.nx, five.ny) == (9, 9))
order5 = [network.KIND_NAMES.index(k) for k in ["blank", *RULED]]
b_rows, b_cols = clues_of(five, 5, ROWS, COLS)
check(
    "five clues each way, blank outermost, counts right",
    b_rows == [[numbers_in[0][r][k] for k in order5] for r in range(ROWS)]
    and b_cols == [[numbers_in[1][c][k] for k in order5] for c in range(COLS)],
)
check(
    "blank counts re-derived by degree through the five-strip layout",
    (b_rows, b_cols) == kind_counts(edges_of(five, 5), ROWS, COLS, ["blank", *RULED]),
)
check(
    "the fifth strip has a blank icon and the turn icon is shared",
    len(five.number) == 5 * 8 + 2 and len(five.symbol) == 7,
)
check("the answer edges are unchanged by the option", edges_of(five, 5) == BLOCK)
check("the option is off by default", len(d.number) == 32)

# A non-square board: 3 rows by 5 columns.
wide = Decoded(penpa.link(3, 5, BLOCK))
check("a 3x5 board has a 9 by 7 table", (wide.nx, wide.ny) == (9, 7))
w_rows, w_cols = clues_of(wide, 4, 3, 5)
w_in = network.outside_numbers(BLOCK, 3, 5)
check(
    "a 3x5 board's clues and answer round-trip",
    w_rows == [[w_in[0][r][k] for k in order] for r in range(3)]
    and w_cols == [[w_in[1][c][k] for k in order] for c in range(5)]
    and edges_of(wide, 4) == BLOCK,
)

# A link written twice is the same text.
check("encoding is deterministic", penpa.link(ROWS, COLS, BLOCK) == url)


# --- The `links` subcommand, over a fresh hunt: no link on stdout or stderr
def run_cli(*args):
    return subprocess.run(
        [sys.executable, str(FINDER), *args],
        capture_output=True,
        text=True,
        env=success_env(),
    )


with tempfile.TemporaryDirectory() as tmp:
    out = Path(tmp) / "hunt"
    r = run_cli(
        "--rows",
        "4",
        "--cols",
        "4",
        "--exactly",
        "2:cross:r2",
        "--timeout",
        "10",
        "--out",
        str(out),
        "--seeds=0:8",
        "--workers",
        "1",
    )
    check(f"a short hunt exits 0 ({r.stderr[-300:]})", r.returncode == 0)
    records = [
        json.loads(line)
        for line in (out / "examples.jsonl").read_text().splitlines()
        if line
    ]
    seeds = [
        e["seed"]
        for e in (
            json.loads(line)
            for line in (out / "progress.jsonl").read_text().splitlines()
            if line
        )
        if e.get("outcome") == "example"
    ]
    check(f"the hunt found examples ({len(records)})", len(records) >= 2)

    r = run_cli("links", str(out))
    check(f"`links` exits 0 ({r.stderr[-300:]})", r.returncode == 0)
    check(
        "`links` prints no link: under 500 characters on stdout and stderr",
        len(r.stdout) + len(r.stderr) < 500 and "penpa-edit" not in r.stdout + r.stderr,
    )
    names = sorted(p.name for p in (out / "links").glob("*.txt"))
    check(
        "one link file per example, named by seed",
        names == sorted(f"{s}.txt" for s in seeds),
    )
    good = True
    for seed, rec in zip(seeds, records, strict=True):
        got = Decoded((out / "links" / f"{seed}.txt").read_text().strip())
        net = frozenset(
            tuple(map(tuple, edge))
            for edge in (
                [
                    ((r_, c), (r_, c + 1))
                    for r_, bits in enumerate(rec["h"])
                    for c, b in enumerate(bits)
                    if b == "1"
                ]
                + [
                    ((r_, c), (r_ + 1, c))
                    for r_, bits in enumerate(rec["v"])
                    for c, b in enumerate(bits)
                    if b == "1"
                ]
            )
        )
        rows_, cols_ = clues_of(got, 4, 4, 4)
        want = network.outside_numbers(net, 4, 4)
        good &= edges_of(got, 4) == net
        good &= rows_ == [[want[0][r_][k] for k in order] for r_ in range(4)]
        good &= cols_ == [[want[1][c][k] for k in order] for c in range(4)]
    check("every hunt link decodes to its record's numbers and edges", good)

    r = run_cli("links", str(out), "--blank-clue")
    check("`links --blank-clue` exits 0", r.returncode == 0)
    first = Decoded((out / "links" / f"{seeds[0]}.txt").read_text().strip())
    check("`--blank-clue` writes the five-strip board", (first.nx, first.ny) == (9, 9))

    r = run_cli("links", str(Path(tmp) / "nowhere"))
    check("`links` on a missing directory exits 2", r.returncode == 2)

sys.exit(0 if ok else 1)
