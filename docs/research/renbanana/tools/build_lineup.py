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
POOLS = {"candidates": "free", "candidates-2x4": "forced 2x4"}

sys.path.insert(0, str(ROOT.parent))
import renbanana_verify as rv


def rows():
    out = []
    for pool, label in POOLS.items():
        for path in sorted((ROOT / pool).glob("cand_*.json")):
            d = json.loads(path.read_text())
            is_choc = {
                (r, c): ch == "C"
                for r, row in enumerate(d["shading"])
                for c, ch in enumerate(row)
            }
            # One id per maximal group, chocolate and banana alike, so the page
            # can outline a group and light it up on hover.
            gid = [[-1] * 9 for _ in range(9)]
            gsize = []
            bcircles = []
            for colour in (True, False):
                for group in rv.components(is_choc, colour):
                    for r, c in group:
                        gid[r][c] = len(gsize)
                    gsize.append(len(group))
                    if colour:
                        continue
                    # A banana circle is as legal as a chocolate one -- the
                    # verifier checks both -- but the generator never scores
                    # them, so they are recovered here. A banana group is a
                    # renban, its digits distinct, so at most one cell in it
                    # can equal the group's size.
                    for r, c in sorted(group):
                        if int(d["grid"][r][c]) == len(group):
                            bcircles.append([r, c])
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
                    "circles": [list(p) for p in d.get("circles", [])],
                    "bcircles": bcircles,
                    "gid": gid,
                    "gsize": gsize,
                    "shapes": prof["shapes"],
                    "cells": prof["chocolate_cells"],
                    "groups": prof["chocolate_groups"],
                    "largest": prof["largest_rectangle"],
                    "circleable": prof["circleable_groups"],
                    "bananaCircles": len(bcircles),
                    "bananaValue": sum(gsize[gid[r][c]] for r, c in bcircles),
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
