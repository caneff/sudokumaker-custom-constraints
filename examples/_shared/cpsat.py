"""The CP-SAT calls the generators and uniqueness proofs here all make.

Every proof in this repo has one shape: solve, read the assignment back,
forbid it, solve again. `forbid` posts that clause, `has_second_solution`
posts it and solves, and `solver` is the configuration both run under.

The configuration is the part worth stating once, because a solver is asked
for two different things:

- **A committed proof** takes `solver(limit)` -- one worker, seed 0,
  reproducible run to run. CP-SAT's parallel portfolio races its workers, so
  which solution comes back depends on thread timing, and a `regenerate +
  git diff` gate over a portfolio search compares noise. One worker is slower,
  and that is the price of a verdict that means the same thing twice.
- **A search for a fresh grid** takes `solver(limit, reproducible=False,
  seed=..., randomize=True)` -- the full portfolio, the caller's seed. Nothing
  downstream re-derives that grid; it is written to a gen JSON and proved from
  there.

One proof takes the portfolio anyway: isofill's full-board check, whose 10x10
model a single worker cannot finish inside any usable limit. Its README
carries the measurement and the argument.
"""

from ortools.sat.python import cp_model

SOLVED = (cp_model.OPTIMAL, cp_model.FEASIBLE)

# No verdict: the search hit its time cap. Re-exported so a caller reads its
# own solve status without importing cp_model beside this module.
UNKNOWN = cp_model.UNKNOWN

# The portfolio width the sampling searches run at. Not the core count: these
# runs share the machine with other work.
SEARCH_WORKERS = 8


def solver(limit, reproducible=True, seed=0, randomize=False):
    """A CpSolver capped at `limit` seconds.

    Reproducible by default: one worker and seed 0, so the same model gives
    the same answer on every run. `reproducible=False` opens the portfolio and
    takes the caller's `seed`, with `randomize` steering the search away from
    the dull grids the default order keeps returning.
    """
    s = cp_model.CpSolver()
    s.parameters.max_time_in_seconds = limit
    s.parameters.num_workers = 1 if reproducible else SEARCH_WORKERS
    s.parameters.random_seed = 0 if reproducible else seed
    s.parameters.randomize_search = randomize
    return s


def forbid(m, x, assignment, tag=""):
    """Rule `assignment` out of model `m`: some cell must differ from it.

    `x` maps a cell to its variable, keyed however the caller keys cells --
    (row, column) pairs in the generators, board indices in a link check. Only
    the cells `assignment` names are constrained. `tag` distinguishes the
    literals when one model is forbidden more than once; CP-SAT does not
    require distinct names, but a duplicate makes the model unreadable in a
    dump.
    """
    lits = []
    for cell, v in assignment.items():
        b = m.NewBoolVar(f"d{tag}_{cell}")
        m.Add(x[cell] != v).OnlyEnforceIf(b)
        m.Add(x[cell] == v).OnlyEnforceIf(b.Not())
        lits.append(b)
    m.AddBoolOr(lits)


def has_second_solution(m, x, first, limit, reproducible=True, tag=""):
    """True when `m` has a solution other than `first`, False when it has none.

    Raises TimeoutError when the search hits `limit` without a verdict -- a
    timeout is never reported as "no second solution", which is the one way a
    uniqueness proof can lie. Forbids `first` on `m` in place, so the model is
    spent afterwards.
    """
    forbid(m, x, first, tag=tag)
    status = solver(limit, reproducible=reproducible).Solve(m)
    if status == cp_model.UNKNOWN:
        raise TimeoutError(f"CP-SAT hit the {limit}s limit; no verdict")
    return status in SOLVED
