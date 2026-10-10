"""A second uniqueness check for U-Bahn, on PySAT with CaDiCaL (#776).

A prototype beside `model.py`, which stays the reference. One boolean per
edge, as there; each cell's kind is channelled from its arms by clauses, and
the outside numbers are cardinality constraints. Connectivity is not encoded:
the solver hands each full assignment to `_Connectivity.check_model`, which
flood fills it and, when the network is in several parts, gives back one
clause per part. The solver keeps those clauses, so the second solve of a
uniqueness check starts with every cut the first one learned.

    docs/research/2026-10-10-u-bahn-optimization-queue.md,
    section "PySAT with lazy connectivity cuts"
"""

import sys
import time
from itertools import product
from pathlib import Path

from pysat.card import CardEnc
from pysat.engines import Propagator
from pysat.formula import IDPool
from pysat.solvers import Cadical195

sys.path.insert(0, str(Path(__file__).resolve().parent))
from network import BLANK, KINDS, all_edges, arm_edges, kind_of

# CaDiCaL takes no wall-clock limit and cannot be interrupted through PySAT,
# so a solve runs in slices of this many conflicts with the clock read
# between them.
CONFLICTS_PER_SLICE = 2000


class _Connectivity(Propagator):
    """The lazy connectivity check: it sees full assignments only."""

    def __init__(self, edge, blank):
        super().__init__()
        self.is_lazy = True
        self.edge = edge
        self.blank = blank
        self.pending = []
        self.cuts = 0

    def check_model(self, model):
        true = {lit for lit in model if lit > 0}
        on = {e for e, var in self.edge.items() if var in true}
        parts = _parts(on)
        if len(parts) <= 1:
            return True
        for part in parts:
            # A used cell of this part and one outside it are joined only
            # if some edge leaves the part.
            inside = min(part)
            outside = min(
                cell for other in parts if other is not part for cell in other
            )
            leaving = [
                var for (a, b), var in self.edge.items() if (a in part) != (b in part)
            ]
            self.pending.append([self.blank[inside], self.blank[outside], *leaving])
        self.cuts += len(parts)
        return False

    def add_clause(self):
        return self.pending.pop() if self.pending else []

    def on_assignment(self, lit, fixed=False):
        pass

    def on_new_level(self):
        pass

    def on_backtrack(self, to):
        pass

    def provide_reason(self, lit):
        return []


def _parts(on):
    """The connected parts of a set of edges, each a set of cells."""
    neighbours = {}
    for a, b in on:
        neighbours.setdefault(a, []).append(b)
        neighbours.setdefault(b, []).append(a)
    parts, seen = [], set()
    for start in neighbours:
        if start in seen:
            continue
        part, stack = set(), [start]
        while stack:
            cell = stack.pop()
            if cell in part:
                continue
            part.add(cell)
            stack.extend(neighbours[cell])
        seen |= part
        parts.append(part)
    return parts


def _piece_clauses(edge, kind, cells):
    """Each cell's kind channelled from its arms: every assignment of the
    arms that are on the board either is a dead end, and is forbidden, or
    fixes all five kind booleans."""
    clauses = []
    for cell in cells:
        arm_vars = [edge.get(e) for e in arm_edges(cell)]
        on_board = [i for i, var in enumerate(arm_vars) if var is not None]
        for bits in product((0, 1), repeat=len(on_board)):
            arms = [0, 0, 0, 0]
            for i, bit in zip(on_board, bits, strict=True):
                arms[i] = bit
            unless = [
                -arm_vars[i] if bit else arm_vars[i]
                for i, bit in zip(on_board, bits, strict=True)
            ]
            made = kind_of(arms)
            if made is None:
                clauses.append(unless)
                continue
            clauses.extend(
                [*unless, kind[cell, k] if k == made else -kind[cell, k]] for k in KINDS
            )
    return clauses


def _solve(solver, deadline):
    """True, False, or None when the clock ran out first."""
    while time.monotonic() < deadline:
        solver.conf_budget(CONFLICTS_PER_SLICE)
        answer = solver.solve_limited()
        if answer is not None:
            return answer
    return None


def uniqueness(rows, cols, numbers, *, time_limit):
    """Whether one full set of outside numbers has exactly one network.

    Returns `(status, network, cuts)`. `status` and `network` are as
    `model.uniqueness` returns them, without "invalid"; `cuts` is how many
    connectivity clauses the check added. A timeout is never unique.
    """
    deadline = time.monotonic() + time_limit
    pool = IDPool()
    cells = [(r, c) for r in range(rows) for c in range(cols)]
    edge = {e: pool.id(e) for e in all_edges(rows, cols)}
    kind = {(cell, k): pool.id((cell, k)) for cell in cells for k in KINDS}

    connectivity = _Connectivity(edge, {cell: kind[cell, BLANK] for cell in cells})
    with Cadical195() as solver:
        solver.connect_propagator(connectivity)
        for var in (*edge.values(), *connectivity.blank.values()):
            solver.observe(var)
        solver.append_formula(_piece_clauses(edge, kind, cells))
        solver.add_clause(list(edge.values()))
        row_numbers, col_numbers = numbers
        lines = [
            ([(r, c) for c in range(cols)], counts)
            for r, counts in enumerate(row_numbers)
        ] + [
            ([(r, c) for r in range(rows)], counts)
            for c, counts in enumerate(col_numbers)
        ]
        for line, counts in lines:
            for k, count in zip(KINDS, counts, strict=True):
                solver.append_formula(
                    CardEnc.equals(
                        [kind[cell, k] for cell in line], bound=count, vpool=pool
                    )
                )

        answer = _solve(solver, deadline)
        if answer is None:
            return "timeout", None, connectivity.cuts
        if not answer:
            return "infeasible", None, connectivity.cuts
        true = {lit for lit in solver.get_model() if lit > 0}
        found = frozenset(e for e, var in edge.items() if var in true)
        solver.add_clause([-var if e in found else var for e, var in edge.items()])
        answer = _solve(solver, deadline)
        status = {None: "timeout", False: "unique", True: "not_unique"}[answer]
        return status, found, connectivity.cuts
