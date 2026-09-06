# Audit a built quad-rank link: board size, givens, groups, region shape (#335).
#
#   uv run --with lzstring proto/audit_link.py <link.txt>

import pathlib
import sys

sys.path.insert(
    0, str(pathlib.Path(__file__).resolve().parents[1] / "examples/_shared")
)
from link_codec import decode_puzzle

doc = decode_puzzle(pathlib.Path(sys.argv[1]).read_text().strip())
pz = doc["puzzle"]
cells = pz["cells"]
filled = [(i, c) for i, c in enumerate(cells) if c]
print(
    "board",
    pz["width"],
    "x",
    pz["height"],
    "values",
    pz["minDigit"],
    "-",
    pz["maxDigit"],
)
print(
    "cells with content:",
    len(filled),
    "of which given:",
    sum(1 for _, c in filled if c.get("given")),
)
print("constraint types:", [c.get("type") for c in pz["constraints"]])
custom = [c for c in pz["constraints"] if c.get("type") == 1000][0]
groups = custom["input"]["groups"]
print("groups:", len(groups), groups[:2])
regions = [c for c in pz["constraints"] if c.get("type") == 1][0]["regions"]
print("region count:", len(set(regions)), "first row:", regions[: pz["width"]])
