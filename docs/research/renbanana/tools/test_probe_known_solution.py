"""`--unique` with a solution already in hand must not re-find it.

The proof is the *second*-solution search; the first solve only recovers a
grid we may already have on disk. These tests pin that: supplied a known
solution, `prove_unique` runs exactly one solve and hands it the whole budget.

The solver is stubbed, so the real CP-SAT model is never solved here -- what
is under test is the control flow, not the constraints.

    uv run --with ortools --with pytest -m pytest \
      docs/research/renbanana/tools/test_probe_known_solution.py
"""

import sys
from pathlib import Path

from ortools.sat.python import cp_model as cp

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import probe_circle_pattern as pcp  # noqa: E402
import renbanana_verify as rv  # noqa: E402

CAND = (
    Path(__file__).resolve().parents[1] / "candidates-fully-circled" / "cand_00.json"
)
REAL_SOLVER = cp.CpSolver


class Args:
    seconds = 300.0
    workers = 1


def bare_model():
    """Just the variables `prove_unique` touches -- enough for `block`."""
    m = cp.CpModel()
    choc = {p: m.new_bool_var("") for p in pcp.CELLS}
    d = {p: m.new_int_var(1, 9, "") for p in pcp.CELLS}
    return m, choc, d


def stub_solver(monkeypatch, statuses, answers):
    """Replace CpSolver with one that returns `statuses` in order and reads
    variables out of `answers` (keyed by id). Records each call's budget."""
    calls = []

    class Fake:
        def __init__(self):
            self.parameters = REAL_SOLVER().parameters
            self.wall_time = 0.0

        def solve(self, m):
            calls.append(self.parameters.max_time_in_seconds)
            return statuses[len(calls) - 1]

        def value(self, var):
            return answers[id(var)]

    monkeypatch.setattr(cp, "CpSolver", Fake)
    return calls


def fixture():
    grid, is_choc, circles = rv.load(CAND)
    return grid, is_choc, circles


def answers_for(choc, d, grid, is_choc):
    out = {id(d[p]): grid[p] for p in pcp.CELLS}
    out.update({id(choc[p]): int(is_choc[p]) for p in pcp.CELLS})
    return out


def test_known_solution_skips_the_first_solve(monkeypatch):
    grid, is_choc, circles = fixture()
    m, choc, d = bare_model()
    calls = stub_solver(
        monkeypatch, [cp.INFEASIBLE], answers_for(choc, d, grid, is_choc)
    )
    verdict = pcp.prove_unique(m, choc, d, circles, Args(), known=(grid, is_choc))
    assert len(calls) == 1, f"expected one solve, got {len(calls)}"
    assert calls[0] == Args.seconds, "the second search must get the whole budget"
    assert verdict == "UNIQUE"


def test_without_a_known_solution_it_solves_twice(monkeypatch):
    grid, is_choc, circles = fixture()
    m, choc, d = bare_model()
    calls = stub_solver(
        monkeypatch,
        [cp.FEASIBLE, cp.INFEASIBLE],
        answers_for(choc, d, grid, is_choc),
    )
    verdict = pcp.prove_unique(m, choc, d, circles, Args())
    assert calls == [Args.seconds / 2, Args.seconds]
    assert verdict == "UNIQUE"


def test_a_timed_out_second_search_is_never_unique(monkeypatch):
    grid, is_choc, circles = fixture()
    m, choc, d = bare_model()
    stub_solver(monkeypatch, [cp.UNKNOWN], answers_for(choc, d, grid, is_choc))
    verdict = pcp.prove_unique(m, choc, d, circles, Args(), known=(grid, is_choc))
    assert verdict == "NOT PROVED"


def test_load_known_reads_a_single_candidate_file():
    grid, is_choc, _ = fixture()
    got = pcp.load_known(CAND)
    assert got == [(grid, is_choc)]
