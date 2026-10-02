# The Dutch Flatmates rule as a CP-SAT model -- sudoku, plus: every 5 has a 1
# directly above it or a 9 directly below it. The generator, the uniqueness
# proof and the rule-forces-a-flatmate check all build this one model, so the
# rule has one CP-SAT home (CODING_STANDARDS.md, "The rule has one home"). Its
# other homes are DutchFlatmatesComponent.js, and the independent statements in
# flatmate_model.test.py and validate.test.mjs that check the two against it.

import pathlib
import sys

from ortools.sat.python import cp_model

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "_shared"))
from cpsat import SOLVED, has_second_solution, solver

N = 9
BOX = 3


def build_model(givens=(), flatmate=True):
    """(model, x) for sudoku with `givens` ({(row, column): digit}) and, when
    `flatmate` is true, the flatmate rule on every cell. `x` maps (row,
    column) to its variable."""
    m = cp_model.CpModel()
    x = {(r, c): m.NewIntVar(1, N, f"x{r}{c}") for r in range(N) for c in range(N)}
    for (r, c), v in dict(givens).items():
        m.Add(x[r, c] == v)
    for i in range(N):
        m.AddAllDifferent([x[i, c] for c in range(N)])
        m.AddAllDifferent([x[r, i] for r in range(N)])
    for br in range(0, N, BOX):
        for bc in range(0, N, BOX):
            m.AddAllDifferent(
                [x[br + i, bc + j] for i in range(BOX) for j in range(BOX)]
            )
    if flatmate:
        _post_flatmate(m, x)
    return m, x


def _is(m, var, digit, tag):
    """A literal that is true exactly when `var` takes `digit`."""
    b = m.NewBoolVar(tag)
    m.Add(var == digit).OnlyEnforceIf(b)
    m.Add(var != digit).OnlyEnforceIf(b.Not())
    return b


def _post_flatmate(m, x):
    """Every 5 has a 1 at (r-1, c) or a 9 at (r+1, c). A top-row 5 has only
    the 9 below to lean on and a bottom-row 5 only the 1 above, so the missing
    neighbour is simply not an option."""
    for r in range(N):
        for c in range(N):
            options = []
            if r > 0:
                options.append(_is(m, x[r - 1, c], 1, f"one_above{r}{c}"))
            if r < N - 1:
                options.append(_is(m, x[r + 1, c], 9, f"nine_below{r}{c}"))
            five = _is(m, x[r, c], 5, f"five{r}{c}")
            m.AddBoolOr(options).OnlyEnforceIf(five)


def _solve(m, limit):
    """(status, solver) for `m`. Raises TimeoutError on no verdict: a timeout is
    never read as "no solution"."""
    s = solver(limit)
    status = s.Solve(m)
    if status == cp_model.UNKNOWN:
        raise TimeoutError(f"CP-SAT hit the {limit}s limit; no verdict")
    return status, s


def solve_one(givens, flatmate=True, limit=60):
    """One solution of the board as {(row, column): digit}, or None when it
    has none. Raises TimeoutError on no verdict."""
    m, x = build_model(givens, flatmate)
    status, s = _solve(m, limit)
    return {k: s.Value(v) for k, v in x.items()} if status in SOLVED else None


def unique_solution(givens, flatmate=True, limit=60):
    """The board's one solution, or None when it has none or several (the two
    are not told apart). Raises TimeoutError on no verdict."""
    first = solve_one(givens, flatmate, limit)
    if first is None:
        return None
    m, x = build_model(givens, flatmate)
    return None if has_second_solution(m, x, first, limit) else first


def rows_of(solution):
    """`solution` as nine strings of digits, the shape gen.json records."""
    return ["".join(str(solution[r, c]) for c in range(N)) for r in range(N)]


def prove_recorded(givens, grid):
    """The board's one solution, proved to be the recorded `grid` (nine digit
    strings). Raises AssertionError naming which part failed."""
    solution = unique_solution(givens)
    assert solution is not None, "the board is not uniquely solvable"
    assert rows_of(solution) == grid, "the gen JSON's grid is not the board's solution"
    return solution


class _Counter(cp_model.CpSolverSolutionCallback):
    def __init__(self, cap):
        super().__init__()
        self.found = 0
        self.cap = cap

    def on_solution_callback(self):
        self.found += 1
        if self.found >= self.cap:
            self.StopSearch()


def count_plain_completions(givens, cap, limit=60):
    """How many solutions plain sudoku has with `givens`, counted up to `cap`
    (a result equal to `cap` means "`cap` or more"). Raises TimeoutError on no
    verdict.

    This is what the app searches through when the component only validates:
    it fills the grid by plain sudoku and judges the flatmate rule on each full
    grid, so a board with many plain completions is slow to solve."""
    m, _x = build_model(givens, flatmate=False)
    s = solver(limit)
    s.parameters.enumerate_all_solutions = True
    counter = _Counter(cap)
    status = s.Solve(m, counter)
    # OPTIMAL: the enumeration finished. Otherwise it stopped at `cap`, or hit
    # the time limit with a partial count, which is no verdict.
    if status != cp_model.OPTIMAL and counter.found < cap:
        raise TimeoutError(f"CP-SAT hit the {limit}s limit; no verdict")
    return counter.found


def flatmate_of(solution, r, c):
    """The flatmate cell of the 5 at (r, c) in `solution`: the 1 above it, or
    the 9 below it (the one above when both hold)."""
    if r > 0 and solution[r - 1, c] == 1:
        return (r - 1, c)
    if r < N - 1 and solution[r + 1, c] == 9:
        return (r + 1, c)
    raise AssertionError(f"the 5 at {(r, c)} has no flatmate in this solution")


def rule_forced_flatmates(givens, solution, limit=60):
    """The 5s of `solution` whose flatmate cell the givens alone do not fix:
    under plain sudoku with `givens`, that cell can take another digit. These
    are the cells where only the flatmate rule forces the flatmate.

    Returns [((row, column) of the 5, its flatmate cell)]. Raises TimeoutError
    on no verdict."""
    out = []
    for (r, c), v in sorted(solution.items()):
        if v != 5:
            continue
        f = flatmate_of(solution, r, c)
        m, x = build_model(givens, flatmate=False)
        m.Add(x[f] != solution[f])
        status, _s = _solve(m, limit)
        if status in SOLVED:
            out.append(((r, c), f))
    return out
