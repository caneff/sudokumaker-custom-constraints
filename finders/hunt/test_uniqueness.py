"""check_uniqueness on tiny CpModels, each outcome exercised directly (#486).

Covers a one-solution model, a two-solution model, an invalid model (an
IntVar with lb > ub), and a solve that times out -- the four statuses
`check_uniqueness` can report.

    uv run finders/hunt/test_uniqueness.py
"""

import random
import sys
from pathlib import Path

from ortools.sat.python import cp_model

sys.path.insert(0, str(Path(__file__).resolve().parent))
from uniqueness import check_uniqueness

ok = True


def check(name, cond):
    global ok
    status = "ok" if cond else "FAIL"
    if not cond:
        ok = False
    print(f"{status}: {name}")


# One-solution model: two cells, forced equal, one fixed -- only one
# assignment satisfies it.
m = cp_model.CpModel()
a = m.NewIntVar(0, 1, "a")
b = m.NewIntVar(0, 1, "b")
m.Add(a == b)
m.Add(a == 1)
result = check_uniqueness(m, [a, b])
check("a one-solution model is reported unique", result.unique)
check("status is 'unique'", result.status == "unique")
check("the witness is the only solution", result.first == (1, 1))
check("no second witness on a unique model", result.second is None)

# Two-solution model: two free cells linked so exactly two assignments
# satisfy it (a == b, unconstrained otherwise).
m2 = cp_model.CpModel()
a2 = m2.NewIntVar(0, 1, "a")
b2 = m2.NewIntVar(0, 1, "b")
m2.Add(a2 == b2)
result2 = check_uniqueness(m2, [a2, b2])
check("a two-solution model is reported not unique", not result2.unique)
check("status is 'not_unique'", result2.status == "not_unique")
check(
    "both witnesses are reported and differ",
    result2.first is not None
    and result2.second is not None
    and result2.first != result2.second,
)
check(
    "both witnesses actually satisfy a == b",
    result2.first[0] == result2.first[1] and result2.second[0] == result2.second[1],
)

# MODEL_INVALID: an IntVar built with lb > ub is invalid at solve time, no
# exception at construction.
m3 = cp_model.CpModel()
bad = m3.NewIntVar(5, 2, "bad")
result3 = check_uniqueness(m3, [bad])
check("an invalid model is reported invalid, not unique", result3.status == "invalid")
check("invalid is never reported as unique", not result3.unique)

# Timeout: a subset-sum instance with a time limit far below what it takes
# to find a first feasible solution -- deterministic given the fixed seed
# and weights (measured well over 1ms; a 1ms budget leaves no margin for a
# false pass).
m4 = cp_model.CpModel()
rng = random.Random(1)
n = 60
xs = [m4.NewBoolVar(f"x{i}") for i in range(n)]
weights = [rng.randint(1, 1000) for _ in range(n)]
target = sum(weights) // 2
m4.Add(sum(w * x for w, x in zip(weights, xs, strict=True)) == target)
result4 = check_uniqueness(m4, xs, time_limit=0.001, workers=1)
check("a solve that times out is reported as timeout", result4.status == "timeout")
check("timeout is never reported as unique", not result4.unique)

sys.exit(0 if ok else 1)
