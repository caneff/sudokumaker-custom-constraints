"""Dutch Chocolate Banabner as one CP-SAT model: shading and digits together.

The rules (spec #758): normal sudoku; a chocolate/banana shading; every
chocolate group a rectangle, every banana group not; orthogonally adjacent
chocolate digits differ by >= 4 (Dutch Chocolate); no two digits of a banana
group equal or consecutive (nabner). `renbanana_verify.check` with
`difference=4, banana_rule="nabner"` is the separate checker.

The shading is an exact cover. A nabner group holds at most five digits (only
five of 1-9 are pairwise non-consecutive), and one or two cells always form a
rectangle, so a banana group is a non-rectangular polyomino of 3-5 cells:
the L-tromino, the four non-rectangular tetrominoes and the eleven non-I
pentominoes, in every rotation and reflection (`BANANA_SHAPES`). Each banana
cell lies in exactly one placed polyomino, every cell bordering a placed one is
chocolate, and every other cell is chocolate. So the banana rules hold by
construction: no cut loop, no labels.

Each placement carries a table over its digits: the 35 pairwise
non-consecutive 3-sets, the 15 such 4-sets, or {1,3,5,7,9}.

Chocolate reads the difference-4 rectangle catalogue (`finders/AGENTS.md`)
twice: a placement the catalogue cannot fill where it sits is forbidden as a
maximal chocolate group (the shading side), and a placed rectangle's cells take
the catalogue's per-cell digit support (the digit side).

Every piece is exact or a relaxation, so an INFEASIBLE from the model is a
proof that no grid exists.
"""

import functools
import itertools
import sys
from pathlib import Path

from ortools.sat.python import cp_model as cp

FINDERS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(FINDERS))
import renbanana_model as rm
import renbanana_verify as rv
from renbanana_model import CELLS, N

DIFFERENCE = 4

# No chocolate rectangle has a side longer than 4 (Chris, #761). A side of
# length >= 5 off the board edge borders >= 5 banana cells in a straight line,
# all in one banana group: five in a line is the I-pentomino, a rectangle, and
# more than five breaks nabner. So such a side lies on the board edge, which
# forces the rectangle to be the whole 9x9 board -- and the difference-4
# catalogue fills 9x9 zero ways (as does any size circle, needing the digit
# 81). A fact of the rules, not a search cap.
MAX_CHOC_SIDE = 4

CATALOGUE = rm.load_catalogue(DIFFERENCE)


def _normalise(cells):
    r0 = min(r for r, _ in cells)
    c0 = min(c for _, c in cells)
    return tuple(sorted((r - r0, c - c0) for r, c in cells))


def _fixed_polyominoes(size):
    """Every fixed polyomino of `size` cells (rotations and reflections are
    separate shapes), each a sorted tuple of (r, c) offsets from (0, 0)."""
    shapes = {((0, 0),)}
    for _ in range(size - 1):
        shapes = {
            _normalise((*s, (r + dr, c + dc)))
            for s in shapes
            for r, c in s
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1))
            if (r + dr, c + dc) not in s
        }
    return shapes


BANANA_SHAPES = sorted(
    s
    for size in (3, 4, 5)
    for s in _fixed_polyominoes(size)
    if not rv.is_rectangle(list(s))
)


def _nabner_sets(size):
    return [
        s
        for s in itertools.combinations(range(1, 10), size)
        if all(b - a >= 2 for a, b in itertools.pairwise(s))
    ]


NABNER_SETS = {size: _nabner_sets(size) for size in (3, 4, 5)}


@functools.cache
def nabner_tuples(size):
    """Every ordered filling of a `size`-cell banana: a permutation of one of
    the pairwise non-consecutive `size`-sets."""
    return [p for s in NABNER_SETS[size] for p in itertools.permutations(s)]


def banana_placements():
    """Every placement of every banana shape on the board, as a tuple of cells."""
    return [
        tuple((r0 + r, c0 + c) for r, c in shape)
        for shape in BANANA_SHAPES
        for r0 in range(N - max(r for r, _ in shape))
        for c0 in range(N - max(c for _, c in shape))
    ]


PLACEMENTS = banana_placements()


