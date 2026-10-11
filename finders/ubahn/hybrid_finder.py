"""The hybrid finder on the shared hunt protocol (#783): U-Bahn with
Choco-Banana laid over the grid cells and the number cells (spec #781).

Conditions in, valid hybrid grids out, one per seed, repeats removed. The
model is built from the conditions and solved once per seed, steered by the
seed (on cpsat its own random order and direction over the edges, on the
PySAT engines its own random first guess for each edge); nothing is sampled
first and thrown away. The solver is given no outside number. `verify` re-reads every grid
with `hybrid.py`, which states the rules with no solver.

Conditions are flags:

    --circles "CELL CELL ..."  circled cells: each one's value is the size of
                               its region. A grid cell is rKcK, a number cell
                               rK:PIECE or cK:PIECE (r6:straight, c1:turn).
    --exactly N:PIECE:rK       exactly N of a piece in a row (or cK, a
                               column); PIECE is turn, straight, branch,
                               cross or blank.
    --blank-strip              a fifth strip of number cells, for blank,
                               outside the cross. Off unless given.
    --number-circles K         at least K valid circles on number cells: K
                               or more number cells whose value is the size
                               of their region. A grid cell that is a valid
                               circle counts for nothing (#794).
    --engine pysat-lazy        the solver the rules are written on: cpsat
                               (`hybrid_model.py`, connectivity as a flow),
                               pysat-lazy (`hybrid_sat.py`, a grid whose
                               network is in several parts is cut and the
                               solve goes on) or pysat-propagator (the same
                               clauses, with a propagator that refuses a
                               network broken apart before the grid is
                               full). pysat-lazy unless given.
    --timeout SECONDS          the limit on one solve, 60 unless given.
                               `classify` makes up to two solves: on cpsat
                               each has the whole limit, on the PySAT
                               engines one limit covers both.

    uv run finders/ubahn/hybrid_finder.py --out DIR --seeds 0:50 --workers 1 \\
        --rows 7 --cols 7 \\
        --circles "r6:straight r6:turn r7:straight r7:turn"
    uv run finders/ubahn/hybrid_finder.py verify DIR

`classify` takes the same conditions and says whether they have no grid,
exactly one, or more than one, in the uniqueness check's words, with the
first grid found drawn under the answer:

    uv run finders/ubahn/hybrid_finder.py classify --rows 4 --cols 4 \\
        --circles "c1:turn r2c4" [--workers 1]

`--workers` is cpsat's: the PySAT engines run on one thread whatever it says.

    infeasible: no grid
    unique: exactly one grid
    not_unique: more than one grid
    timeout: time limit reached

A time limit reached is always `timeout`, never one of the other three.

`climb` raises K in `--number-circles K` until no grid reaches it (#794). It
starts at `--from K` (0 unless given), hunts one seed (`--seed N`, 0 unless
given) for a grid with at least K, counts the grid's valid circles on number
cells with the rule reader, and asks next for one more than that count. Each
step is a hunt directory of its own, `DIR/at-least-K`, which `verify` and
`render` read, and a line of `DIR/climb.jsonl`, written as the step ends. It
stops at the first K with no grid, or at the first step that reaches
`--timeout`. Only the first is a proof: the maximum is called proven when "at
least one more" came back as no grid, and a time limit reached is a best
found with no proof. A rerun into the same DIR goes on from the last step
written and ignores `--from`.

    uv run finders/ubahn/hybrid_finder.py climb --rows 7 --cols 7 \
        --timeout 3600 --out DIR

    at least 0: found, 3 valid circles on number cells, 0.1 s
    at least 4: found, 4 valid circles on number cells, 0.2 s
    at least 5: infeasible, no grid, 1.5 s
    maximum 4: proven on pysat-lazy, at least 5 has no grid
    best grid: DIR/at-least-4 (seed 0)

`render DIR` draws every example of the hunt in DIR as a picture,
`DIR/renders/<seed>.png` (`hybrid_render.py`, #791): the board with every
outside number, the network, chocolate in one colour and a tint per banana,
and a ring on every valid circle, each cell whose value is the size of its
region; a circle that is one of the grid's conditions has a heavier ring in
a second colour. A rerun replaces every picture there. `--seed N --png FILE`
draws that one example to FILE instead. `--blank-strip` draws the fifth strip
on a record of a hunt that had none; a grid that is no hybrid grid on the
board drawn is refused and nothing is written.

    uv run finders/ubahn/hybrid_finder.py render DIR [--blank-strip]
    uv run finders/ubahn/hybrid_finder.py render DIR --seed N --png FILE

`links DIR` writes a Penpa+ link per example of the hunt in `DIR` to
`DIR/links/<seed>.txt` (`penpa.py`, #795): the grid with the circles and the
numbers you supply and nothing else shown, drawn in the dotted grid under the
combined rules. `--circles "CELLS"` are the cells that carry a circle, grid
cells or number cells; `--numbers "CELLS"` are the number cells whose outside
number is printed, every other number cell left empty. One set of flags
applies to every example of the directory, so a hunt run with the same
`--circles` condition makes every example carry them. With neither flag the
board shows no circle and no number. A circled number cell shows its number
only if it is also in `--numbers`. The link's answer check is the plain
link's: the drawn lines, nothing else. `--blank-strip` draws the fifth strip
on a record of a hunt that had none. A circle that is not valid on the grid
(its value is not its region's size), a number cell off the board, a grid
cell as a given number, or a grid that is no hybrid grid on the board drawn,
is refused by name and nothing is written. A rerun replaces every link there.
A link is never printed: the command reports the directory. The link does not
say whether the givens leave one solution; `classify` answers that for the
circles (it is given no outside number).

    uv run finders/ubahn/hybrid_finder.py links DIR --circles "r2c3 c1:turn" \
        --numbers "r1:cross c1:turn" [--blank-strip]

The board's one symmetry is the reflection in the main diagonal, which swaps
the row and column number cells; a left-right mirror image is another
puzzle, since the number cells sit above and on the left only. A hunt
dedupes under that reflection when the board is square, every circle's
image is circled and there is no piece-count condition, and under nothing
otherwise.

The driver's flags (`--out`, `--seeds`, `--workers`, ...) are its own
(finders/hunt/driver.py).
"""

