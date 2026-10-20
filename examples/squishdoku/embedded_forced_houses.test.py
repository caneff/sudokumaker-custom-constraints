# The embedded 9x9 backend (embedded/main.js) registers 43 built-in
# HouseComponents. Same proof as forced_houses.test.py, on the 9x9 board: in
# the rules model no two cells of any registered house can be equal. About
# 1,500 CP-SAT solves, so this one is on the heavy list in tests/all.sh.
#
#   uv run examples/squishdoku/embedded_forced_houses.test.py

import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

from squish_board import EMBEDDED, registered_houses, unforced_pairs

if __name__ == "__main__":
    houses = registered_houses(HERE / "embedded" / "main.js")

    # the README's claim: 43 houses, all nine cells, none registered twice
    assert len(houses) == 43, len(houses)
    assert all(len(set(h["cells"])) == 9 for h in houses), houses
    assert len({frozenset(h["cells"]) for h in houses}) == 43

    bad = [(h["name"], p) for h in houses for p in unforced_pairs(EMBEDDED, h["cells"])]
    assert not bad, f"houses whose cells can repeat a digit: {bad}"

    print(f"ok - {len(houses)} houses, every pair forced")
