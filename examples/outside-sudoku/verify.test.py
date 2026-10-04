import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

import verify
from link_codec import decode_puzzle
from sm_document import find_constraint
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
    # Both branches produce the same cells, so the agreement check passes even
    # if the drawn branch never runs; a sentinel the rebuild cannot produce
    # proves it does.
    doc = _decode("PUZZLE_LINK_local.txt")
    find_constraint(doc, CONSTRAINT_NAME)["input"]["groups"][0]["cells"] = [999999]
    assert [999999] in _groups(doc), "clue_groups must return drawn cells verbatim"


def test_a_spent_time_cap_raises_instead_of_printing_a_verdict():
    limit = verify.SOLVE_LIMIT
    verify.SOLVE_LIMIT = 0.0001
    try:
        verify.main(["verify.py", str(HERE / "PUZZLE_LINK.txt")])
    except TimeoutError:
        pass
    else:
        raise AssertionError("a spent time cap printed a verdict")
    finally:
        verify.SOLVE_LIMIT = limit


if __name__ == "__main__":
    test_drawn_groups_and_rebuilt_frame_lines_agree()
    test_a_spent_time_cap_raises_instead_of_printing_a_verdict()
    test_local_branch_returns_the_link_s_own_drawn_cells_verbatim()
    print("ok")
