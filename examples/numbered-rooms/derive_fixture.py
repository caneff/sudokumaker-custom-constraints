# Derive the recovery-probe fixture from the hand-made puzzle. Numbered Rooms
# has no generator; the solution, givens, box regions, and clue+line groups all
# live inside the SudokuMaker document (numbered_rooms.url). This decodes that
# document the same way build_link.py does and writes gen_9.json — the start
# state examples/numbered-rooms/recovery-probe.mjs seeds.
#
#   uv run --with lzstring examples/numbered-rooms/derive_fixture.py
#
# The grid is 11x11: an interior 9x9 (rows/cols 1..9, cell index r*11 + c) inside
# a one-cell frame that holds the outside clue cells. Every cell carries its
# solution `value`; `given: true` marks a given. All 36 clues are hidden (no
# clue is given) — the probe recovers them from the interior and the components.

import json
import pathlib
import urllib.parse
from collections import defaultdict

from lzstring import LZString

HERE = pathlib.Path(__file__).parent
W = 11
N = 9


def decode():
    url = (HERE / "numbered_rooms.url").read_text().strip()
    payload = url.split("puzzle=")[-1]
    return json.loads(
        LZString.decompressFromEncodedURIComponent(urllib.parse.unquote(payload))
    )


def build():
    doc = decode()
    p = doc["puzzle"]
    cells = p["cells"]

    def value(i):
        c = cells[i]
        return c["value"] if isinstance(c, dict) and "value" in c else None

    interior = [r * W + c for r in range(1, N + 1) for c in range(1, N + 1)]

    regions = next(
        c["regions"] for c in p["constraints"] if c.get("type") == 1 and "regions" in c
    )
    by_region = defaultdict(list)
    for i in interior:
        by_region[regions[i]].append(i)
    boxes = [sorted(v) for k, v in sorted(by_region.items()) if len(v) == N]

    nr = next(
        c
        for c in p["constraints"]
        if c.get("definition", {}).get("name") == "Custom Numbered Rooms"
    )
    groups = [{"cells": g["cells"]} for g in nr["input"]["groups"]]
    clue_cells = [g["cells"][0] for g in groups]

    solution = {}
    for i in interior + clue_cells:
        v = value(i)
        if v is None:
            raise SystemExit(f"cell {i} has no solution value")
        solution[str(i)] = v

    givens = [
        i for i in interior if isinstance(cells[i], dict) and cells[i].get("given")
    ]

    return {
        "n": N,
        "W": W,
        "box": [3, 3],
        "groups": groups,
        "boxes": boxes,
        "solution": solution,
        "givens": givens,
    }


def check(gen):
    # rows, columns, boxes are each a permutation of 1..9 on the solution
    sol = gen["solution"]
    interior = [r * W + c for r in range(1, N + 1) for c in range(1, N + 1)]

    def perm(idxs):
        return sorted(sol[str(i)] for i in idxs) == list(range(1, N + 1))

    for r in range(1, N + 1):
        assert perm([r * W + c for c in range(1, N + 1)]), f"row {r} not a permutation"
    for c in range(1, N + 1):
        assert perm([r * W + c for r in range(1, N + 1)]), f"col {c} not a permutation"
    for b in gen["boxes"]:
        assert perm(b), f"box {b} not a permutation"
    # the Numbered Rooms rule holds on the solution for every clued line
    for g in gen["groups"]:
        clue = sol[str(g["cells"][0])]
        line = g["cells"][1:]
        k = sol[str(line[0])]
        assert 1 <= k <= len(line) and sol[str(line[k - 1])] == clue, (
            f"NR rule broken on {g}"
        )
    assert len(gen["givens"]) == 31, gen["givens"]
    assert all(str(i) in sol for i in interior)


if __name__ == "__main__":
    gen = build()
    check(gen)
    (HERE / "gen_9.json").write_text(json.dumps(gen) + "\n")
    print(
        f"wrote gen_9.json ({len(gen['groups'])} clues, {len(gen['givens'])} interior givens)"
    )
