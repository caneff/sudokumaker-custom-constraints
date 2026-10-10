"""The PySAT uniqueness check against the CP-SAT one and the brute force
(#776).

    uv run finders/ubahn/test_ubahn_sat.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import brute
import model
import network
import sat_model
import time_sat

TIME_LIMIT = 10.0

ok = True


def check(name, cond):
    global ok
    status = "ok" if cond else "FAIL"
    if not cond:
        ok = False
    print(f"{status}: {name}")


# The fixture writes a line as cross, branch, straight, turn and leaves the
# blank count out. A 3x3 board whose top-left 2x2 block is a loop has blank
# cells in every line, and `network.outside_numbers` counts them itself.
loop = frozenset(network.all_edges(2, 2))
entry = {
    "rows": 3,
    "cols": 3,
    "row_numbers": [[0, 0, 0, 2], [0, 0, 0, 2], [0, 0, 0, 0]],
    "col_numbers": [[0, 0, 0, 2], [0, 0, 0, 2], [0, 0, 0, 0]],
}
check(
    "a fixture entry reads as the loop's own outside numbers, blanks included",
    time_sat.fixture_numbers(entry) == network.outside_numbers(loop, 3, 3),
)
# Each kind in its own line, so a swapped pair of kinds cannot pass.
kinds = {
    "rows": 1,
    "cols": 12,
    "row_numbers": [[1, 2, 3, 4]],
    "col_numbers": [[0, 0, 0, 0]] * 12,
}
check(
    "cross, branch, straight, turn land on their own kinds",
    time_sat.fixture_numbers(kinds)[0]
    == (
        tuple(
            {
                network.CROSS: 1,
                network.BRANCH: 2,
                network.STRAIGHT: 3,
                network.TURN: 4,
            }.get(k, 2)
            for k in network.KINDS
        ),
    ),
)

# A 2x2 board's one network is the loop of all four edges, and a loop needs
# no connectivity cut.
status, found, cuts = sat_model.uniqueness(
    2, 2, network.outside_numbers(loop, 2, 2), time_limit=10.0
)
check(
    f"2x2 loop: unique, the loop itself, no cut (got {status}, {cuts} cuts)",
    (status, found, cuts) == ("unique", loop, 0),
)

# Two 2x2 loops on a 2x5 board, the middle column blank between them: the
# numbers force every arm, so the only filling with no dead end is in two
# parts. Nothing but the connectivity cut can refuse it.
two_loops = frozenset(
    ((r, c), (r2, c2))
    for (r, c), (r2, c2) in network.all_edges(2, 5)
    if 2 not in (c, c2)
)
check(
    "two loops: no dead end, and not a network",
    None not in network.kind_grid(two_loops, 2, 5)
    and network.why_not_network(two_loops, 2, 5).startswith("not connected"),
)
status, found, cuts = sat_model.uniqueness(
    2, 5, network.outside_numbers(two_loops, 2, 5), time_limit=TIME_LIMIT
)
check(
    f"two loops: infeasible, by a cut (got {status}, {cuts} cuts)",
    (status, found) == ("infeasible", None) and cuts > 0,
)

# A timeout is a timeout, never unique: the 2x2 loop again with no time.
status, found, cuts = sat_model.uniqueness(
    2, 2, network.outside_numbers(loop, 2, 2), time_limit=0.0
)
check(f"no time: timeout (got {status})", (status, found) == ("timeout", None))

# The 4x4 space with 2 crosses in r2: the verdict on each full set of outside
# numbers must match the brute-force count of networks that share it.
space = brute.two_crosses_in_r2()
wrong = []
for numbers, count in space.by_numbers.items():
    status, found, _ = sat_model.uniqueness(4, 4, numbers, time_limit=TIME_LIMIT)
    if status != ("unique" if count == 1 else "not_unique") or found not in space.valid:
        wrong.append((numbers, count, status))
check(
    f"the verdict matches the brute-force count on all {len(space.by_numbers)} "
    f"sets of outside numbers, each with a brute-force network "
    f"(first mismatch: {wrong[:1]})",
    not wrong,
)

# The 15 timing puzzles: the same verdict as the CP-SAT flow check, and a
# network that the solver-free rule check passes and that has the puzzle's
# numbers.
puzzles = time_sat.fixture_puzzles()
check(f"the fixture holds 15 puzzles (got {len(puzzles)})", len(puzzles) == 15)
for puzzle in puzzles:
    rows, cols = puzzle["rows"], puzzle["cols"]
    numbers = time_sat.fixture_numbers(puzzle)
    status, found, cuts = sat_model.uniqueness(
        rows, cols, numbers, time_limit=TIME_LIMIT
    )
    reference, _ = model.uniqueness(
        rows, cols, numbers, "flow", time_limit=TIME_LIMIT, workers=1
    )
    check(
        f"{puzzle['name']}: {status} as CP-SAT says ({reference}), {cuts} cuts",
        status == reference and status in ("unique", "not_unique"),
    )
    check(
        f"{puzzle['name']}: the network found is one, with the puzzle's numbers",
        found is not None
        and not network.why_not_network(found, rows, cols)
        and network.outside_numbers(found, rows, cols) == numbers,
    )

sys.exit(0 if ok else 1)
