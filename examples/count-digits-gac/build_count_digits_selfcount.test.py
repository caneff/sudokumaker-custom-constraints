import json
import pathlib
import sys
import tempfile

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE.parent / "_shared"))

from board_kit import count_solutions as count_with
from board_kit import givens_of
from build_count_digits_selfcount import (
    BOARD_DIR,
    CURRENT,
    EVENS,
    GEN,
    PRE578,
    VARIANTS,
    build,
)
from count_board import model
from link_codec import decode_puzzle
from minify import minify_file

N = 9


def count_solutions(groups, givens):
    return count_with(model, groups, givens)


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
    """Only a counter holding an even digit tells the two readings apart: an
    odd counter changes no count either way, so a test on one proves nothing."""
    full = {(r, c): v for r, row in enumerate(gen["grid"]) for c, v in enumerate(row)}
    evens = [g for g in gen["groups"] if full[tuple(g["counter"])] in EVENS]
    assert evens, "fixture: no group's counter holds an even digit"
    for g in evens:
        assert count_solutions([g], full) == 1, (
            f"{g['name']}: the model does not count the counter among its targets"
        )
        dropped = {**g, "cells": g["cells"][1:]}
        assert count_solutions([dropped], full) == 0, (
            f"{g['name']}: the model ignores whether the counter counts itself"
        )


def check_search_keeps_counter_off_the_label_corner():
    """A cage label draws in the group's top-left cell, so a draw never puts
    the counter's own # there. (The committed gen.json breaks this once;
    self-count/README.md names it.)"""
    import random

    from build_count_digits_selfcount import draw_group

    grid = json.loads(GEN.read_text())["grid"]
    drawn = 0
    for seed in range(300):
        g = draw_group(random.Random(seed), grid, set(), 0, 8)
        if g is not None:
            drawn += 1
            assert tuple(g["counter"]) != min(map(tuple, g["cells"])), f"seed {seed}"
    assert drawn > 20, "the guard rejects nearly every draw"


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
        assert p["comment"].startswith("Normal sudoku rules apply.")
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


if __name__ == "__main__":
    gen = json.loads(GEN.read_text())
    check_board(gen)
    for alt in ("gen_6x8_first.json", "gen_5x10_ratio.json"):
        check_board(json.loads((BOARD_DIR / alt).read_text()))
    check_search_keeps_counter_off_the_label_corner()
    check_self_counting_is_modelled(gen)
    check_links(gen)
    print("ok")
