# Helpers the count-digits builders' tests share: the solution grid as an
# all-givens board, `count_solutions` bound to a builder's own model, the count
# oracle and its checks, and the sparse boards' A/B link-pair check.

import functools
import json
import pathlib
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from board_kit import count_solutions
from minify import minify_file
from sudoku_kit.link_codec import decode_puzzle
from untouched import leaves_untouched

N = 9
NAMES = ["PUZZLE_LINK.txt", "PUZZLE_LINK_original.txt"]


def full_givens(gen):
    """Every cell of the gen's solution grid, as givens."""
    return {(r, c): v for r, row in enumerate(gen["grid"]) for c, v in enumerate(row)}


def counter_for(model):
    """`count_solutions(groups, givens)` under `model`."""
    return functools.partial(count_solutions, model)


def count(gen, group):
    """The group's own count in the solution grid: cells holding a listed
    digit. The rule, restated here rather than imported from a builder, so a
    change to the model has to agree with a second statement of it. `cells` is
    the whole target list, the counter included on a self-counting board."""
    return sum(
        1
        for r, c in (tuple(p) for p in group["cells"])
        if gen["grid"][r][c] in group["values"]
    )


def assert_counter_is_count(gen, group):
    r, c = group["counter"]
    assert gen["grid"][r][c] == count(gen, group), (
        f"{group['name']}: the solution's counter digit is not the count"
    )


def check_rule_is_enforced(gen, count_solutions):
    """The solution satisfies a group, and a group whose digit list changes
    its count is infeasible against that solution."""
    full = full_givens(gen)
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


def check_sparse_pair(
    gen, *, board_dir, build, backend_code, candidate, baseline, component
):
    """A sparse board's candidate/baseline link pair: the backends differ only
    in the class name, a rebuild reproduces the committed links, the pair
    differs only in the component code, and the shipped component is the
    committed file. Returns the candidate's decoded document, whole."""
    cand = backend_code(gen, candidate)
    base = backend_code(gen, baseline)
    assert cand.replace(candidate, baseline) == base
    assert cand != base and baseline in base

    with (
        leaves_untouched([board_dir / n for n in NAMES]) as before,
        tempfile.TemporaryDirectory() as tmp,
    ):
        out = pathlib.Path(tmp)
        build(out)
        for n in NAMES:
            assert (out / n).read_bytes() == before[board_dir / n], (
                f"{n} does not reproduce"
            )

    docs = [decode_puzzle(before[board_dir / n].decode().strip()) for n in NAMES]
    cand_doc, base_doc = docs
    cand_doc_full = json.loads(json.dumps(cand_doc))
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
    assert [c["name"] for c in cand_c["components"]] == [candidate]
    # the shipped component is the committed file, so an edit to it that is not
    # rebuilt into the link fails here rather than being timed as the old code
    assert cand_c["components"][0]["code"] == minify_file(component)
    assert base_c["components"] == [], "the baseline link ships no component code"
    cand_c["components"] = []
    cand_c["backend"]["code"] = base_c["backend"]["code"]
    assert cand_doc == base_doc, "the two links differ beyond the component code"
    return cand_doc_full
