import json
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "_shared"))

from board_kit import box, givens_of
from board_kit import count_solutions as count_with
from build_sparse_required_digits import (
    BASELINE_NAME,
    CANDIDATE_NAME,
    GEN,
    RESEARCH_DIR,
    backend_code,
    build,
    is_house,
    model,
)
from link_codec import decode_puzzle


def count_solutions(groups, givens):
    return count_with(model, groups, givens)


NAMES = ["PUZZLE_LINK_sparse.txt", "PUZZLE_LINK_sparse_original.txt"]


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
    full = {(r, c): v for r, row in enumerate(gen["grid"]) for c, v in enumerate(row)}
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

    cand = backend_code(gen, CANDIDATE_NAME)
    base = backend_code(gen, BASELINE_NAME)
    assert cand.replace(CANDIDATE_NAME, BASELINE_NAME) == base
    assert cand != base and BASELINE_NAME in base

    shipped = {n: (RESEARCH_DIR / n).read_bytes() for n in NAMES}
    mtime = {n: (RESEARCH_DIR / n).stat().st_mtime_ns for n in NAMES}
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp)
        build(out)
        for n in NAMES:
            assert (out / n).read_bytes() == shipped[n], f"{n} does not reproduce"
    for n in NAMES:
        assert (RESEARCH_DIR / n).stat().st_mtime_ns == mtime[n], (
            f"{n} touched by --out"
        )

    docs = [decode_puzzle(shipped[n].decode().strip()) for n in NAMES]
    cand_doc, base_doc = docs
    for d in docs:
        # a plain 9x9 is a sudoku document: rows and columns come from
        # the app's own rules, so no "Rows & Columns" backend rides along
        assert d["puzzle"]["type"] == "sudoku", "the board is not a sudoku document"
        names = [
            (c.get("definition") or {}).get("name") for c in d["puzzle"]["constraints"]
        ]
        assert "Rows & Columns" not in names, "a row/column backend is still carried"
    cand_c = cand_doc["puzzle"]["constraints"][-1]["definition"]
    base_c = base_doc["puzzle"]["constraints"][-1]["definition"]
    assert [c["name"] for c in cand_c["components"]] == [CANDIDATE_NAME]
    assert base_c["components"] == []
    cand_doc["puzzle"]["constraints"][-1]["definition"]["components"] = []
    cand_doc["puzzle"]["constraints"][-1]["definition"]["backend"]["code"] = base_c[
        "backend"
    ]["code"]
    assert cand_doc == base_doc, "the two links differ beyond the component code"
    print("ok")
