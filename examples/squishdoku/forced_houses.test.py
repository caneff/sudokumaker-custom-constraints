# The 7x7 squishdoku backend (main.js) registers only built-in HouseComponents,
# so there is no component to fuzz: the proof that it is sound is that every
# house it registers is forced, i.e. in the rules model no two of the house's
# cells can be equal. One CP-SAT solve per cell pair.
#
#   uv run examples/squishdoku/forced_houses.test.py

import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

from squish_board import SQUISH, registered_houses, unforced_pairs

if __name__ == "__main__":
    houses = registered_houses(HERE / "main.js")

    # the README's claim: 4 crosses, 8 bowties and the central cross
    assert len(houses) == 13, [h["name"] for h in houses]
    assert all(len(set(h["cells"])) == 9 for h in houses), houses

    # every registered house is forced
    bad = [(h["name"], p) for h in houses for p in unforced_pairs(SQUISH, h["cells"])]
    assert not bad, f"houses whose cells can repeat a digit: {bad}"

    # the proof can fail: a row of the board plus two cells off it is no house
    fake = [0, 1, 2, 3, 4, 5, 6, 7, 8]
    assert unforced_pairs(SQUISH, fake), "a made-up house passed the proof"

    print(f"ok - {len(houses)} houses, every pair forced")
