# Independent OR-Tools verifier for the shipped Numbered Rooms puzzle. It is the
# heavy, independent half of the recovery check that recovery-probe.mjs cannot
# be: the probe runs the SAME component code SudokuMaker runs, so a bug shared by
# the component and the probe hides from both. This re-models the Numbered Rooms
# rule from scratch as a CP-SAT constraint, over its own sudoku all-different,
# and never touches the component code.
#
#   node examples/numbered-rooms/recovery-probe.mjs   # first: carves, writes min_givens.json
#   uv run --with ortools examples/numbered-rooms/verify.py
#
# recovery-probe.mjs carves the interior to the givens the components need to
# solve by logic (min_givens.json); this confirms that shipped puzzle is sound:
#   1. With those givens and all 36 clues shown, the interior is UNIQUELY
#      solvable, and the one solution matches the fixture solution.
#   2. The clues are load-bearing, not decoration: keep the givens, drop every
#      clue, and more than one completion remains.
# It also reports the logical floor — the clues alone (zero givens) are already
# unique — which is why the hand-made 31 givens were so far above what is needed.
#
# The rule: a line reads inward from its clue cell; the first inside cell holds a
# 1-based index k; the clue equals the digit in the k-th inside cell. As a
# constraint: line[line[0] - 1] == clue. AddElement wants a 0-based index, so the
# index variable is line[0] - 1.

import json
import pathlib
import sys

from ortools.sat.python import cp_model

HERE = pathlib.Path(__file__).parent
CAP = 2            # stop the solution count here; 2 is enough to tell unique apart
TIME_LIMIT = 30    # seconds per solve


def load():
    gen = json.loads((HERE / "gen_9.json").read_text())
    n, W = gen["n"], gen["W"]  # interior cell (r, c) is board index r * W + c
    interior = [r * W + c for r in range(1, n + 1) for c in range(1, n + 1)]
    kept = set(json.loads((HERE / "min_givens.json").read_text())["kept"])
    return gen, n, interior, kept


def build_model(gen, n, interior, active, givens):
    """A fresh CP-SAT model of the sudoku plus the Numbered Rooms rule for the
    clues in `active` (indices into gen["groups"]), with the interior cells in
    `givens` fixed to their solution digit. Returns (model, x)."""
    W = gen["W"]
    sol = gen["solution"]
    m = cp_model.CpModel()
    x = {i: m.NewIntVar(1, n, f"x{i}") for i in interior}

    for r in range(1, n + 1):
        m.AddAllDifferent([x[r * W + c] for c in range(1, n + 1)])
    for c in range(1, n + 1):
        m.AddAllDifferent([x[r * W + c] for r in range(1, n + 1)])
    for box in gen["boxes"]:
        m.AddAllDifferent([x[i] for i in box])

    for i in givens:
        m.Add(x[i] == sol[str(i)])

    for gi in active:
        cells = gen["groups"][gi]["cells"]
        clue = sol[str(cells[0])]  # the shown outside digit
        line = cells[1:]
        idx = m.NewIntVar(0, len(line) - 1, f"idx{gi}")
        m.Add(idx == x[line[0]] - 1)
        m.AddElement(idx, [x[i] for i in line], clue)

    return m, x


def solutions(gen, n, interior, active, givens):
    """Solve, then block that assignment and solve again, up to CAP times.
    Returns (count, first) where count stops at CAP and first is the interior
    assignment of the first solution (or None)."""
    m, x = build_model(gen, n, interior, active, givens)
    count = 0
    first = None
    while count < CAP:
        s = cp_model.CpSolver()
        s.parameters.max_time_in_seconds = TIME_LIMIT
        if s.Solve(m) not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            break
        assign = {i: s.Value(x[i]) for i in interior}
        if first is None:
            first = assign
        count += 1
        lits = []
        for i in interior:
            b = m.NewBoolVar(f"blk{i}_{count}")
            m.Add(x[i] != assign[i]).OnlyEnforceIf(b)
            m.Add(x[i] == assign[i]).OnlyEnforceIf(b.Not())
            lits.append(b)
        m.AddBoolOr(lits)
    return count, first


def main():
    gen, n, interior, kept = load()
    all_clues = list(range(len(gen["groups"])))
    sol = gen["solution"]

    count, first = solutions(gen, n, interior, all_clues, kept)
    verdict = "UNIQUE" if count == 1 else f"{count}+ solutions — NOT UNIQUE"
    print(f"shipped puzzle: {len(kept)} interior givens, {len(all_clues)} clues (all shown)")
    print(f"  {count} solution(s) — {verdict}")

    ok = count == 1
    # The independent model must agree with the fixture's own solution digits.
    if first is not None:
        mismatch = [i for i in interior if first[i] != sol[str(i)]]
        if mismatch:
            ok = False
            print(f"  MISMATCH: model solution differs from the fixture at {len(mismatch)} cells: {mismatch[:5]}")
        else:
            print("  independent model agrees with the fixture solution")

    # Drop every clue but keep the givens: the rule is load-bearing only if the
    # interior then has more than one completion. One completion would mean the
    # givens alone solve it and the rule is doing nothing (an inert model).
    bare, _ = solutions(gen, n, interior, [], kept)
    print(f"  clues load-bearing: keep the {len(kept)} givens, drop all {len(all_clues)} clues -> {bare} completions")
    if bare < 2:
        ok = False
        print("  INERT: the rule removed nothing — the givens alone are unique")

    # The logical floor: the clues alone (zero givens) are already unique. This is
    # why 31 hand-made givens were far more than the puzzle needs.
    floor, _ = solutions(gen, n, interior, all_clues, set())
    print(f"  logical floor: clues alone (0 givens) -> {floor} solution(s)")

    if not ok:
        sys.exit(1)


if __name__ == "__main__":
    main()
