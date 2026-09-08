"""The canonical key must hold up on every grid in the pool.

Three claims, all falsifiable against the pool and the independent checker:

1. Every dihedral image of a legal grid is itself legal -- if not, the group is
   wrong and the key would merge grids that are not the same puzzle.
2. All eight images of one grid share one key.
Duplicates across pools are reported, not failed. A pool records what one hunt
found, and two hunts finding the same puzzle is a fact worth keeping -- it is
the lineup, not the pools, that must show each puzzle once.

    uv run docs/research/renbanana/tools/test_canon.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import canon
import renbanana_verify as rv

ok = True
seen = {}
paths = sorted(Path("docs/research/renbanana").glob("candidates*/cand_*.json"))
for path in paths:
    grid, is_choc, _ = rv.load(path)
    keys = set()
    for g, s in canon.images(grid, is_choc):
        bad = rv.check(g, s)
        if bad:
            ok = False
            print(f"{path}: an image is ILLEGAL — {bad[0]}")
        keys.add(canon.key(g, s))
    if len(keys) != 1:
        ok = False
        print(f"{path}: its images disagree on the key ({len(keys)} keys)")
    k = keys.pop()
    if k in seen:
        print(f"note: {path} is the same puzzle as {seen[k]}")
    else:
        seen[k] = path

print(f"{len(paths)} grids, {len(seen)} distinct puzzles")
print("PASS" if ok else "FAIL")
sys.exit(0 if ok else 1)