import argparse
import json
import sys
import time
from pathlib import Path
from typing import NamedTuple

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "hunt"))
# isort: split
import hybrid
import hybrid_model
import hybrid_render
import hybrid_sat
import network
import penpa
from dedupe import IDENTITY
from driver import run, save_render_atomic
from protocol import Empty, Verdict
from ubahn_finder import (
    DEFAULT_SIDE,
    DEFAULT_TIMEOUT,
    UbahnFinder,
    replace_links,
    seeded_examples,
)
from ubahn_finder import Candidate as PlainCandidate

# Each engine offers `grid(conditions, rng, *, time_limit)`, a
# `hybrid.Sampled`, and `classify(conditions, *, time_limit, workers)`, a
# `hybrid.Classified`.
ENGINES = {
    "cpsat": hybrid_model,
    "pysat-lazy": hybrid_sat.Engine(hybrid_sat.LAZY),
    "pysat-propagator": hybrid_sat.Engine(hybrid_sat.PROPAGATOR),
}
# Chris ruled PySAT with lazy cuts the default on 2026-10-11, on the timing
# in docs/research/2026-10-10-u-bahn-optimization-queue.md (#786).
DEFAULT_ENGINE = "pysat-lazy"

# The classification's words as Chris reads them.
SAID = {
    "infeasible": "no grid",
    "unique": "exactly one grid",
    "not_unique": "more than one grid",
    "timeout": "time limit reached",
}


# Why a seed gave no grid, as `propose` says it and `climb` reads it back.
EMPTY_TIMEOUT = "timeout sampling a grid"
EMPTY_INFEASIBLE = "infeasible: no grid meets the conditions"


class Candidate(NamedTuple):
    """A found grid with the conditions it answers."""

    conditions: hybrid.Conditions
    network: frozenset


def condition_symmetry(conditions):
    """The group a grid's key (`HybridFinder.key`) dedupes under: the
    identity and the reflection in the main diagonal when that reflection
    keeps the conditions, the identity alone when it moves one. It keeps
    them on a square board whose circled cells are circled in the image too,
    with no piece-count condition, which names a row or a column. The
    reflection sends a cell's east arm to its image's south arm and back."""
    rows, cols, circles, exactly, *_ = conditions
    if rows != cols or exactly or {(c, r) for r, c in circles} != set(circles):
        return IDENTITY
    cells = rows * cols
    image = [c * cols + r for r in range(rows) for c in range(cols)]
    return [
        tuple(range(2 * cells)),
        tuple([cells + i for i in image] + image),
    ]


