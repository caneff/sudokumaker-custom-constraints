# The search that carves a frame board: generates a fresh grid, derives the
# clue for every line, and carves minimal interior givens and a minimal
# shown-clue set to a unique solution (OR-Tools CP-SAT). `generate` is the
# entry point; it returns the chosen `Board`.

import pathlib
import random
import sys
from dataclasses import replace

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from board import Board, _ring_name, make_lines

# Seconds per solve in `unique`. A sudoku frame board is proved in
# milliseconds, so a solve anywhere near the cap is a carve that has gone
# wrong; `unique` returns None for it, which a carve step reads as "keep this
# given or clue" (no proof, so no removal) and the final assert in `generate`
# turns into a loud failure. An interior whose proofs take seconds (ISOFILL)
# carves under a smaller `Spec.carve_limit`, keeping this cap as its margin.
SOLVE_LIMIT = 10


def make_grid(rng, n, bh, bw):
    """A random solved n x n sudoku grid with bh x bw boxes, as rows of digits."""
    # Start from the standard shift pattern, then shuffle bands, rows, stacks,
    # columns, and digit labels. Every step preserves sudoku validity.
    base = [[((r * bw + r // bh + c) % n) for c in range(n)] for r in range(n)]
    bands = [
        b * bh + r
        for b in rng.sample(range(n // bh), n // bh)
        for r in rng.sample(range(bh), bh)
    ]
    stacks = [
        s * bw + c
        for s in rng.sample(range(n // bw), n // bw)
        for c in rng.sample(range(bw), bw)
    ]
    digits = rng.sample(range(1, n + 1), n)
    return [[digits[base[bands[r]][stacks[c]]] for c in range(n)] for r in range(n)]


# The clue's own interior cell, the step inward from it, and the two steps
# across, per ring side. A ring key names one clue cell: "T3"/"B3" sit
# above/below interior column 3, "L2"/"R2" left/right of interior row 2.
_SIDES = {
    "L": lambda i, n: ((i, 0), (0, 1), [(1, 0), (-1, 0)]),
    "R": lambda i, n: ((i, n - 1), (0, -1), [(1, 0), (-1, 0)]),
    "T": lambda i, n: ((0, i), (1, 0), [(0, 1), (0, -1)]),
    "B": lambda i, n: ((n - 1, i), (-1, 0), [(0, 1), (0, -1)]),
}


def make_paths(rng, n):
    """One bent path per ring key, in the shape make_lines returns.

    A path is an L: `a` cells straight in from the clue, then a turn and
    `n - a` cells across, `n` cells in all. With `a` between 2 and n - 1 both
    legs are non-empty, so the path spans more than one row and more than one
    column. Its cells therefore do not all see each other, the app reads the
    line as bare, and digits may repeat along it -- which is the whole point:
    a frame line is a full house and hides every bare-line bug.
    """
    paths = {}
    for side in "LRTB":
        for i in range(n):
            start, inward, across = _SIDES[side](i, n)
            legs = [
                (a, d)
                for a in range(2, n)
                for d in across
                if _in_grid(_step(start, inward, a - 1), d, n - a, n)
            ]
            a, d = rng.choice(legs)
            corner = _step(start, inward, a - 1)
            paths[(side, i)] = [_step(start, inward, k) for k in range(a)] + [
                _step(corner, d, k) for k in range(1, n - a + 1)
            ]
    return paths


def _step(cell, d, k):
    return (cell[0] + d[0] * k, cell[1] + d[1] * k)


def _in_grid(corner, d, k, n):
    """True when `k` further steps of `d` from `corner` all stay on the grid."""
    r, c = _step(corner, d, k)
    return 0 <= r < n and 0 <= c < n


def repeating_lines(grid, lines):
    """The keys whose line holds the same digit twice, read off the solution."""
    return [
        key
        for key, cells in lines.items()
        if len({grid[r][c] for r, c in cells}) < len(cells)
    ]


def unique(post_clue, board, model_fn=None, limit=SOLVE_LIMIT):
    """True when `board`'s interior has exactly one solution, False when it has
    more, None when there is no verdict -- either the first solve found nothing
    inside the time limit (a timeout or an unsatisfiable model) or the search
    for a second solution spent the limit without one.

    `post_clue` is a Spec's cp_sat_clue_fn and `model_fn` its model_fn (None:
    the sudoku model); unique() needs nothing else off the Spec, so a caller
    with its own line geometry can reuse it. `limit` is the seconds each of
    the two solves may spend.
    """
    # Imported here, not at module scope: `cpsat` imports ortools, which only
    # the search needs, so document assembly (build_doc, check, load_board)
    # does not pay for the import.
    from sudoku_kit import cpsat

    geo = board.geo
    if model_fn:
        m, x = model_fn(geo.n, geo.box, **geo.shape)
    else:
        if geo.shape:
            raise ValueError("a rectangular board needs the Spec's own model_fn")
        m, x = cpsat.sudoku_model(geo.n, cpsat.boxes(geo.n, *geo.box))
    for (r, c), v in board.givens.items():
        m.Add(x[r, c] == v)
    # sorted: `active` is a set, whose iteration order is randomized per
    # process (string hash randomization) — sorting keeps constraint order,
    # and so the CP-SAT search path, the same on every run.
    for k in sorted(board.active):
        cells = board.lines[k]
        post_clue(m, x, cells, board.clue[k], board.digits, _ring_name(k), board.box)
    try:
        first, unique = cpsat.solve_unique(m, x, limit)
    except TimeoutError:
        # No verdict either way: a first solve that spent the limit, or a
        # second one that did, reads as a first solve that found nothing.
        return None
    return unique if first is not None else None


def generate(spec, geo, seeds, paths=False):
    """Search `seeds` for the leanest board and return the chosen `Board`.

    `paths` builds the local board: bent paths in place of the straight frame
    lines, and a seed whose lines carry no repeated digit is skipped, because
    a bent-path board that happens to repeat nothing proves nothing about bare
    lines. The geometry is drawn from its own random stream, so a seed's grid
    and carve draws are the same whether or not paths are drawn.

    A `spec.ring_only` search draws each seed's layout once, tries
    `ring_only_search` on them first and falls back to the interior-given
    carve over the same layouts only when it finds nothing.

    `geo` is the board's `Geometry`. A rectangle needs an interior hook that takes both
    (`Spec.grid_fn` and `Spec.model_fn`), and draws straight lines only.
    """
    if geo.shape and (paths or not (spec.grid_fn and spec.model_fn)):
        raise ValueError(
            "a rectangular board needs the Spec's own grid_fn and model_fn and "
            "the straight frame lines"
        )
    if spec.ring_only and paths:
        raise ValueError("a ring-only search reads the straight frame lines only")
    layouts = _layouts(spec, geo, seeds) if spec.ring_only else None
    board = ring_only_search(spec, geo, layouts) if spec.ring_only else None
    if board is None:
        board = hide_clues(spec, _fewest_givens(spec, geo, seeds, paths, layouts))
    assert unique(spec.cp_sat_clue_fn, board, spec.model_fn) is True, (
        f"seed {board.seed}: the carved board is not proved unique under the "
        f"{SOLVE_LIMIT} s limit"
    )
    if paths:
        # The property the board exists to carry. Asserted here so a
        # regeneration that loses it fails loud instead of shipping a board
        # whose every line is a house in disguise.
        repeats = repeating_lines(board.grid, board.lines)
        assert repeats, "no line carries a repeated digit"
        print(f"  lines with a repeated digit: {len(repeats)} of {len(board.lines)}")
    print(
        f"CHOSEN seed {board.seed}: interior givens={len(board.givens)}, "
        f"clues shown={len(board.active)}, "
        f"clues interactive (hidden)={len(board.lines) - len(board.active)}"
    )
    return board


def _carve_proof(spec, board, limit=None):
    """`unique` for one carve step: the Spec's clue rule and model, under its
    carve limit (`limit` overrides it)."""
    if limit is None:
        limit = SOLVE_LIMIT if spec.carve_limit is None else spec.carve_limit
    return unique(spec.cp_sat_clue_fn, board, spec.model_fn, limit)


def _full_ring(spec, grid, lines, geo, seed):
    """`grid` as a board with no givens and every line's clue shown."""
    # A rectangle names no box; the gen JSON still records one, so one row of
    # boxes stands in.
    bh, bw = geo.box or (1, geo.n)
    return Board(
        n=geo.n,
        bh=bh,
        bw=bw,
        grid=grid,
        clue={
            k: spec.clue_fn([grid[r][c] for (r, c) in cells], cells, geo.box)
            for k, cells in lines.items()
        },
        givens={},
        active=set(lines),
        lines=lines,
        height=geo.height,
        digits=geo.digits,
        seed=seed,
    )


def _layouts(spec, geo, seeds):
    """{seed: grid} for each seed's layout, a layout an earlier seed drew
    left out. Drawn once, because a sampler need not redraw a seed's grid
    the same way twice: the search and its fallback carve these grids."""
    out = {}
    seen = set()
    for seed in seeds:
        grid = _draw_grid(spec, random.Random(seed), geo)
        layout = tuple(map(tuple, grid))
        if layout in seen:
            print(f"  seed {seed}: skipped, an earlier seed drew this layout")
            continue
        seen.add(layout)
        out[seed] = grid
    return out


def ring_only_search(spec, geo, layouts):
    """The board with no interior givens and the fewest shown clues across
    `layouts` ({seed: grid}), or None when no layout proves unique on its
    full ring. A layout whose carve-limit proof reaches no verdict is proved
    again at SOLVE_LIMIT before it is given up on, and the search reports how
    many never reached one, since "no verdict" is not "not unique". Prints
    how many layouts it tried and what it found."""
    lines = make_lines(geo.n, geo.height)
    found, open_ = [], []

    def carve(seed, base):
        carved = hide_clues(spec, base)
        print(f"  seed {seed}: unique on the ring alone, {len(carved.active)} shown")
        found.append(carved)

    for seed, grid in layouts.items():
        base = _full_ring(spec, grid, lines, geo, seed)
        verdict = _carve_proof(spec, base)
        if verdict is None:
            print(f"  seed {seed}: no verdict on the ring alone inside the carve limit")
            open_.append(base)
        elif verdict:
            carve(seed, base)
        else:
            print(f"  seed {seed}: not unique on the ring alone")
    unproved = 0
    if not found:
        for base in open_:
            verdict = _carve_proof(spec, base, SOLVE_LIMIT)
            if verdict:
                carve(base.seed, base)
            else:
                unproved += verdict is None
                print(
                    f"  seed {base.seed}: "
                    + ("not unique" if verdict is False else "still no verdict")
                    + f" on the ring alone at {SOLVE_LIMIT} s"
                )
    # min keeps the first of a tie, so the earliest seed wins it
    best = min(found, key=lambda b: len(b.active), default=None)
    print(
        f"ring-only search: {len(layouts)} layouts tried, "
        + (
            f"{len(found)} unique on the ring alone; best seed {best.seed}, "
            f"{len(best.active)} clues shown"
            if best
            else "none proved unique on the ring alone"
            + (f" ({unproved} with no verdict at {SOLVE_LIMIT} s)" if unproved else "")
            + "; falling back to interior givens"
        )
    )
    return best


def _draw_grid(spec, rng, geo):
    """One solved interior for `geo`, from the Spec's sampler or `make_grid`."""
    # a rectangle names no box, so its sampler is handed none
    bh, bw = geo.box or (None, None)
    return (spec.grid_fn or make_grid)(rng, geo.n, bh, bw, **geo.shape)


def _fewest_givens(spec, geo, seeds, paths, layouts=None):
    """The first board, over `seeds` (or the drawn `layouts`, {seed: grid}),
    carved to the fewest interior givens with every clue shown."""
    n, rows = geo.n, geo.height
    best = None
    for seed in layouts or seeds:
        lines = (
            make_paths(random.Random(seed * 13), n) if paths else make_lines(n, rows)
        )
        rng = random.Random(seed)
        grid = layouts[seed] if layouts else _draw_grid(spec, rng, geo)
        if paths and not repeating_lines(grid, lines):
            print(f"  seed {seed}: skipped, no line repeats a digit")
            continue
        # every line clued while carving givens
        base = _full_ring(spec, grid, lines, geo, seed)
        givens = {}
        cells_all = [(r, c) for r in range(rows) for c in range(n)]
        rng.shuffle(cells_all)
        if not _carve_proof(spec, base):
            for cell in cells_all:
                givens[cell] = grid[cell[0]][cell[1]]
                if _carve_proof(spec, replace(base, givens=dict(givens))):
                    break
        for cell in list(givens.keys()):
            v = givens.pop(cell)
            if not _carve_proof(spec, replace(base, givens=dict(givens))):
                givens[cell] = v
        print(f"  seed {seed}: interior givens = {len(givens)}")
        if best is None or len(givens) < len(best.givens):
            best = replace(base, givens=dict(givens))
    assert best is not None, "no seed produced a board to carve"
    return best


def hide_clues(spec, board):
    """`board` with each shown clue hidden, in an order drawn from its seed,
    whenever the board stays unique without it."""
    active = set(board.active)
    rng = random.Random(board.seed * 7)
    order = sorted(active)  # sorted: see the note on set order in unique()
    rng.shuffle(order)
    for k in order:
        active.discard(k)
        if not _carve_proof(spec, replace(board, active=set(active))):
            active.add(k)
    return replace(board, active=active)
