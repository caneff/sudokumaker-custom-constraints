# build_clued.py: the clued link decodes to the hard board's interior plus 36
# filled ring cells, and its original-wrapper twin differs from it only in the
# constraint code (the same check build_original.py runs). Prior art:
# build_link.test.py.
#
#   uv run --with lzstring examples/numbered-rooms/build_clued.test.py

import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_clued import CONSTRAINT_NAME, build
from link_codec import decode_puzzle
from link_swap import blanked, find_constraint

if __name__ == "__main__":
    base = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
    clued, clued_original = build()

    groups = find_constraint(base, CONSTRAINT_NAME)["input"]["groups"]
    ring = {g["cells"][0] for g in groups}
    assert len(ring) == 36, f"expected 36 clue cells, found {len(ring)}"

    base_cells = base["puzzle"]["cells"]
    clued_cells = clued["puzzle"]["cells"]

    # every ring cell now holds a value in the clued link
    for i in ring:
        assert clued_cells[i].get("value") is not None, f"clue cell {i} still blank"

    # the interior (every non-ring cell) is untouched
    for i in range(len(base_cells)):
        if i not in ring:
            assert clued_cells[i] == base_cells[i], f"interior cell {i} changed"

    # the constraint code is exactly the currently-shipped component, unchanged
    assert (
        find_constraint(clued, CONSTRAINT_NAME)["definition"]["components"]
        == find_constraint(base, CONSTRAINT_NAME)["definition"]["components"]
    )
    assert (
        find_constraint(clued, CONSTRAINT_NAME)["definition"]["backend"]
        == find_constraint(base, CONSTRAINT_NAME)["definition"]["backend"]
    )

    # the original-wrapper twin differs from the clued link only in the
    # constraint code -- same board, same 36 filled clues, same interior.
    # blanked() empties the code fields, so an equal result here means
    # everything else (cells, backend/component names, styling) matches; the
    # original wrapper renames its component and swaps the backend too (see
    # build_original.py), so the code fields themselves must differ.
    assert blanked(clued, CONSTRAINT_NAME) == blanked(clued_original, CONSTRAINT_NAME)
    assert (
        find_constraint(clued, CONSTRAINT_NAME)["definition"]["components"]
        != find_constraint(clued_original, CONSTRAINT_NAME)["definition"]["components"]
    )

    print("ok")