class HybridFinder:
    def __init__(self, conditions, engine=DEFAULT_ENGINE, timeout=DEFAULT_TIMEOUT):
        self.conditions, self.engine, self.timeout = conditions, engine, timeout
        self.symmetry = condition_symmetry(conditions)
        self.config = {
            "rows": conditions.rows,
            "cols": conditions.cols,
            "circles": sorted(map(hybrid.cell_name, conditions.circles)),
            "exactly": conditions.exactly.text() if conditions.exactly else None,
            "blank_strip": conditions.blank_strip,
            "number_circles": conditions.number_circles,
            "engine": engine,
            "timeout": timeout,
        }

    def propose(self, rng):
        status, found = ENGINES[self.engine].grid(
            self.conditions, rng, time_limit=self.timeout
        )
        if status == "timeout":
            return Empty(EMPTY_TIMEOUT)
        if status == "infeasible":
            return Empty(EMPTY_INFEASIBLE)
        if found is None:
            raise RuntimeError(f"{self.engine} answered {status!r} with no grid")
        return Candidate(self.conditions, found)

    def verify(self, candidate):
        (rows, cols, circles, exactly, blank_strip, at_least), found = candidate
        why = hybrid.why_not_hybrid(found, rows, cols, circles, blank_strip, at_least)
        if why:
            return Verdict(False, why)
        if exactly and not exactly.on_board(rows, cols):
            return Verdict(
                False, f"condition {exactly.text()} is off the {rows}x{cols} board"
            )
        if exactly and not exactly.holds(found, rows, cols):
            return Verdict(False, f"condition {exactly.text()} does not hold")
        return Verdict(True)

    def record(self, candidate):
        (rows, cols, circles, exactly, blank_strip, at_least), found = candidate
        board = hybrid.values(found, rows, cols, blank_strip)
        return {
            # The plain finder's record of the network: the board, the
            # piece-count condition, the edge rows and the outside numbers.
            **UbahnFinder().record(PlainCandidate(rows, cols, found, exactly)),
            "circles": sorted(map(hybrid.cell_name, circles)),
            "blank_strip": blank_strip,
            "number_circles": at_least,
            # The reader's own count, whatever the condition asked for.
            "number_cell_circles": [
                hybrid.cell_name(cell) for cell in hybrid.number_cell_circles(board)
            ],
            "engine": self.engine,
            "drawing": hybrid.drawing(found, rows, cols, circles, blank_strip),
        }

    def key(self, candidate):
        """The network itself: every cell's east arm, row by row, then every
        cell's south arm. Two networks can have the same kind in every cell
        and both be valid grids, so the kinds alone would drop one of them
        as a repeat."""
        (rows, cols, *_), found = candidate
        cells = [(r, c) for r in range(rows) for c in range(cols)]
        return tuple(
            int(((r, c), (r + dr, c + dc)) in found)
            for dr, dc in ((0, 1), (1, 0))
            for r, c in cells
        )

    def candidate_from_record(self, record):
        """Raises ValueError, naming it, on a circle `hybrid.parse_cell`
        refuses, anything the plain finder's reader refuses in the edge
        rows and the piece-count condition, or a field the record lacks."""
        try:
            rows, cols, found, exactly = UbahnFinder().candidate_from_record(record)
            circles = frozenset(map(hybrid.parse_cell, record["circles"]))
            conditions = hybrid.Conditions(
                rows,
                cols,
                circles,
                exactly,
                record["blank_strip"],
                # A record older than the condition (#794) asked for none.
                record.get("number_circles", 0),
            )
        except KeyError as e:
            raise ValueError(
                f"the record has no {e.args[0]!r}: no hybrid hunt wrote it"
            ) from e
        return Candidate(conditions, found)


