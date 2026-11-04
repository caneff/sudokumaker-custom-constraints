"""The fillomino pipeline, end to end, nothing stubbed, on the rectangular board
(`gen_15g.json`, `PUZZLE_LINK_15g.txt`, seven wide and five high): CP-SAT proves
the clue set unique, the shipped component solves it offline from its link
through `hunt.mjs board`, and the link decodes with exactly the gen's givens and
every other cell empty.

The shipped board is not here: its proof takes about 90 s, so it is
`just verify-fillomino`, which runs the same `prove` (`verify.py`). Each step is
covered elsewhere on its own; what only this test covers is that they agree on
one board.
"""

import json
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))

from verify import prove

with tempfile.TemporaryDirectory() as tmp:
    rect = json.loads((HERE / "gen_15g.json").read_text())
    assert len(rect["grid"]) != len(rect["grid"][0]), "gen_15g.json must not be square"
    prove(
        rect,
        (HERE / "PUZZLE_LINK_15g.txt").read_text().strip(),
        tmp,
        offline_solve=True,
    )

print(
    "pipeline.test.py: the proof, the component and the link agree on the rectangular board"
)
