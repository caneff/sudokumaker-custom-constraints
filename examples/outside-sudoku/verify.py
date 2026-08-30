# Prove the shipped board has exactly one solution, with OR-Tools CP-SAT.
#
#   uv run --with lzstring --with ortools examples/outside-sudoku/verify.py
#
# This is the third home of the window rule, beside OutsideSudokuComponent.js
# and soundness-harness.mjs (CODING_STANDARDS.md, "The rule has one home").
# The three cannot share code, so they drift silently unless a change touches
# all three; this one reads the shipped link itself -- givens, shown clues,
# drawn groups and box regions all come out of PUZZLE_LINK.txt -- so it checks
# the artifact a reader opens, not a side file that can fall out of step.
#
# Slow (a full CP-SAT solve plus a second-solution search), so `just test` does
# not run it. Run it by hand after changing the board or the rule.

import pathlib
import sys

from ortools.sat.python import cp_model

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_link import CONSTRAINT_NAME
from link_codec import decode_puzzle
from link_swap import find_constraint


def window_length(line, region, row, column):
    """The window: the first w cells of the line, w being the extent of
    line[0]'s box along the line's direction. The same rule
    OutsideSudokuComponent.windowLength reads off the board."""
    head = line[0]
    if region[head] < 0:
        return len(line)
    along_row = len(line) == 1 or row[line[1]] == row[head]
    same = (
        (lambda c: row[c] == row[head])
        if along_row
        else (lambda c: column[c] == column[head])
    )
    extent = sum(1 for c, r in enumerate(region) if r == region[head] and same(c))
    return min(extent, len(line))


def solve(model, x, forbid=None):
    """Solve, returning the interior assignment or None. `forbid` rules out one
    earlier assignment, which is how the second-solution search runs."""
    if forbid is not None:
        lits = []
        for cell, v in forbid.items():
            b = model.NewBoolVar(f"d{cell}")
            model.Add(x[cell] != v).OnlyEnforceIf(b)
            model.Add(x[cell] == v).OnlyEnforceIf(b.Not())
            lits.append(b)
        model.AddBoolOr(lits)
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 120
    # One worker, fixed seed: CP-SAT's parallel portfolio is not reproducible
    # run to run, and this check has to give the same answer every time.
    solver.parameters.num_workers = 1
    solver.parameters.random_seed = 0
    if solver.Solve(model) not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return None
    return {cell: solver.Value(var) for cell, var in x.items()}


def main():
    link = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
    doc = link["puzzle"]
    W = doc["width"]
    n = W - 2
    cells = doc["cells"]
    region = next(c for c in doc["constraints"] if c.get("type") == 1)["regions"]
    row = [i // W for i in range(W * W)]
    column = [i % W for i in range(W * W)]
    interior = [i for i in range(W * W) if region[i] >= 0]

    m = cp_model.CpModel()
    x = {i: m.NewIntVar(1, n, f"x{i}") for i in interior}
    for r in range(1, n + 1):
        m.AddAllDifferent([x[r * W + c] for c in range(1, n + 1)])
    for c in range(1, n + 1):
        m.AddAllDifferent([x[r * W + c] for r in range(1, n + 1)])
    for box in {region[i] for i in interior}:
        m.AddAllDifferent([x[i] for i in interior if region[i] == box])
    for i in interior:
        if cells[i].get("given"):
            m.Add(x[i] == cells[i]["value"])

    shown = 0
    for group in find_constraint(link, CONSTRAINT_NAME)["input"]["groups"]:
        clue, *line = group["cells"]
        # A hidden clue cell is empty: the solver fills it, and any window
        # digit would do, so it constrains nothing. Only the shown clues count.
        if not cells[clue].get("given"):
            continue
        shown += 1
        value = cells[clue]["value"]
        w = window_length(line, region, row, column)
        lits = []
        for i in line[:w]:
            b = m.NewBoolVar(f"h{clue}_{i}")
            m.Add(x[i] == value).OnlyEnforceIf(b)
            m.Add(x[i] != value).OnlyEnforceIf(b.Not())
            lits.append(b)
        m.AddBoolOr(lits)

    givens = sum(1 for i in interior if cells[i].get("given"))
    print(f"{n}x{n}: {givens} interior givens, {shown} shown clues")

    first = solve(m, x)
    assert first is not None, "the shipped board has no solution"
    assert solve(m, x, forbid=first) is None, "the shipped board has two solutions"
    print("ok — exactly one solution")


if __name__ == "__main__":
    main()