def parse_conditions(args):
    """The `hybrid.Conditions` the flags name. Raises ValueError, naming the
    flag, on a board with no network, a cell or condition that does not
    parse, one that is off the board, or a count below 0."""
    rows, cols = args.rows, args.cols
    if rows < 2 or cols < 2:
        raise ValueError("the smallest board with a network is 2x2")
    board = set(hybrid.number_cells(rows, cols, args.blank_strip))
    circles = set()
    for name in args.circles.split():
        try:
            cell = hybrid.parse_cell(name)
        except ValueError as e:
            raise ValueError(f"--circles: {e}") from e
        r, c = cell
        if cell not in board and not (0 <= r < rows and 0 <= c < cols):
            strip = "" if args.blank_strip else ", no blank strip"
            raise ValueError(
                f"--circles names {name}, off a {rows}x{cols} board{strip}"
            )
        circles.add(cell)
    exactly = None
    if args.exactly is not None:
        try:
            exactly = network.Exactly.parse(args.exactly)
        except ValueError as e:
            raise ValueError(f"--exactly: {e}") from e
        if not exactly.on_board(rows, cols):
            raise ValueError(
                f"--exactly names {args.exactly.split(':')[2]}, "
                f"off a {rows}x{cols} board"
            )
    if args.number_circles < 0:
        raise ValueError(f"--number-circles is 0 or more, got {args.number_circles}")
    return hybrid.Conditions(
        rows, cols, frozenset(circles), exactly, args.blank_strip, args.number_circles
    )


def classify(conditions, engine, timeout, workers):
    """The lines `classify` prints: the answer, then the first grid found."""
    status, found = ENGINES[engine].classify(
        conditions, time_limit=timeout, workers=workers
    )
    lines = [f"{status}: {SAID[status]}"]
    if found is not None:
        rows, cols, circles, _, blank_strip, _ = conditions
        lines += hybrid.drawing(found, rows, cols, circles, blank_strip)
    return lines


def _step(finder, seed, out):
    """Hunt one seed into `out`, a hunt directory of its own. Returns
    `(status, count)`: "found" with the rule reader's count of the grid's
    valid circles on number cells, or "infeasible" or "timeout" with None.
    Raises ValueError when the driver refuses the hunt or the seed ends any
    other way, a grid `verify` rejected among them."""
    argv = ["--out", str(out), f"--seeds={seed}:{seed + 1}", "--workers", "1"]
    if run(finder, argv):
        raise ValueError(f"the hunt in {out} was refused")
    event = json.loads((out / "progress.jsonl").read_text().splitlines()[-1])
    if event["outcome"] == "example":
        ((_, record),) = seeded_examples(out)
        return "found", len(record["number_cell_circles"])
    status = {EMPTY_INFEASIBLE: "infeasible", EMPTY_TIMEOUT: "timeout"}.get(
        event.get("empty_reason")
    )
    if event["outcome"] != "empty" or status is None:
        raise ValueError(f"the hunt in {out} ended on {event}")
    return status, None


def climb(conditions, engine, timeout, out, start=0, seed=0):
    """Raise K in "at least K valid circles on number cells" from `start`
    until no grid reaches it or a step reaches the time limit, printing each
    step as it ends and then the answer. Each step is a hunt of one seed in
    `out/at-least-K` and a line of `out/climb.jsonl`; a rerun goes on from
    the last line written. Raises ValueError on a step `_step` refuses, or
    when `out` holds a climb under another board, engine, seed or limit."""
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    log = out / "climb.jsonl"
    asked = {
        **HybridFinder(conditions, engine, timeout).config,
        "number_circles": None,
        "seed": seed,
    }
    steps = []
    if log.is_file():
        steps = [json.loads(line) for line in log.read_text().splitlines() if line]
    if steps and steps[0]["config"] != asked:
        raise ValueError(f"{out} holds a climb under {steps[0]['config']}")

    def say(step):
        k, status = step["at_least"], step["status"]
        what = (
            f"{step['count']} valid circles on number cells"
            if status == "found"
            else SAID[status]
        )
        print(f"at least {k}: {status}, {what}, {step['seconds']} s", flush=True)

    for step in steps:
        say(step)
    while not steps or steps[-1]["status"] == "found":
        k = steps[-1]["count"] + 1 if steps else start
        began = time.monotonic()
        finder = HybridFinder(conditions._replace(number_circles=k), engine, timeout)
        status, count = _step(finder, seed, out / f"at-least-{k}")
        steps.append(
            {
                "at_least": k,
                "status": status,
                "count": count,
                "seconds": round(time.monotonic() - began, 1),
                "dir": f"at-least-{k}",
                "config": asked,
            }
        )
        with log.open("a") as f:
            f.write(json.dumps(steps[-1]) + "\n")
        say(steps[-1])
    *found, last = steps
    proven = last["status"] == "infeasible"
    stopped = (
        f"at least {last['at_least']} "
        f"{'has no grid' if proven else 'reached the time limit'}"
    )
    if not found:
        print(f"no grid found: {stopped} on {engine}")
        return
    best = found[-1]
    if proven:
        print(f"maximum {best['count']}: proven on {engine}, {stopped}")
    else:
        print(f"best found {best['count']}: not proven, {stopped} on {engine}")
    print(f"best grid: {out / best['dir']} (seed {seed})")


