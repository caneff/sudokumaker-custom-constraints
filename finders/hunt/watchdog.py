"""Solve-with-watchdog plus a stall callback (#483/#486): stop a CP-SAT solve
that has gone quiet instead of letting it run to its full time limit. Half
of zombo-brainanas's sampling budget went to proving optimality after the
real answer was already found (seed 701: feasible at 178s, OPTIMAL at 489s).
See `finders/zombo_brainanas_cpsat.py`'s `FirstSolution`/`solve_with_watchdog`
for the circle-hunt version this generalizes.
"""

import threading

from ortools.sat.python import cp_model


class StallWatchdog(cp_model.CpSolverSolutionCallback):
    """Tracks the wall time of the first solution (`first_at`) and reports
    `stalled()` once `stall` seconds have passed with no progress -- from
    the last solution found, or from the first poll if none has been found
    yet, so a solve that never finds anything still ends. `stall=0` never
    stalls."""

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
        if not self.stall:
            return False
        now = self.WallTime()
        if self._last is None:
            self._last = now  # first poll: nothing found yet, start the clock here
            return False
        return now - self._last > self.stall


def solve_with_watchdog(solver, model, callback):
    """Solve `model` in a thread, polling `callback.stalled()` once a
    second and calling `solver.StopSearch()` the moment it reports a
    stall. `solver` and `callback` are duck-typed (a `CpSolver` and a
    `StallWatchdog`, or any objects with the same `Solve`/`StopSearch`/
    `stalled` methods): `solve_with_watchdog` itself has no CP-SAT
    dependency, only `StallWatchdog` does.

    An exception in the solve thread propagates out of this call, once the
    thread has finished, instead of being swallowed and surfacing as a
    `KeyError` on the missing status.
    """
    result = {}

    def run():
        try:
            result["status"] = solver.Solve(model, callback)
        except BaseException as exc:  # re-raised below, never swallowed
            result["error"] = exc

    thread = threading.Thread(target=run)
    thread.start()
    while thread.is_alive():
        thread.join(1)
        if callback.stalled():
            solver.StopSearch()
    if "error" in result:
        raise result["error"]
    return result["status"]
