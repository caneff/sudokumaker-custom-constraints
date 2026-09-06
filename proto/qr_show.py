"""Render one minimal quad-rank puzzle (#325).

    uv run --with ortools proto/qr_show.py grids.json <grid-index> <givens> [budget]

Same greedy pass as `qr_probe.py minim`, but it prints the puzzle it lands on.
"""

import random
import sys

from qr_cpsat import unique
from qr_probe import load, pick


def render(n, grid, clues, givens):
    out = []
    band = "+-------+-------+-------+"
    for r in range(n):
        if r % 3 == 0:
            out.append(band)
        row = "|"
        for c in range(n):
            row += " " + (str(grid[r][c]) if (r, c) in givens else ".")
            if c % 3 == 2:
                row += " |"
        out.append(row)
    out.append(band)
    out.append("")
    out.append(
        f"{len(clues)} quad-rank clues (top-left cell -> rank of its 2x2 window):"
    )
    for (r, c), rank in sorted(clues.items()):
        out.append(f"  R{r + 1}C{c + 1} -> {rank}")
    out.append("")
    out.append("Solution:")
    out += ["  " + "".join(str(d) for d in row) for row in grid]
    return "\n".join(out)


if __name__ == "__main__":
    path, idx, gcount = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    budget = float(sys.argv[4]) if len(sys.argv) > 4 else 180.0
    n, box, cases = load(path)
    grid, truth = cases[idx]
    rng = random.Random(2000 + idx)
    clues, givens = pick(n, grid, truth, (n - 1) ** 2, gcount, rng)
    order = list(clues)
    rng.shuffle(order)
    for w in order:
        trial = {k: v for k, v in clues.items() if k != w}
        if unique(n, box, grid, trial, givens, budget)[0] == "unique":
            clues = trial
    v, el = unique(n, box, grid, clues, givens, budget)
    print(render(n, grid, clues, givens))
    print(f"\nverdict: {v} ({el:.2f}s to prove no second solution)")
