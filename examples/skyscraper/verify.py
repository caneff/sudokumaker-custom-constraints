# Prove a shipped Skyscrapers board is still the board its proof was run on,
# and still unique.
#
#   uv run --with lzstring --with ortools examples/skyscraper/verify.py    # all sizes
#   uv run --with lzstring --with ortools examples/skyscraper/verify.py 6  # just the 6x6
#
# With no size it sweeps every global board committed here, found by its gen
# file rather than by a list -- a new size is covered the day it lands.
#
# Three checks, each cheap:
#
#   1. The committed link decodes to the board recorded in gen_<n>x<n>.json --
#      the same interior givens and the same shown clues, cell for cell. A link
#      rebuilt from a different board would pass a uniqueness proof of its own
#      while the README's recorded numbers describe something else.
#   2. The solution gen_<n>x<n>.json records really is a solution of that board,
#      on the boxes the link itself draws: a Latin square agreeing with the
#      givens and giving back every clue. Uniqueness alone would not catch a
#      corrupted grid -- the solver would simply find the one solution the
#      clues do describe.
#   3. The board has exactly one solution, under the same CP-SAT model
#      build_size.py carved it with (framebuild.unique, SPEC's cp_sat_clue_fn).
#
# So this is a staleness check, not a second opinion on the rule: it shares the
# generator's model on purpose, and what it catches is a board that outlived
# its proof. Fast enough for `just check` -- every size is one solve, well
# under a second -- unlike isofill's verify.py, which searches for minutes.
#
# One limit worth naming: framebuild.unique answers True when its
# second-solution search finds nothing, and a search that timed out found
# nothing too. Every board here solves in well under its 10 s limit, so the
# two are not confusable today; a board slow enough to reach that limit would
# need unique() to separate them.
#
# What it deliberately leaves to the neighbours, one home per rule: that a link
# opens clean (no non-given cell carrying a value) is check_layout.py's, run in
# the same gate; that a link ships its lane's own components and input is
# framebuild.check's, run by build_size.py and rebuild_size.py.
#
# Global boards only. A local (--paths) board carries its clues on drawn bent
# groups rather than on ring keys, so its clue set is not read the way this
# reads one; rebuild_size.py --paths is what keeps those links honest.

import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_size import SPEC
from frame import ring_cell
from framebuild import load_gen, unique
from link_codec import decode_puzzle


def interior_index(W, r, c):
    """Where interior cell (row, column) sits in a link's flat cell list: the
    board is the n x n grid plus a one-cell clue ring, so (0, 0) is at (1, 1)."""
    return (r + 1) * W + c + 1


def link_board(doc):
    """The board a decoded link actually carries: interior givens keyed by
    (row, column) inside the grid, and shown ring clues keyed by (side, index),
    both in the shape gen_<n>x<n>.json records. Hidden clue cells are the
    interactive ones and are absent, as they are from the recorded board."""
    W = doc["width"]
    n = W - 2
    cells = doc["cells"]
    givens = {}
    for r in range(n):
        for c in range(n):
            cell = cells[interior_index(W, r, c)]
            if cell.get("given"):
                givens[(r, c)] = cell["value"]
    shown = {}
    for side in "LRTB":
        for i in range(n):
            r, c = ring_cell(f"{side}{i}", W)
            cell = cells[r * W + c]
            if cell.get("given"):
                shown[(side, i)] = cell["value"]
    return givens, shown


def mismatches(doc, givens, shown):
    """Every way the link's board differs from the recorded one, as lines a
    reader can act on. Empty means the two agree."""
    link_givens, link_shown = link_board(doc)
    return [
        f"interior given {key}: link {link_givens.get(key)}, gen {givens.get(key)}"
        for key in sorted(set(link_givens) | set(givens))
        if link_givens.get(key) != givens.get(key)
    ] + [
        f"shown clue {key[0]}{key[1]}: link {link_shown.get(key)}, gen {shown.get(key)}"
        for key in sorted(set(link_shown) | set(shown))
        if link_shown.get(key) != shown.get(key)
    ]


