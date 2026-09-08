"""One key per puzzle, so the same grid never enters a pool twice.

Two grids that differ only by a rotation or a reflection are the same puzzle.
The dihedral group of the square is the whole symmetry group that survives
here: it maps the 3x3 boxes onto each other so sudoku holds, it preserves
orthogonal adjacency so the whisper and the shading rules hold, and it carries
the shading and the circles along with the digits.

Digit relabelling is deliberately *not* in the group. `v -> 10 - v` preserves
every absolute difference and every consecutive run, so it does map a legal
grid to a legal one -- but a circle holds its own group's size, and 10 - k is
not k, so relabelling destroys circles. Folding it in would merge grids that
differ in the thing we are hunting for.

The canonical key is the least of the eight images, written as digits then
shading. Equal keys mean the same puzzle; different keys mean genuinely
different ones, and the pool's distance rule then decides whether a different
one is different *enough*.
"""

N = 9
CELLS = [(r, c) for r in range(N) for c in range(N)]


def _rotate(p):
    r, c = p
    return (c, N - 1 - r)


def _flip(p):
    r, c = p
    return (r, N - 1 - c)


def images(grid, is_choc):
    """The eight dihedral images of one shaded grid."""
    out = []
    for flipped in (False, True):
        send = _flip if flipped else (lambda p: p)
        for _ in range(4):
            prev = send
            out.append(
                (
                    {prev(p): grid[p] for p in CELLS},
                    {prev(p): is_choc[p] for p in CELLS},
                )
            )
            send = (lambda f: lambda p: _rotate(f(p)))(prev)
    return out


def key(grid, is_choc):
    """The canonical key: least of the eight images, digits then shading."""
    return min(
        "".join(str(g[r, c]) for r, c in CELLS)
        + "".join("C" if s[r, c] else "b" for r, c in CELLS)
        for g, s in images(grid, is_choc)
    )


def key_from_rows(grid_rows, shading_rows):
    grid = {(r, c): int(grid_rows[r][c]) for r, c in CELLS}
    is_choc = {(r, c): shading_rows[r][c] == "C" for r, c in CELLS}
    return key(grid, is_choc)


def key_grid(grid):
    """The canonical key of the digits alone, shading ignored.

    Legality is invariant under the group, so if one grid carries no legal
    shading then neither does any image of it. That makes this key safe to use
    as a "already tested, do not solve again" marker during a walk.
    """
    return min(
        "".join(str(g[r, c]) for r, c in CELLS)
        for g, _ in images(grid, dict.fromkeys(CELLS, False))
    )
