"""The circle-pattern probe must accept every grid we already know is legal.

`probe_circle_pattern` reports UNIQUE when its second-solution search comes
back INFEASIBLE. Every solution it emits is re-checked by `renbanana_verify`,
so an under-constrained model fails loud; an over-constrained one does not --
it just rules the real second solution out and prints a false UNIQUE. This
test guards that direction only: each known (grid, shading), pinned, with
every cell that reads its own group size circled, must stay FEASIBLE. It says
nothing about a wrong UNIQUE from a model that is too loose; that still rests
on the re-verification.

    uv run finders/renbanana/tools/test_probe_circle_pattern_accepts_known_grids.py

Run it from the repo root, after touching probe_circle_pattern.py.
"""

import sys
from pathlib import Path

sys.path.insert(0, "finders/renbanana/tools")
sys.path.insert(0, "finders")
import probe_circle_pattern as pcp
import renbanana_verify as rv
from ortools.sat.python import cp_model as cp

CANDIDATES = sorted(Path("docs/research/renbanana").glob("candidates*/cand_*.json"))


def group_sizes(is_choc):
    return {
        p: len(g)
        for colour in (True, False)
        for g in rv.components(is_choc, colour)
        for p in g
    }


def status(grid, is_choc, circled):
    m, _, _ = pcp.build(
        circled,
        [p for p in pcp.CELLS if is_choc[p]],
        [p for p in pcp.CELLS if not is_choc[p]],
        list(grid.items()),
    )
    s = cp.CpSolver()
    s.parameters.num_workers = 1
    s.parameters.max_time_in_seconds = 60
    return s.status_name(s.solve(m))


def test_every_known_grid_is_accepted():
    assert len(CANDIDATES) > 119, "the circle-pattern pool plus older witnesses"
    rejected = []
    for path in CANDIDATES:
        grid, is_choc, _ = rv.load(path)
        assert not rv.check(grid, is_choc), f"{path} is not a legal grid"
        sizes = group_sizes(is_choc)
        reads = [p for p in pcp.CELLS if grid[p] == sizes[p]]
        name = status(grid, is_choc, reads)
        print(f"{path.parent.name}/{path.name}: circles={len(reads)} {name}")
        if name not in ("OPTIMAL", "FEASIBLE"):
            rejected.append(path)
    assert not rejected, f"valid grids rejected: {rejected}"


def test_a_circle_on_a_cell_that_misreads_its_size_is_refused():
    """The other half of the circle constraint: if it accepted anything, the
    test above would pass on a model that ignores circles altogether."""
    grid, is_choc, _ = rv.load(CANDIDATES[0])
    sizes = group_sizes(is_choc)
    for colour in (True, False):
        wrong = next(
            p for p in pcp.CELLS if is_choc[p] == colour and grid[p] != sizes[p]
        )
        assert status(grid, is_choc, [wrong]) == "INFEASIBLE", wrong


if __name__ == "__main__":
    test_a_circle_on_a_cell_that_misreads_its_size_is_refused()
    test_every_known_grid_is_accepted()
    print("PASS")