def grid_problems(grid, clue, givens, lines, n, bh, bw):
    """Every way the recorded solution fails to be a solution of the recorded
    board: a repeat in some house, a given it contradicts, or a line whose
    clue it does not produce. Empty means the grid stands up."""
    houses = [[(r, c) for c in range(n)] for r in range(n)]
    houses += [[(r, c) for r in range(n)] for c in range(n)]
    houses += [
        [(br + r, bc + c) for r in range(bh) for c in range(bw)]
        for br in range(0, n, bh)
        for bc in range(0, n, bw)
    ]
    read = {
        key: SPEC.clue_fn([grid[r][c] for (r, c) in cells], cells)
        for key, cells in lines.items()
    }
    return (
        [
            f"house at {house[0]} is not 1-{n}: {sorted(grid[r][c] for r, c in house)}"
            for house in houses
            if sorted(grid[r][c] for r, c in house) != list(range(1, n + 1))
        ]
        + [
            f"given {key}: gen says {v}, the recorded grid has {grid[key[0]][key[1]]}"
            for key, v in sorted(givens.items())
            if grid[key[0]][key[1]] != v
        ]
        + [
            f"clue {key[0]}{key[1]}: gen says {clue[key]}, "
            f"the recorded grid reads {read[key]}"
            for key in sorted(lines)
            if read[key] != clue[key]
        ]
    )


def box_problems(doc, n, bh, bw):
    """Whether the link draws the same boxes gen records. The proof runs on
    gen's box shape, so a link whose houses differ is a different puzzle
    however well its givens and clues line up. Compared as a partition: the
    app is free to number the boxes as it likes."""
    W = doc["width"]
    regions = next(c for c in doc["constraints"] if c.get("type") == 1)["regions"]
    drawn = {}
    for r in range(n):
        for c in range(n):
            drawn.setdefault(regions[interior_index(W, r, c)], set()).add((r, c))
    recorded = {
        frozenset((br + r, bc + c) for r in range(bh) for c in range(bw))
        for br in range(0, n, bh)
        for bc in range(0, n, bw)
    }
    if {frozenset(cells) for cells in drawn.values()} != recorded:
        return [f"the link's boxes are not the {bh}x{bw} boxes gen records"]
    return []


def boards():
    """Every global board committed here, as (size, gen tag, link file), found
    by its gen file so a new size needs no edit. The 9x9 is the plain-named
    pair; a `_local` board is a drawn-path board, which this does not read."""
    found = [(9, "", HERE / "PUZZLE_LINK.txt")] if (HERE / "gen.json").exists() else []
    for path in HERE.glob("gen_*x*.json"):
        tag = path.stem.removeprefix("gen_")
        if tag.endswith("_local"):
            continue
        found.append((int(tag.split("x")[0]), tag, HERE / f"PUZZLE_LINK_{tag}.txt"))
    return sorted(found)


def check(n, tag, link_file):
    bh, bw, grid, clue, givens, active, lines = load_gen(HERE, n, tag=tag)
    doc = decode_puzzle(link_file.read_text().strip())["puzzle"]
    assert doc["width"] == n + 2, (
        f"{link_file.name} is {doc['width'] - 2}x{doc['width'] - 2}, "
        f"not the {n}x{n} board gen records"
    )

    bad = mismatches(doc, givens, {k: clue[k] for k in active})
    assert not bad, f"{link_file.name} is not the recorded board:\n  " + "\n  ".join(
        bad
    )
    bad = box_problems(doc, n, bh, bw) + grid_problems(
        grid, clue, givens, lines, n, bh, bw
    )
    assert not bad, (
        f"{link_file.name}: the recorded solution does not solve the recorded "
        "board:\n  " + "\n  ".join(bad)
    )

    verdict = unique(SPEC.cp_sat_clue_fn, lines, clue, active, givens, n, bh, bw)
    # unique() answers None when its first solve finds nothing inside the time
    # limit -- a timeout or an unsatisfiable model, not a verdict on a second
    # solution. Reporting that as "two solutions" would send a reader hunting
    # the wrong bug.
    assert verdict is not None, (
        f"{link_file.name}: no solution found inside the CP-SAT limit, a "
        "timeout or a board the model cannot satisfy, so uniqueness was never "
        "put to the test"
    )
    assert verdict is True, f"{link_file.name} has more than one solution"
    print(
        f"{link_file.name} ({n}x{n}): {len(givens)} interior givens, "
        f"{len(active)} shown clues of {len(lines)} -- matches gen, grid solves "
        "it, exactly one solution"
    )


def main(argv):
    wanted = int(argv[1]) if len(argv) > 1 else None
    todo = [b for b in boards() if wanted in (None, b[0])]
    assert todo, f"no committed global board of size {wanted}"
    for n, tag, link_file in todo:
        check(n, tag, link_file)


if __name__ == "__main__":
    main(sys.argv)