def write_pictures(out, blank_strip=False, seed=None, png=None):
    """Draw the examples of the hunt in `out`, each under its seed
    (`ubahn_finder.seeded_examples`): all of them to `out/renders/<seed>.png`,
    or the one at `seed` to `png`. The fifth strip is drawn when
    `blank_strip` is set or the record's own is. Returns the lines to print.
    Raises ValueError, naming the seed, on a record the finder refuses or a
    grid `hybrid_render.Picture` refuses, and names a missing or unpaired
    log or a seed with no example."""
    out = Path(out)
    examples = seeded_examples(out)
    if seed is not None:
        examples = [(s, record) for s, record in examples if s == seed]
        if not examples:
            raise ValueError(f"seed {seed} has no example in {out}")
    finder = HybridFinder(hybrid.Conditions(DEFAULT_SIDE, DEFAULT_SIDE))
    # Every picture is drawn before any file is touched: a grid that is
    # refused leaves renders/ as it was.
    drawn = {}
    for s, record in examples:
        try:
            conditions, found = finder.candidate_from_record(record)
            rows, cols, circles, _, own, _ = conditions
            drawn[s] = hybrid_render.Picture(
                found, rows, cols, circles, blank_strip or own
            ).image
        except ValueError as e:
            raise ValueError(f"seed {s}: {e}") from e
    if seed is not None:
        save_render_atomic(drawn[seed], Path(png))
        return [f"wrote the picture of seed {seed} to {png}"]
    renders = out / "renders"
    renders.mkdir(exist_ok=True)
    for s, image in drawn.items():
        save_render_atomic(image, renders / f"{s}.png")
    # A rerun replaces the whole set, so a picture left by an earlier
    # example list never stays.
    for stale in renders.glob("*.png"):
        if stale.name not in {f"{s}.png" for s in drawn}:
            stale.unlink()
    return [f"wrote {len(drawn)} pictures to {renders}"]


def parse_cells(flag, text):
    """The cells `text` names, a frozenset. Raises ValueError, naming the
    flag, on a name `hybrid.parse_cell` refuses."""
    try:
        return frozenset(map(hybrid.parse_cell, text.split()))
    except ValueError as e:
        raise ValueError(f"{flag}: {e}") from e


def write_links(out, circles, numbers, blank_strip):
    """Write `out/links/<seed>.txt`, one Penpa+ link per example of the hunt
    in `out` (`ubahn_finder.seeded_examples`), showing the `circles` and the
    `numbers` given and no other circle or number. The fifth strip is drawn
    when `blank_strip` is set or the record's own is. Returns the lines to
    print. Raises ValueError, naming the seed and the cell, on a record the
    finder refuses, a circle or number that is not on the board, a circle that
    is not valid, or a grid that is no hybrid grid on the board drawn; names a
    missing or unpaired log."""
    out = Path(out)
    examples = seeded_examples(out)
    finder = HybridFinder(hybrid.Conditions(DEFAULT_SIDE, DEFAULT_SIDE))
    # Every link is built before any file is touched: a refusal leaves
    # links/ as it was, and a rerun replaces the whole set.
    built = {}
    for s, record in examples:
        try:
            (rows, cols, _, _, own), found = finder.candidate_from_record(record)
            strip = blank_strip or own
            board = hybrid.number_cells(rows, cols, strip)
            for cell in sorted(circles):
                r, c = cell
                if cell not in board and not (0 <= r < rows and 0 <= c < cols):
                    raise ValueError(
                        f"circle {hybrid.cell_name(cell)} is off the "
                        f"{rows}x{cols} board" + ("" if strip else ", no blank strip")
                    )
            for cell in sorted(numbers):
                if cell not in board:
                    raise ValueError(
                        f"given number {hybrid.cell_name(cell)} is not a number "
                        f"cell of the {rows}x{cols} board"
                        + ("" if strip else ", no blank strip")
                    )
            reasons = hybrid.failures(found, rows, cols, circles, strip)
            if reasons:
                raise ValueError("; ".join(reasons))
            shown = penpa.Hybrid(circles, numbers)
            built[s] = penpa.link(rows, cols, found, strip, shown) + "\n"
        except ValueError as e:
            raise ValueError(f"seed {s}: {e}") from e
    links = replace_links(out, built)
    return [
        f"wrote {len(built)} links to {links}, {len(circles)} circles and "
        f"{len(numbers)} numbers given"
    ]


