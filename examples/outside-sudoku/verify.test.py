# clue_groups(link, W, n): the local board ships drawn groups, the global
# board rebuilds the same 4n frame lines from framebuild + frame. No single
# shipped link has both branches, so this checks the two branches agree with
# each other on the two boards that each carry one.
#
#   uv run --with lzstring --with ortools examples/outside-sudoku/verify.test.py

import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from link_codec import decode_puzzle
from link_swap import find_constraint
from verify import CONSTRAINT_NAME, clue_groups


def _decode(link_file):
    return decode_puzzle((HERE / link_file).read_text().strip())


def _groups(link):
    W = link["puzzle"]["width"]
    return clue_groups(link, W, W - 2)


def test_drawn_groups_and_rebuilt_frame_lines_agree():
    local = _decode("PUZZLE_LINK_local.txt")
    globl = _decode("PUZZLE_LINK.txt")
    # Pin which branch each board actually takes: without this, forcing
    # clue_groups to skip the drawn branch leaves both boards on the
    # rebuild path and the comparison below turns tautological.
    assert find_constraint(local, CONSTRAINT_NAME)["input"].get("groups") is not None
    assert find_constraint(globl, CONSTRAINT_NAME)["input"].get("groups") is None

    n = local["puzzle"]["width"] - 2
    assert globl["puzzle"]["width"] - 2 == n, "the two boards must be the same size"

    drawn = {tuple(g) for g in _groups(local)}
    rebuilt = {tuple(g) for g in _groups(globl)}
    assert drawn == rebuilt, "local's drawn groups and the global rebuild disagree"
    assert len(drawn) == 4 * n, "expected one group per frame side per index"

    # The clue cell is first in every group -- main's `clue, *line = group`
    # relies on it, and the set-equality check above cannot catch a shared
    # convention flip since both branches derive from the same geometry.
    region = next(c for c in local["puzzle"]["constraints"] if c.get("type") == 1)[
        "regions"
    ]
    for clue, *line in drawn:
        assert region[clue] < 0, "the first cell must be the ring, not the interior"
        assert all(region[c] >= 0 for c in line), "the rest must be interior"


def test_local_branch_returns_the_link_s_own_drawn_cells_verbatim():
    # The rebuild math reproduces the drawn board's cells by design, so
    # forcing clue_groups off the drawn branch still passes the agreement
    # check above -- both sides land on the rebuild path and match by
    # coincidence, not because the drawn branch ran. A planted sentinel the
    # rebuild could never produce closes that gap.
    doc = _decode("PUZZLE_LINK_local.txt")
    find_constraint(doc, CONSTRAINT_NAME)["input"]["groups"][0]["cells"] = [999999]
    assert [999999] in _groups(doc), "clue_groups must return drawn cells verbatim"


if __name__ == "__main__":
    test_drawn_groups_and_rebuilt_frame_lines_agree()
    test_local_branch_returns_the_link_s_own_drawn_cells_verbatim()
    print("ok")
