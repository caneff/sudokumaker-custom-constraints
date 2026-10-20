# The clue rule says one thing three ways: `visible` reads a clue off a line,
# `add_visible` posts it to CP-SAT as a running maximum, and skyscraper's
# `sky` is the same rule in the example it came from. An ISOFILL line repeats
# digits, so every line drawn here does, and a tie is where the three could
# part: a building as tall as the tallest so far is hidden.
#
# The JS component's side of the agreement is soundness-harness.mjs's: it
# reads every clue of the shipped board off its recorded grid and holds the
# component to it.

import importlib.util
import pathlib
import random
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_size import add_visible, visible
from ortools.sat.python import cp_model


def _skyscraper_sky():
    """skyscraper/build_size.py's `sky`, loaded under its own module name: this
    example's build_size.py already holds that name on sys.path."""
    path = HERE.parent / "skyscraper" / "build_size.py"
    spec = importlib.util.spec_from_file_location("skyscraper_build_size", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.sky


def _repeating_lines(count, n=9, seed=858):
    """`count` random lines of `n` digits 1..n, each holding some digit
    twice."""
    rng = random.Random(seed)
    lines = []
    while len(lines) < count:
        line = [rng.randint(1, n) for _ in range(n)]
        if len(set(line)) < n:
            lines.append(line)
    return lines


def _admits(line, clue):
    """Does `add_visible` accept `clue` on `line` with every digit pinned?"""
    n = len(line)
    m = cp_model.CpModel()
    cells = [(0, c) for c in range(n)]
    x = {cell: m.NewIntVar(1, n, f"x{cell}") for cell in cells}
    for cell, d in zip(cells, line, strict=True):
        m.Add(x[cell] == d)
    add_visible(m, x, cells, clue, n, "t", None)
    s = cp_model.CpSolver()
    s.parameters.num_workers = 1
    status = s.Solve(m)
    assert status in (cp_model.OPTIMAL, cp_model.FEASIBLE, cp_model.INFEASIBLE), (
        f"no verdict for {line} at clue {clue}"
    )
    return status != cp_model.INFEASIBLE


def test_visible_hides_a_tie_on_a_worked_line():
    # 3 is visible, the second 3 ties and is hidden, 5 and 9 are visible, and
    # the closing 9 ties the tallest: 3 visible buildings.
    assert visible([3, 3, 1, 5, 5, 2, 9, 4, 9], None, None) == 3
    assert visible([9, 9, 9, 9, 9, 9, 9, 9, 9], None, None) == 1


def test_visible_agrees_with_skyscraper_s_sky_on_repeating_lines():
    sky = _skyscraper_sky()
    for line in _repeating_lines(500):
        assert visible(line, None, None) == sky(line, None, None), line


def test_add_visible_admits_exactly_the_clue_visible_reads():
    for line in _repeating_lines(60):
        admitted = [k for k in range(1, len(line) + 1) if _admits(line, k)]
        assert admitted == [visible(line, None, None)], (line, admitted)


if __name__ == "__main__":
    test_visible_hides_a_tie_on_a_worked_line()
    test_visible_agrees_with_skyscraper_s_sky_on_repeating_lines()
    test_add_visible_admits_exactly_the_clue_visible_reads()
    print("ok")
