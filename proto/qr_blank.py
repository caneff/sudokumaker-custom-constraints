"""Largest blank rectangle a unique quad-rank puzzle can leave (aside to #328).

    uv run --with ortools proto/qr_blank.py grids.json <grid-index>

"Blank" means no clued window TOUCHES the rectangle -- a clue covers four
cells, so avoiding only its top-left would still draw ink into the open space.
No digit givens either.

Rectangles are tried largest area first. Cluing every window that avoids a
rectangle is the most information a puzzle can carry under that constraint, so
if that is not unique, no subset is and the rectangle is impossible. Only the
first feasible rectangle pays for a clue minimization.
"""

import sys
from pathlib import Path

from qr_cpsat import unique
from qr_probe import load


def rects(n):
    """Every rectangle, largest area first."""
    out = [
        (r0, c0, h, w)
        for h in range(1, n + 1)
        for w in range(1, n + 1)
        for r0 in range(n - h + 1)
        for c0 in range(n - w + 1)
    ]
    out.sort(key=lambda t: -(t[2] * t[3]))
    return out


def allowed(n, truth, rect):
    """Windows whose four cells all miss the rectangle."""
    r0, c0, h, w = rect
    inside = {(r, c) for r in range(r0, r0 + h) for c in range(c0, c0 + w)}
    return {
        (r, c): k
        for (r, c), k in truth.items()
        if not ({(r, c), (r, c + 1), (r + 1, c), (r + 1, c + 1)} & inside)
    }


def minimize(n, box, grid, clues, rng_order):
    for w in rng_order:
        if w not in clues:
            continue
        trial = {k: v for k, v in clues.items() if k != w}
        if unique(n, box, grid, trial, {}, 180.0)[0] == "unique":
            clues = trial
    return clues


def render(n, clues, rect):
    r0, c0, h, w = rect
    inside = {(r, c) for r in range(r0, r0 + h) for c in range(c0, c0 + w)}
    band = "+" + "+".join(["-" * 11] * 3) + "+"
    out = []
    for r in range(n):
        if r % 3 == 0:
            out.append(band)
        row = "|"
        for c in range(n):
            if (r, c) in clues:
                row += f" {clues[(r, c)]:>2}"
            elif (r, c) in inside:
                row += "  #"
            else:
                row += "  ."
            if c % 3 == 2:
                row += " |"
        out.append(row)
    out.append(band)
    return "\n".join(out)


if __name__ == "__main__":
    path, idx = sys.argv[1], int(sys.argv[2])
    n, box, cases = load(path)
    grid, truth = cases[idx]
    tried = 0
    for rect in rects(n):
        pool = allowed(n, truth, rect)
        if not pool:
            continue
        tried += 1
        if unique(n, box, grid, pool, {}, 180.0)[0] != "unique":
            continue
        area = rect[2] * rect[3]
        print(
            f"feasible: {rect[2]}x{rect[3]} at R{rect[0] + 1}C{rect[1] + 1} "
            f"(area {area}), {len(pool)} windows available -- minimizing",
            flush=True,
        )
        clues = minimize(n, box, grid, pool, sorted(pool, key=lambda w: (w[0], w[1])))
        text = (
            f"Quad Rank 9x9 - {len(clues)} clues, no givens, "
            f"{rect[2]}x{rect[3]} blank block at R{rect[0] + 1}C{rect[1] + 1}\n\n"
            "# marks the blank block: no clued window touches any of it.\n"
            "Numbers sit on the top-left cell of the window they rank.\n\n"
            + render(n, clues, rect)
            + "\n\nSolution:\n"
            + "\n".join("".join(str(d) for d in row) for row in grid)
            + "\n"
        )
        Path("proto/BLANK_328.txt").write_text(text)
        print(text)
        print(f"rectangles tested: {tried}")
        break
