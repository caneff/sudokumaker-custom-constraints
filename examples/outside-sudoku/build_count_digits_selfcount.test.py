# build_count_digits_selfcount.py (#581): the committed self-counting board is
# a valid, CP-SAT-unique sudoku whose every group's counter is its own first
# target; both links carry the same board and the same `input.groups`
# (counter, counter, ...) and differ only in the component code -- the current
# one, or the pre-#578 copy; entered 0, exactly one custom constraint each; a
# rebuild reproduces the committed links byte for byte.
#
#   uv run examples/outside-sudoku/build_count_digits_selfcount.test.py

import json
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "_shared"))

from build_count_digits_selfcount import (
    BOARD_DIR,
    CURRENT,
    EVENS,
    GEN,
    PRE578,
    VARIANTS,
    build,
    build_doc,
)
from build_sparse_count_digits import count_solutions, givens_of
from link_codec import decode_puzzle
from minify import minify_file

N = 9


def check_board(gen):
    used = []
    for g in gen["groups"]:
        cells = [tuple(p) for p in g["cells"]]
        counter = tuple(g["counter"])
        assert cells[0] == counter, f"{g['name']}: the counter is not the first target"
        assert len(set(cells)) == len(cells), f"{g['name']}: repeated cell"
        assert g["values"] == EVENS
        hits = sum(1 for r, c in cells if gen["grid"][r][c] in EVENS)
        assert gen["grid"][counter[0]][counter[1]] == hits, (
            f"{g['name']}: the solution's counter digit is not the count"
        )
        used += cells
    assert len(set(used)) == len(used), "two groups share a cell"
    assert count_solutions(gen["groups"], givens_of(gen)) == 1, "not unique"


def check_self_counting_is_modelled(gen):
    """The CP-SAT model counts the counter among its own targets: a group
    over the solution whose counter digit is off by one has no solution."""
    full = {(r, c): v for r, row in enumerate(gen["grid"]) for c, v in enumerate(row)}
    g = gen["groups"][0]
    assert count_solutions([g], full) == 1
    r, c = g["counter"]
    dropped = {**g, "cells": g["cells"][1:]}  # counter no longer counted
    even = gen["grid"][r][c] in EVENS
    assert count_solutions([dropped], full) == (0 if even else 1), (
        "the model ignores whether the counter counts itself"
    )


def only_custom(doc):
    cs = [c for c in doc["puzzle"]["constraints"] if c.get("type") == 1000]
    assert len(cs) == 1
    return cs[0]


def check_links(gen):
    docs = {}
    for variant in VARIANTS:
        link = BOARD_DIR / f"PUZZLE_LINK_selfcount_{variant}.txt"
        doc = decode_puzzle(link.read_text().strip())
        docs[variant] = doc
        p = doc["puzzle"]
        assert p["type"] == "sudoku" and variant in p["name"]
        assert p["comment"].startswith("Normal sudoku rules apply on the inner grid.")
        givens = givens_of(gen)
        for i, cell in enumerate(p["cells"]):
            assert bool(cell.get("given")) == ((i // N, i % N) in givens), f"cell {i}"
            if not cell.get("given"):
                assert cell == {}, f"cell {i} carries a value or mark"
        c = only_custom(doc)
        assert "disabled" not in c
        for drawn, g in zip(c["input"]["groups"], gen["groups"], strict=True):
            counter = g["counter"][0] * N + g["counter"][1]
            targets = [r * N + col for r, col in g["cells"]]
            # the colleague's spelling: the counter, then targets led by it
            assert drawn["cells"] == [counter, *targets]
            assert drawn["cells"][:2] == [counter, counter]
            assert drawn["value"] == "2 4 6 8"
        code = c["definition"]["components"][0]["code"]
        want = CURRENT if variant == "current" else PRE578
        assert code == minify_file(want, keep_comments=True)
        # one cage element per group, pinned to the groups the solver reads
        cages = [k for k in p["constraints"] if k.get("type") == 2001]
        assert len(cages) == len(gen["groups"])
        for k, drawn in zip(cages, c["input"]["groups"], strict=True):
            group_cage, counter_cage = k["cages"]
            assert group_cage["cells"] == drawn["cells"][1:]
            assert counter_cage["cells"] == drawn["cells"][:1]
            assert group_cage["value"] == drawn["value"]
    cur, old = only_custom(docs["current"]), only_custom(docs["pre578"])
    assert cur["input"] == old["input"], "the two links carry different groups"
    assert cur["definition"]["backend"] == old["definition"]["backend"]
    assert (
        cur["definition"]["components"][0]["code"]
        != (old["definition"]["components"][0]["code"])
    ), "the two links carry the same component"
    strip = lambda d: [k for k in d["puzzle"]["constraints"] if k.get("type") != 1000]
    assert strip(docs["current"]) == strip(docs["pre578"])
    assert docs["current"]["puzzle"]["cells"] == docs["pre578"]["puzzle"]["cells"]

    shipped = {
        v: (BOARD_DIR / f"PUZZLE_LINK_selfcount_{v}.txt").read_bytes() for v in VARIANTS
    }
    with tempfile.TemporaryDirectory() as tmp:
        for path in build(pathlib.Path(tmp) / "not" / "yet"):
            v = path.name.removeprefix("PUZZLE_LINK_selfcount_").removesuffix(".txt")
            assert path.read_bytes() == shipped[v], f"{v} does not reproduce"
    assert build_doc(gen, "current")


if __name__ == "__main__":
    gen = json.loads(GEN.read_text())
    check_board(gen)
    for alt in ("gen_5x8.json", "gen_5x10.json"):
        check_board(json.loads((BOARD_DIR / alt).read_text()))
    check_self_counting_is_modelled(gen)
    check_links(gen)
    print("ok")
