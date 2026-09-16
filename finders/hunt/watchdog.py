"""Solve-with-watchdog plus a stall callback (#483/#486): stop a CP-SAT solve
that has gone quiet instead of letting it run to its full time limit. Half
of zombo-brainanas's sampling budget went to proving optimality after the
real answer was already found (seed 701: feasible at 178s, OPTIMAL at 489s).

Generalizes zombo-brainanas's `FirstSolution`/`solve_with_watchdog`
(finders/zombo_brainanas_cpsat.py) with the circle-hunt objective
(`stop_at`) and `release_heap` left out (#483 leaves those to the finder
that needs them).
"""

import threading

from ortools.sat.python import cp_model


class StallWatchdog(cp_model.CpSolverSolutionCallback):
    """Tracks the wall time of the first solution (`first_at`) and reports
    `stalled()` once `stall` seconds have passed since the last one, so a
    solve stuck proving optimality on an already-found answer can be cut
    off. `stall=0` never stalls."""

    def __init__(self, stall):
        super().__init__()
        self.stall = stall
        self.first_at = None
        self._last = None

    def on_solution_callback(self):
        now = self.WallTime()
        if self.first_at is None:
            self.first_at = now
        self._last = now

    def stalled(self):
        return (
            bool(self.stall)
            and self._last is not None
            and self.WallTime() - self._last > self.stall
        )


def solve_with_watchdog(solver, model, callback):
    """Solve `model` in a thread, polling `callback.stalled()` once a
    second and calling `solver.StopSearch()` the moment it reports a
    stall. `solver` and `callback` are duck-typed (a `CpSolver` and a
    `StallWatchdog`, or any objects with the same `Solve`/`StopSearch` and
    `stalled` methods) so this has no CP-SAT import of its own to break."""
    result = {}

    def run():
        result["status"] = solver.Solve(model, callback)

    thread = threading.Thread(target=run)
    thread.start()
    while thread.is_alive():
        thread.join(1)
        if callback.stalled():
            solver.StopSearch()
    return result["status"]
