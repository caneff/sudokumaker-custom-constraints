# Turn a built quad-rank link back into the {grid, clues, givens} shape, so the
# ground-truth count runs on exactly what the app was handed (#335).
#
#   uv run --with lzstring proto/link_to_puzzle.py <link.txt> <out.json>

import json
import pathlib
import sys

sys.path.insert(
    0, str(pathlib.Path(__file__).resolve().parents[1] / "examples/_shared")
)
from link_codec import decode_puzzle

pz = decode_puzzle(pathlib.Path(sys.argv[1]).read_text().strip())["puzzle"]
n = pz["width"]
grid = [[0] * n for _ in range(n)]
givens = []
for i, cell in enumerate(pz["cells"]):
    if cell.get("given"):
        r, c = divmod(i, n)
        grid[r][c] = cell["value"]
        givens.append([r, c])
groups = [c for c in pz["constraints"] if c.get("type") == 1000][0]["input"]["groups"]
clues = []
for g in groups:
    r, c = divmod(g["cells"][0], n)
    clues.append([r, c, int(g["value"])])
out = {"grid": grid, "clues": clues, "givens": givens}
pathlib.Path(sys.argv[2]).write_text(json.dumps(out))
print(f"{sys.argv[2]}: {n}x{n}, {len(clues)} clues, {len(givens)} givens")
