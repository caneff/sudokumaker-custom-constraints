"""Exhaustive enumeration of U-Bahn edge assignments, for the tests (#773).

Feasible only on a tiny board: every free edge doubles the space. The tests
filter what it returns with `network.py`'s rule check, so no solver takes
part.
"""

import sys
from itertools import product
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import network


def assignments(rows, cols, forced):
    """Every set of edges of the board that holds all of `forced`."""
    free = [e for e in network.all_edges(rows, cols) if e not in forced]
    base = frozenset(forced)
    return [
        base | {e for e, on in zip(free, bits, strict=True) if on}
        for bits in product((0, 1), repeat=len(free))
    ]
