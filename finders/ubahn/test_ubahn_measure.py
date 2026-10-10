"""The U-Bahn baseline measurement (#777), black-box on a 4x4 board.

`measure` must account for every seed exactly once, agree seed by seed with
the finder's own `propose` (so the measured step is the finder's step, not a
copy of it), and dedupe the way the hunt driver does. `report` must label a
count a timeout stopped as capped. One CP-SAT worker; a few seconds in all.

    uv run finders/ubahn/test_ubahn_measure.py
"""

import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "hunt"))
import measure_baseline
from dedupe import canonical_key
from protocol import Empty
from ubahn_finder import UbahnFinder

ok = True


def check(name, cond):
    global ok
    status = "ok" if cond else "FAIL"
    if not cond:
        ok = False
    print(f"{status}: {name}")


# Seeds 0:60 on 4x4 reach every cause the board can: unique, one duplicate
# and one not unique.
SEEDS = range(60)

REACHED = {}
for connectivity in ("flow", "tree"):
    outcomes = measure_baseline.measure(4, 4, connectivity, SEEDS, timeout=60.0)
    check(
        f"{connectivity}: one outcome per seed, in order",
        [o.seed for o in outcomes] == list(SEEDS),
    )
    REACHED[connectivity] = {o.cause for o in outcomes}
    check(
        f"{connectivity}: seeds reach unique, duplicate and not_unique",
        {"unique", "duplicate", "not_unique"} <= REACHED[connectivity],
    )
    check(
        f"{connectivity}: every cause is a known one",
        {o.cause for o in outcomes} <= set(measure_baseline.CAUSES),
    )
    check(
        f"{connectivity}: a proof is timed exactly when one ran",
        all(
            (o.prove_s is not None)
            == (o.cause not in ("timeout sampling", "infeasible"))
            for o in outcomes
        ),
    )

    # Seed by seed, `propose` (what the hunt runs) and the measured split
    # (sample, then prove) must reach the same verdict and the same network.
    finder = UbahnFinder(4, 4, None, 60.0, connectivity=connectivity)
    finder.workers = 1
    seen = set()
    for o in outcomes:
        proposed = finder.propose(random.Random(o.seed))
        if isinstance(proposed, Empty):
            expected = {
                "not unique": "not_unique",
                "timeout proving uniqueness": "timeout proving",
                "timeout sampling a network": "timeout sampling",
            }.get(proposed.reason)
            check(
                f"{connectivity} seed {o.seed}: propose said {proposed.reason!r}",
                o.cause == expected,
            )
            continue
        key = canonical_key(finder.key(proposed), finder.symmetry)
        want = "duplicate" if key in seen else "unique"
        seen.add(key)
        check(
            f"{connectivity} seed {o.seed}: propose gave a network, {want}",
            o.cause == want,
        )

# A tally, not a measurement: the report's own words.
Outcome = measure_baseline.Outcome
rows = [
    Outcome(0, "unique", 0.010, 0.020),
    Outcome(1, "not_unique", 0.030, 0.040),
    Outcome(2, "duplicate", 0.050, 0.060),
    Outcome(3, "timeout proving", 0.070, 60.0),
]
text = measure_baseline.report("6x6", "flow", rows, timeout=60.0)
check("report names the sample size", "4 seeds" in text)
check("report counts each cause", "not_unique | 1" in text and "unique | 1" in text)
check("report labels a timeout count as capped", "capped" in text)
clean = measure_baseline.report("6x6", "flow", rows[:3], timeout=60.0)
check("report has no capped label when nothing timed out", "capped" not in clean)

sys.exit(0 if ok else 1)
