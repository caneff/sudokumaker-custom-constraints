"""Rebuild lineup.html from the candidate pools: DATA spliced into lineup_template.html.

    uv run python docs/research/renbanana/tools/build_lineup.py

Every `cand_*.json` under a pool directory becomes one card. A pool's name is
the run label on the card, so a new hunt only needs a line in POOLS.
"""

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
POOLS = {
    "candidates": "free",
    "candidates-2x4": "forced 2x4",
    "candidates-multi2": "2+ rectangles",
    "candidates-multi3": "3+ rectangles",
    "candidates-only22": "circled 2x2",
    "candidates-only23": "circled 2x3",
    "candidates-circ2": "circled 2x2 + 2x3",
}

sys.path.insert(0, str(ROOT.parent))
import renbanana_verify as rv


def rows():
    out = []
    for pool, label in POOLS.items():
        if not (ROOT / pool).is_dir():  # a hunt that has not been run
            continue
        for path in sorted((ROOT / pool).glob("cand_*.json")):
            # A hunt still running writes here; take whatever it has so far.
            d = json.loads(path.read_text())
            is_choc = {
                (r, c): ch == "C"
                for r, row in enumerate(d["shading"])
                for c, ch in enumerate(row)
            }
            # One id per maximal group, chocolate and banana alike, so the page
            # can outline a group and light it up on hover.
            grid = {
                (r, c): int(ch)
                for r, row in enumerate(d["grid"])
                for c, ch in enumerate(row)
            }
            gid = [[-1] * 9 for _ in range(9)]
            gsize = []
            circles = []  # every chocolate cell that could take a circle
            bcircles = []  # on a banana group of size < 5: says something
            forced = []  # on a banana group of size >= 5: says nothing, below
            for colour in (True, False):
                for group in rv.components(is_choc, colour):
                    for r, c in group:
                        gid[r][c] = len(gsize)
                    gsize.append(len(group))
                    if colour:
                        # A rectangle repeats digits, so more than one of its
                        # cells can equal its size. The generator records one
                        # per group for scoring; every site is drawn.
                        circles += [
                            [r, c] for r, c in sorted(group) if grid[r, c] == len(group)
                        ]
                        continue
                    # A banana circle is as legal as a chocolate one -- the
                    # verifier checks both -- but the generator never scores
                    # them, so they are recovered here. A banana group is a
                    # renban holding the run [m, m+k-1], so at most one cell
                    # can equal k, and one does exactly when m <= k. The run
                    # must fit in 1..9, so m <= 10-k, and the circle fails only
                    # for m in [k+1, 10-k] -- empty once k >= 5. Every banana
                    # group of five cells or more therefore carries a circle
                    # whatever its digits, so that circle rules out no shading
                    # and is tracked apart from the ones that do.
                    k = len(group)
                    for r, c in sorted(group):
                        if grid[r, c] == k:
                            (forced if k >= 5 else bcircles).append([r, c])
                            break
            prof = d["profile"]
            out.append(
                {
                    "i": len(out),
                    "id": f"{pool}/{path.stem}",
                    "run": label,
                    "seed": d["seed"],
                    "value": d["value"],
                    "grid": d["grid"],
                    "shading": d["shading"],
                    "circles": circles,
                    "bcircles": bcircles,
                    "forced": forced,
                    "gid": gid,
                    "gsize": gsize,
                    "shapes": prof["shapes"],
                    "cells": prof["chocolate_cells"],
                    "groups": prof["chocolate_groups"],
                    "largest": prof["largest_rectangle"],
                    "circleable": prof["circleable_groups"],
                    "bananaCircles": len(bcircles),
                    "forcedCircles": len(forced),
                }
            )
    return out


def main():
    data = rows()
    tpl = (HERE / "lineup_template.html").read_text()
    marker = "const DATA=[];\n"
    assert tpl.count(marker) == 1, "template must hold exactly one DATA line"
    blob = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    (ROOT / "lineup.html").write_text(tpl.replace(marker, f"const DATA={blob};\n", 1))
    print(f"{len(data)} grids -> {ROOT / 'lineup.html'}")


if __name__ == "__main__":
    main()