def chocolate_placements(max_side=MAX_CHOC_SIDE):
    """Every chocolate rectangle placement with both sides <= `max_side`, as
    (h, w, r0, c0)."""
    return [p for p in rm.PLACEMENTS if max(p[0], p[1]) <= max_side]


class Model:
    """The joint model. `choc[p]`, `d[p]` and `x[i]` (placement i of
    `PLACEMENTS` is a banana group) are the decision variables."""

    def __init__(self, max_side=MAX_CHOC_SIDE):
        m = cp.CpModel()
        self.m = m
        self.max_side = max_side
        self.d = {p: m.new_int_var(1, 9, f"d{p}") for p in CELLS}
        self.choc = {p: m.new_bool_var(f"c{p}") for p in CELLS}
        self.x = [m.new_bool_var(f"x{i}") for i in range(len(PLACEMENTS))]
        rm.sudoku(m, self.d)
        self._bananas()
        self._chocolate()

    def _bananas(self):
        m, x = self.m, self.x
        covering = {p: [] for p in CELLS}
        for i, cells in enumerate(PLACEMENTS):
            for p in cells:
                covering[p].append(x[i])
            # Every cell bordering a placed banana is chocolate: two placements
            # never touch, so each banana group is exactly one placement.
            for q in rm.border_of_cells(cells):
                m.add_implication(x[i], self.choc[q])
            m.add_allowed_assignments(
                [self.d[p] for p in cells], nabner_tuples(len(cells))
            ).only_enforce_if(x[i])
        for p in CELLS:
            m.add(sum(covering[p]) + self.choc[p] == 1)

    def _chocolate(self):
        m, choc, d = self.m, self.choc, self.d
        rm.rectangle_lemma(m, choc)
        rm.whisper(m, d, choc, DIFFERENCE)
        # No chocolate run longer than `max_side` in any row or column.
        run = self.max_side + 1
        for i in range(N):
            for j in range(N - run + 1):
                m.add(sum(choc[i, j + k] for k in range(run)) <= self.max_side)
                m.add(sum(choc[j + k, i] for k in range(run)) <= self.max_side)
        # The catalogue, shading side: a placement it cannot fill is forbidden.
        rm.forbid_dead_chocolate(
            m,
            choc,
            lambda a, b, r, c: (
                max(a, b) <= self.max_side
                and not rm.catalogue_fact(CATALOGUE, a, b, r % 3, c % 3)["count"]
            ),
        )
        # The catalogue, digit side: a maximal rectangle's cells take its
        # per-cell support. The spot is reified both ways, since the domains
        # must hold whenever the rectangle is there.
        for a, b, r0, c0 in chocolate_placements(self.max_side):
            fact = rm.catalogue_fact(CATALOGUE, a, b, r0 % 3, c0 % 3)
            if not fact["count"]:
                continue
            lits = rm.maximal_chocolate_lits(choc, a, b, r0, c0)
            here = m.new_bool_var(f"p{a}x{b}@{r0},{c0}")
            m.add_bool_and(lits).only_enforce_if(here)
            m.add_bool_or([lit.negated() for lit in lits] + [here])
            for i in range(a):
                for j in range(b):
                    allowed = fact["support"][i][j]
                    if len(allowed) < 9:
                        m.add_linear_expression_in_domain(
                            d[r0 + i, c0 + j],
                            cp.Domain.from_values(allowed),
                        ).only_enforce_if(here)

    def pin(self, grid, is_choc):
        """Fix every variable to a known grid; the model is then FEASIBLE
        exactly when it accepts that grid."""
        for p in CELLS:
            self.m.add(self.d[p] == grid[p])
            self.m.add(self.choc[p] == int(is_choc[p]))

    def solve(self, seconds, workers, seed=0):
        s = cp.CpSolver()
        s.parameters.max_time_in_seconds = seconds
        s.parameters.num_workers = workers
        s.parameters.random_seed = seed
        status = s.solve(self.m)
        if status not in (cp.OPTIMAL, cp.FEASIBLE):
            return status, None, None
        grid = {p: s.value(self.d[p]) for p in CELLS}
        is_choc = {p: s.value(self.choc[p]) == 1 for p in CELLS}
        return status, grid, is_choc
