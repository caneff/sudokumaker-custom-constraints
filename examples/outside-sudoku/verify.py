# Prove a board has exactly one solution, with OR-Tools CP-SAT. Defaults to
# the shipped board; name a link file to check a variant.
#
#   uv run --with lzstring --with ortools examples/outside-sudoku/verify.py
#   uv run --with lzstring --with ortools examples/outside-sudoku/verify.py \
#       examples/outside-sudoku/PUZZLE_LINK_6x6.txt
#
# This is the Python home of the window rule, beside OutsideSudokuComponent.js
# and soundness-harness.mjs (CODING_STANDARDS.md, "The rule has one home").
# The JS and the Python cannot share code, so they drift silently unless a
# change touches both; the Python side states the rule once, in
# outside_rule.py, which the generator uses too. This script reads the link
# itself -- givens, shown clues, drawn groups and box regions all come out of
# the file -- so it checks the artifact a reader opens, not a side file that
# can fall out of step.
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
from frame import ring_cell
from framebuild import make_lines
from link_codec import decode_puzzle
from link_swap import find_constraint
from outside_rule import post_membership, window_length_by_region


def clue_groups(link, W, n):
    """Every clue's cells -- clue cell first, then the line inward -- however
    the board carries them.

    The local board ships each line as a drawn group and main.js reads it. The
    global board ships none: main-global.js builds the 4n frame lines from the
    board size, and so does this, off the same frame geometry the generator
    draws (framebuild.make_lines, frame.ring_cell)."""
    groups = find_constraint(link, CONSTRAINT_NAME)["input"].get("groups")
    if groups is not None:
        return [g["cells"] for g in groups]
    groups = []
    for (side, i), cells in make_lines(n).items():
        cr, cc = ring_cell(f"{side}{i}", W)
        groups.append([cr * W + cc] + [(r + 1) * W + c + 1 for r, c in cells])
    return groups


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


def main(argv):
    path = pathlib.Path(argv[1]) if len(argv) > 1 else HERE / "PUZZLE_LINK.txt"
    link = decode_puzzle(path.read_text().strip())
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
    for group in clue_groups(link, W, n):
        clue, *line = group
        # A hidden clue cell is empty: the solver fills it, and any window
        # digit would do, so it constrains nothing. Only the shown clues count.
        if not cells[clue].get("given"):
            continue
        shown += 1
        value = cells[clue]["value"]
        w = window_length_by_region(line, region, row, column)
        post_membership(m, x, line[:w], value, str(clue))

    givens = sum(1 for i in interior if cells[i].get("given"))
    print(f"{path.name} ({n}x{n}): {givens} interior givens, {shown} shown clues")

    first = solve(m, x)
    assert first is not None, "the shipped board has no solution"
    assert solve(m, x, forbid=first) is None, "the shipped board has two solutions"
    print("ok — exactly one solution")


if __name__ == "__main__":
    main(sys.argv)