def main(argv):
    if argv[:1] in (["-h"], ["--help"]):
        print(__doc__)
        return 0
    parser = argparse.ArgumentParser(prog="hybrid_finder", add_help=False)
    parser.add_argument("--rows", type=int, default=DEFAULT_SIDE)
    parser.add_argument("--cols", type=int, default=DEFAULT_SIDE)
    parser.add_argument("--circles", default="", metavar="CELLS")
    parser.add_argument("--numbers", default="", metavar="CELLS")
    parser.add_argument("--exactly", metavar="N:PIECE:rK")
    parser.add_argument("--blank-strip", action="store_true")
    parser.add_argument("--number-circles", type=int, default=0, metavar="K")
    parser.add_argument("--engine", default=DEFAULT_ENGINE, choices=ENGINES)
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT)
    own, rest = parser.parse_known_args(argv)
    if own.numbers and rest[:1] != ["links"]:
        print("hybrid_finder: --numbers is for `links` only", file=sys.stderr)
        return 2
    if rest[:1] == ["verify"]:
        # A record carries its own board and conditions, and `verify` runs
        # no solver.
        return run(HybridFinder(hybrid.Conditions(own.rows, own.cols)), rest)
    if rest[:1] == ["render"]:
        # A record carries its own board and conditions too; `--blank-strip`
        # is the one flag of the finder's own that `render` reads.
        mine = argparse.ArgumentParser(prog="hybrid_finder render")
        mine.add_argument("dir")
        mine.add_argument("--seed", type=int)
        mine.add_argument("--png", metavar="FILE")
        args = mine.parse_args(rest[1:])
        try:
            if (args.seed is None) != (args.png is None):
                raise ValueError(
                    "--seed N and --png FILE go together: "
                    + (
                        "--seed needs --png"
                        if args.png is None
                        else "--png needs --seed"
                    )
                )
            lines = write_pictures(args.dir, own.blank_strip, args.seed, args.png)
        except ValueError as e:
            print(f"hybrid_finder render: {e}", file=sys.stderr)
            return 2
        print("\n".join(lines))
        return 0
    if rest[:1] == ["links"]:
        # A record carries its own board; `--circles`, `--numbers` and
        # `--blank-strip` are what the link shows.
        mine = argparse.ArgumentParser(prog="hybrid_finder links")
        mine.add_argument("dir")
        args = mine.parse_args(rest[1:])
        try:
            lines = write_links(
                args.dir,
                parse_cells("--circles", own.circles),
                parse_cells("--numbers", own.numbers),
                own.blank_strip,
            )
        except ValueError as e:
            print(f"hybrid_finder links: {e}", file=sys.stderr)
            return 2
        print("\n".join(lines))
        return 0
    try:
        conditions = parse_conditions(own)
    except ValueError as e:
        print(f"hybrid_finder: {e}", file=sys.stderr)
        return 2
    if rest[:1] == ["classify"]:
        mine = argparse.ArgumentParser(prog="hybrid_finder classify")
        mine.add_argument("--workers", type=int, default=1)
        workers = mine.parse_args(rest[1:]).workers
        print("\n".join(classify(conditions, own.engine, own.timeout, workers)))
        return 0
    if rest[:1] == ["climb"]:
        mine = argparse.ArgumentParser(prog="hybrid_finder climb")
        mine.add_argument("--out", required=True, metavar="DIR")
        mine.add_argument("--from", type=int, default=0, dest="start", metavar="K")
        mine.add_argument("--seed", type=int, default=0)
        args = mine.parse_args(rest[1:])
        try:
            climb(conditions, own.engine, own.timeout, args.out, args.start, args.seed)
        except ValueError as e:
            print(f"hybrid_finder climb: {e}", file=sys.stderr)
            return 2
        return 0
    return run(HybridFinder(conditions, own.engine, own.timeout), rest)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
