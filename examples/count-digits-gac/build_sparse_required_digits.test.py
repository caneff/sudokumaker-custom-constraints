import json
import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "_shared"))

from board_kit import box, givens_of
from build_sparse_required_digits import (
    BACKEND,
    BASELINE_NAME,
    BOARD_DIR,
    CANDIDATE_NAME,
    COMPONENT,
    GEN,
    build,
    is_house,
    model,
)
from count_test_kit import check_same_board_pair, counter_for, full_givens

count_solutions = counter_for(model)


def check_board(gen):
    groups = gen["groups"]
    # the shape the README's recorded rows describe (20 groups, 5 digits each)
    assert len(groups) == 20, "the timed board has 20 groups"
    assert all(len(g["values"]) == 5 for g in groups), "5 required digits each"
    for g in groups:
        cells = [tuple(p) for p in g["cells"]]
        assert len(set(cells)) == len(cells) == 9, f"{g['name']}: not 9 distinct cells"
        assert not is_house(cells), f"{g['name']} is a house: its rule is vacuous"
        assert len({box(r, c) for r, c in cells}) >= 3, f"{g['name']}: under 3 boxes"
        held = [gen["grid"][r][c] for r, c in cells]
        for d in set(g["values"]):
            assert held.count(d) >= g["values"].count(d), (
                f"{g['name']}: the solution does not hold {d}"
            )
    assert count_solutions(groups, givens_of(gen)) == 1, (
        "not unique under the CP-SAT model"
    )


def check_rule_is_enforced(gen):
    full = full_givens(gen)
    g = gen["groups"][0]
    held = {full[tuple(p)] for p in g["cells"]}
    absent = sorted(set(range(1, 10)) - held)
    assert absent, "fixture: the group must miss some digit"
    assert count_solutions([{**g, "values": sorted(held)}], full) == 1
    assert count_solutions([{**g, "values": [absent[0]]}], full) == 0


if __name__ == "__main__":
    gen = json.loads(GEN.read_text())
    check_board(gen)
    check_rule_is_enforced(gen)

    check_same_board_pair(
        gen,
        board_dir=BOARD_DIR,
        build=build,
        backend=BACKEND,
        candidate=CANDIDATE_NAME,
        baseline=BASELINE_NAME,
        component=COMPONENT,
    )
    print("ok")
