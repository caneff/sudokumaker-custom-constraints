"""Canonical dedupe key under a finder's declared symmetry group (#483/#484).

`key(candidate)` (part of the finder contract) returns a flat tuple of cell
values, in whatever fixed order the finder chooses. A cell map is a tuple of
source indices the same length as that grid: `transformed[i] = grid[map[i]]`.
`D4` is generated from the grid's own side length (the grid must be square);
`IDENTITY` is the one-element group that changes nothing; a custom group is
any list of such maps, for a rule whose symmetry is not the whole square.

`canonical_key` is the least of the grid's images under the group -- equal
keys mean the same candidate up to that symmetry.
"""

from functools import lru_cache
from math import isqrt

D4 = "D4"
IDENTITY = "IDENTITY"


@lru_cache
def _d4_cell_maps(n):
    """The eight index maps of the n x n dihedral group, flat row-major."""

    def idx(r, c):
        return r * n + c

    rotations = (
        lambda r, c: (r, c),
        lambda r, c: (c, n - 1 - r),
        lambda r, c: (n - 1 - r, n - 1 - c),
        lambda r, c: (n - 1 - c, r),
    )
    maps = []
    for rot in rotations:
        maps.append(tuple(idx(*rot(r, c)) for r in range(n) for c in range(n)))
        maps.append(tuple(idx(*rot(r, n - 1 - c)) for r in range(n) for c in range(n)))
    return maps


@lru_cache
def _validate_custom_group(maps, n):
    """Validate `maps` is a group of permutations of range(n): non-empty,
    each map a bijection, the identity present, and closed under
    composition (which, for a finite set, forces every inverse to be
    present too). Canonicalizing as the minimum image is only an
    equivalence relation when the maps form a group -- a set that is merely
    closed under nothing (e.g. `[identity, rotate90]`, missing the other
    two rotations) can canonicalize two unrelated grids to the same key and
    silently drop one as a false duplicate (#508).

    `maps` must be a tuple of tuples (hashable) so this can be cached --
    the composition check is O(k^2 * n) and `canonical_key` would otherwise
    redo it on every call for a custom-group finder.
    """
    if not maps:
        raise ValueError("a custom symmetry group must not be empty")
    for cell_map in maps:
        if len(cell_map) != n or sorted(cell_map) != list(range(n)):
            raise ValueError(
                f"a custom cell map must be a permutation of range({n}), "
                f"got {cell_map!r}"
            )
    identity = tuple(range(n))
    if identity not in maps:
        raise ValueError(
            f"a custom symmetry group must include the identity map "
            f"{identity!r}, got {maps!r}"
        )
    map_set = set(maps)
    for f in maps:
        for g in maps:
            composed = tuple(f[g[i]] for i in range(n))
            if composed not in map_set:
                raise ValueError(
                    "a custom symmetry group must be closed under "
                    f"composition: {f!r} composed with {g!r} gives "
                    f"{composed!r}, which is not one of the declared maps "
                    f"{maps!r}"
                )


def validate_group(maps):
    """Validate a custom symmetry group before any candidate exists.

    Same checks `canonical_key` runs on its custom-group path, but derives
    `n` from the group's own maps instead of a grid, so a hunt driver can
    reject a broken group up front -- before proposing anything or writing
    any output.
    """
    if not maps:
        raise ValueError("a custom symmetry group must not be empty")
    n = len(maps[0])
    _validate_custom_group(tuple(tuple(m) for m in maps), n)


def canonical_key(grid, group):
    grid = tuple(grid)
    if group == IDENTITY:
        return grid
    if group == D4:
        n = isqrt(len(grid))
        if n * n != len(grid):
            raise ValueError(f"D4 needs a square grid, got {len(grid)} cells")
        maps = _d4_cell_maps(n)
    else:
        maps = tuple(tuple(m) for m in group)
        _validate_custom_group(maps, len(grid))
    return min(tuple(grid[i] for i in cell_map) for cell_map in maps)
