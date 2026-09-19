# build_sparse_count_digits.py (#543): the committed sparse board's gen.json is
# a valid board (scattered non-trivial groups, its own solution obeying the
# count rule, CP-SAT-unique from its givens), the rebuild reproduces both
# committed links byte-identically without touching them, and the two links
# differ only in the one class the backend registers.
#
#   uv run examples/outside-sudoku/build_sparse_count_digits.test.py

import json
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "_shared"))

from build_sparse_count_digits import (
    BASELINE_NAME,
    CANDIDATE_NAME,
    COMPONENT,
    GEN,
    RESEARCH_DIR,
    backend_code,
    build,
    count_solutions,
    givens_of,
)
from link_codec import decode_puzzle
from minify import minify_file

NAMES = ["PUZZLE_LINK_sparse.txt", "PUZZLE_LINK_sparse_original.txt"]
N = 9


def count(gen, group):
    """The group's own count in the solution grid: target cells holding a
    listed digit. The rule, restated here rather than imported, so a change to
    the model has to agree with a second statement of it."""
    return sum(
        1
        for r, c in (tuple(p) for p in group["cells"])
        if gen["grid"][r][c] in group["values"]
    )


def check_board(gen):
    groups = gen["groups"]
    # the shape the README's recorded rows describe
    assert len(groups) == 20, "the timed board has 20 groups"
    for g in groups:
        cells = [tuple(p) for p in g["cells"]]
        counter = tuple(g["counter"])
        assert len(set(cells)) == len(cells) == 14, (
            f"{g['name']}: not 14 distinct cells"
        )
        assert len(g["values"]) == 3, f"{g['name']}: not 3 listed digits"
        assert counter not in set(cells), (
            f"{g['name']}: the counter is one of its targets"
        )
        assert gen["grid"][counter[0]][counter[1]] == count(gen, g), (
            f"{g['name']}: the solution's counter digit is not the count"
        )
    carve_order = [tuple(p) for p in gen["carve_order"]]
    assert len(set(carve_order)) == len(carve_order), "a cell is carved twice"
    assert 0 <= gen["carved"] <= len(carve_order), "carved is outside the carve order"
    assert count_solutions(groups, givens_of(gen)) == 1, (
        "not unique under the CP-SAT model"
    )


def check_rule_is_enforced(gen):
    """The CP-SAT model states the rule: with the whole solution as givens, a
    group whose counter digit is the count is feasible, and the same group with
    a digit set that moves the count is not."""
    full = {(r, c): v for r, row in enumerate(gen["grid"]) for c, v in enumerate(row)}
    g = gen["groups"][0]
    assert count_solutions([g], full) == 1, (
        "the solution does not satisfy its own group"
    )
    wrong = [
        d
        for d in range(1, N + 1)
        if d not in g["values"]
        and count(gen, {**g, "values": g["values"] + [d]}) != count(gen, g)
    ]
    assert wrong, "fixture: no digit changes this group's count"
    moved = {**g, "values": sorted(g["values"] + [wrong[0]])}
    assert count_solutions([moved], full) == 0, (
        "a group with the wrong count is still feasible"
    )


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
        # a plain 9x9 is a sudoku document (#565): rows and columns come from
        # the app's own rules, so no "Rows & Columns" backend rides along
        assert d["puzzle"]["type"] == "sudoku", "the board is not a sudoku document"
        names = [c.get("definition", {}).get("name") for c in d["puzzle"]["constraints"]]
        assert "Rows & Columns" not in names, "a row/column backend is still carried"
    cand_c = cand_doc["puzzle"]["constraints"][-1]["definition"]
    base_c = base_doc["puzzle"]["constraints"][-1]["definition"]
    assert [c["name"] for c in cand_c["components"]] == [CANDIDATE_NAME]
    # the shipped component is the committed file, so an edit to it that is not
    # rebuilt into the link fails here rather than being timed as the old code
    assert cand_c["components"][0]["code"] == minify_file(COMPONENT)
    assert base_c["components"] == [], "the baseline link ships no component code"
    cand_doc["puzzle"]["constraints"][-1]["definition"]["components"] = []
    cand_doc["puzzle"]["constraints"][-1]["definition"]["backend"]["code"] = base_c[
        "backend"
    ]["code"]
    assert cand_doc == base_doc, "the two links differ beyond the component code"
    print("ok")
