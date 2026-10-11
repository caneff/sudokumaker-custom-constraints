"""The hybrid finder on the shared hunt protocol (#783): U-Bahn with
Choco-Banana laid over the grid cells and the number cells (spec #781).

Conditions in, valid hybrid grids out, one per seed, repeats removed. The
model is built from the conditions and solved once per seed, steered by the
seed's own random order over the edges; nothing is sampled first and thrown
away. The solver is given no outside number. `verify` re-reads every grid
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
    --engine pysat-lazy        the solver the rules are written on: cpsat
                               (`hybrid_model.py`, connectivity as a flow),
                               pysat-lazy (`hybrid_sat.py`, a grid whose
                               network is in several parts is cut and the
                               solve goes on) or pysat-propagator (the same
                               clauses, with a propagator that refuses a
                               network broken apart before the grid is
                               full). pysat-lazy unless given.
    --timeout SECONDS          the limit on one solve, 60 unless given.

    uv run finders/ubahn/hybrid_finder.py --out DIR --seeds 0:50 --workers 1 \\
        --rows 7 --cols 7 \\
        --circles "r6:straight r6:turn r7:straight r7:turn"
    uv run finders/ubahn/hybrid_finder.py verify DIR

`classify` takes the same conditions and says whether they have no grid,
exactly one, or more than one, in the uniqueness check's words, with the
first grid found drawn under the answer:

    uv run finders/ubahn/hybrid_finder.py classify --rows 4 --cols 4 \\
        --circles "c1:turn r2c4" [--workers 1]

    infeasible: no grid
    unique: exactly one grid
    not_unique: more than one grid
    timeout: time limit reached

A time limit reached is always `timeout`, never one of the other three.

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
import sys
from pathlib import Path
from typing import NamedTuple

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "hunt"))
# isort: split
import hybrid
import hybrid_model
import hybrid_sat
import network
from dedupe import IDENTITY
from driver import run
from protocol import Empty, Verdict
from ubahn_finder import DEFAULT_SIDE, DEFAULT_TIMEOUT, UbahnFinder
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


class Candidate(NamedTuple):
    """A found grid with the conditions it answers."""

    conditions: hybrid.Conditions
    network: frozenset


def condition_symmetry(conditions):
    """The group a grid of kinds dedupes under: the identity and the
    reflection in the main diagonal when that reflection keeps the
    conditions, the identity alone when it moves one. It keeps them on a
    square board whose circled cells are circled in the image too, with no
    piece-count condition, which names a row or a column."""
    rows, cols, circles, exactly, _ = conditions
    if rows != cols or exactly or {(c, r) for r, c in circles} != set(circles):
        return IDENTITY
    return [
        tuple(range(rows * cols)),
        tuple(c * cols + r for r in range(rows) for c in range(cols)),
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
            "engine": engine,
            "timeout": timeout,
        }

    def propose(self, rng):
        status, found = ENGINES[self.engine].grid(
            self.conditions, rng, time_limit=self.timeout
        )
        if status == "timeout":
            return Empty("timeout sampling a grid")
        if status == "infeasible":
            return Empty("infeasible: no grid meets the conditions")
        return Candidate(self.conditions, found)

    def verify(self, candidate):
        (rows, cols, circles, exactly, blank_strip), found = candidate
        why = hybrid.why_not_hybrid(found, rows, cols, circles, blank_strip)
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
        (rows, cols, circles, exactly, blank_strip), found = candidate
        return {
            # The plain finder's record of the network: the board, the
            # piece-count condition, the edge rows and the outside numbers.
            **UbahnFinder().record(PlainCandidate(rows, cols, found, exactly)),
            "circles": sorted(map(hybrid.cell_name, circles)),
            "blank_strip": blank_strip,
            "engine": self.engine,
            "drawing": hybrid.drawing(found, rows, cols, circles, blank_strip),
        }

    def key(self, candidate):
        conditions, found = candidate
        return network.kind_grid(found, conditions.rows, conditions.cols)

    def candidate_from_record(self, record):
        """Raises ValueError, naming it, on a circle `hybrid.parse_cell`
        refuses or anything the plain finder's reader refuses in the edge
        rows and the piece-count condition."""
        rows, cols, found, exactly = UbahnFinder().candidate_from_record(record)
        circles = frozenset(map(hybrid.parse_cell, record["circles"]))
        conditions = hybrid.Conditions(
            rows, cols, circles, exactly, record["blank_strip"]
        )
        return Candidate(conditions, found)


def parse_conditions(args):
    """The `hybrid.Conditions` the flags name. Raises ValueError, naming the
    flag, on a board with no network, a cell or condition that does not
    parse, or one that is off the board."""
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
    return hybrid.Conditions(rows, cols, frozenset(circles), exactly, args.blank_strip)


def classify(conditions, engine, timeout, workers):
    """The lines `classify` prints: the answer, then the first grid found."""
    status, found = ENGINES[engine].classify(
        conditions, time_limit=timeout, workers=workers
    )
    lines = [f"{status}: {SAID[status]}"]
    if found is not None:
        rows, cols, circles, _, blank_strip = conditions
        lines += hybrid.drawing(found, rows, cols, circles, blank_strip)
    return lines


def main(argv):
    if argv[:1] in (["-h"], ["--help"]):
        print(__doc__)
        return 0
    parser = argparse.ArgumentParser(prog="hybrid_finder", add_help=False)
    parser.add_argument("--rows", type=int, default=DEFAULT_SIDE)
    parser.add_argument("--cols", type=int, default=DEFAULT_SIDE)
    parser.add_argument("--circles", default="", metavar="CELLS")
    parser.add_argument("--exactly", metavar="N:PIECE:rK")
    parser.add_argument("--blank-strip", action="store_true")
    parser.add_argument("--engine", default=DEFAULT_ENGINE)
    parser.add_argument("--timeout", type=float, default=DEFAULT_TIMEOUT)
    own, rest = parser.parse_known_args(argv)
    if rest[:1] == ["verify"]:
        # A record carries its own board and conditions, and `verify` runs
        # no solver.
        return run(HybridFinder(hybrid.Conditions(own.rows, own.cols)), rest)
    try:
        if own.engine not in ENGINES:
            raise ValueError(
                f"--engine: no engine named {own.engine!r}: {', '.join(ENGINES)}"
            )
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
    return run(HybridFinder(conditions, own.engine, own.timeout), rest)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
