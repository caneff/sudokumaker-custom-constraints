# cpsat.py: the three CP-SAT calls every generator and uniqueness proof here
# shares. The models are two-variable toys, not puzzle boards -- what is under
# test is the forbid clause, the solver configuration, and the second-solution
# verdict, none of which care what the model says.
#
#   uv run --with ortools examples/_shared/cpsat.test.py

from cpsat import forbid, has_second_solution, solver
from ortools.sat.python import cp_model


def _model(total):
    """x + y == total over 1..3, and the two cell variables keyed like a board's."""
    m = cp_model.CpModel()
    x = {"x": m.NewIntVar(1, 3, "x"), "y": m.NewIntVar(1, 3, "y")}
    m.Add(x["x"] + x["y"] == total)
    return m, x


def _solve(m, x):
    s = solver(10)
    return (
        {k: s.Value(v) for k, v in x.items()}
        if s.Solve(m) in (cp_model.OPTIMAL, cp_model.FEASIBLE)
        else None
    )


def test_forbid_rules_out_exactly_the_named_assignment():
    # Two free variables over 1..3: nine assignments. Forbidding each one as
    # it is found must strike exactly that one, so the enumeration runs the
    # full nine. A clause that ruled out every cell it named independently --
    # "x is not 1 AND y is not 1" rather than "x is not 1 OR y is not 1" --
    # would strike five on the first round and stop at three.
    m = cp_model.CpModel()
    x = {"x": m.NewIntVar(1, 3, "x"), "y": m.NewIntVar(1, 3, "y")}
    seen = []
    while (found := _solve(m, x)) is not None:
        assert found not in seen, f"{found} came back twice: forbid struck nothing"
        seen.append(found)
        forbid(m, x, found, tag=len(seen))
    assert len(seen) == 9, sorted(map(sorted, (s.items() for s in seen)))


def test_has_second_solution_on_a_unique_and_an_ambiguous_model():
    # total 6 admits only 3+3; total 4 admits three assignments.
    m, x = _model(6)
    assert has_second_solution(m, x, _solve(m, x), 10) is False
    m, x = _model(4)
    assert has_second_solution(m, x, _solve(m, x), 10) is True


def test_has_second_solution_raises_rather_than_report_a_verdict():
    # A time cap the search cannot meet is no verdict, never "unique".
    m, x = _model(4)
    first = _solve(m, x)
    try:
        has_second_solution(m, x, first, 0.0)
    except TimeoutError:
        pass
    else:
        raise AssertionError("a spent time cap must raise, not report a verdict")


def test_reproducible_pins_one_worker_and_seed_zero():
    # The committed-proof configuration: CP-SAT's parallel portfolio is not
    # reproducible run to run, so a proof that ships pins the search.
    s = solver(30)
    assert (s.parameters.num_workers, s.parameters.random_seed) == (1, 0)
    assert s.parameters.max_time_in_seconds == 30
    assert s.parameters.randomize_search is False


def test_a_seed_handed_to_the_reproducible_solver_is_a_loud_mistake():
    # The reproducible configuration pins seed 0, so a caller's seed could only
    # be silently dropped. It is refused instead.
    for kwargs in ({"seed": 1234}, {"randomize": True}):
        assert _refused(kwargs), f"{kwargs} was accepted and ignored"


def _refused(kwargs):
    try:
        solver(30, **kwargs)
    except ValueError:
        return True
    return False


def test_search_mode_leaves_the_portfolio_and_the_caller_s_seed_alone():
    # Sampling a fresh grid wants variety, not reproducibility: the portfolio
    # stays on and the caller's sub-seed drives randomize_search.
    s = solver(30, reproducible=False, seed=1234, randomize=True)
    assert s.parameters.num_workers > 1
    assert s.parameters.random_seed == 1234
    assert s.parameters.randomize_search is True


if __name__ == "__main__":
    test_forbid_rules_out_exactly_the_named_assignment()
    test_has_second_solution_on_a_unique_and_an_ambiguous_model()
    test_has_second_solution_raises_rather_than_report_a_verdict()
    test_reproducible_pins_one_worker_and_seed_zero()
    test_a_seed_handed_to_the_reproducible_solver_is_a_loud_mistake()
    test_search_mode_leaves_the_portfolio_and_the_caller_s_seed_alone()
    print("cpsat.test.py: ok")
