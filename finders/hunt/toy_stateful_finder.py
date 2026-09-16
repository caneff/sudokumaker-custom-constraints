"""Slow, stateful toy finder for the hunt resume tests (#487).

Same rule as toy_slow_finder.py, plus a counter of seeds seen so far that
`save_state`/`load_state` round-trip through state.json. `record` stamps
each example with the counter's value at the time it was found, so a test
can tell a resumed run picked the counter back up instead of restarting it
at zero.

    uv run finders/hunt/toy_stateful_finder.py --out DIR --seeds START:END
"""

import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dedupe import D4
from driver import run
from protocol import Verdict

SIDE = 4
SLEEP_SECONDS = 0.01


class StatefulToyFinder:
    symmetry = D4

    def __init__(self):
        self.seeds_seen = 0

    def propose(self, rng):
        time.sleep(SLEEP_SECONDS)
        self.seeds_seen += 1
        return tuple(rng.randint(0, 1) for _ in range(SIDE * SIDE))

    def verify(self, candidate):
        shaded = sum(candidate)
        ok = shaded % 2 == 0
        return Verdict(ok=ok, reason="" if ok else "odd shaded-cell count")

    def record(self, candidate):
        return {"grid": list(candidate), "seeds_seen_at_find": self.seeds_seen}

    def key(self, candidate):
        return candidate

    def save_state(self):
        return {"seeds_seen": self.seeds_seen}

    def load_state(self, state):
        self.seeds_seen = state["seeds_seen"]


if __name__ == "__main__":
    sys.exit(run(StatefulToyFinder(), sys.argv[1:]))
