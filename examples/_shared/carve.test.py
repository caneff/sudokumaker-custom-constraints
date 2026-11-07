# The carve search (carve.py): make_grid, make_paths, unique and generate,
# the Spec's own interior hooks and carve limit, and the ring-only search.
# Every uniqueness proof is a real CP-SAT double solve on an n=4 board, which
# keeps `just check` in the tens of milliseconds.
#
#   uv run examples/_shared/carve.test.py

import contextlib
import dataclasses
import io
import itertools
import random
from unittest import mock

import carve
from board import Board, Geometry, make_lines
from carve import SOLVE_LIMIT, generate, make_grid, make_paths, repeating_lines, unique
from frame_fixtures import (
    TOY,
    first_digit,
    post_first_digit,
    striped_grid,
    temp_spec,
    valid_sudoku,
)


def test_make_grid_is_a_real_sudoku_reproducible_from_its_seed():
    for seed in (1, 7, 101):
        g = make_grid(random.Random(seed), 6, 2, 3)
        assert valid_sudoku(g, 6, 2, 3), f"seed {seed} is not a valid sudoku"
    assert make_grid(random.Random(5), 4, 2, 2) == make_grid(random.Random(5), 4, 2, 2)
    assert make_grid(random.Random(5), 4, 2, 2) != make_grid(random.Random(6), 4, 2, 2)


def test_make_paths_draws_one_bent_l_per_ring_key():
    n = 6
    paths = make_paths(random.Random(3), n)
    assert set(paths) == set(make_lines(n)), "a path per ring key, same keys"
    for key, cells in paths.items():
        assert len(cells) == n, f"{key} has {len(cells)} cells, want {n}"
        assert len(set(cells)) == n, f"{key} visits a cell twice"
        assert all(0 <= r < n and 0 <= c < n for r, c in cells), (
            f"{key} leaves the grid"
        )
        # a straight run inward, then exactly one turn: two distinct steps in
        # all, and the second never reverses the first
        steps = {(b[0] - a[0], b[1] - a[1]) for a, b in itertools.pairwise(cells)}
        assert len(steps) == 2, f"{key} is straight or turns twice: {steps}"
        (d1, d2) = steps
        assert d1 != (-d2[0], -d2[1]), f"{key} doubles back"
        assert len({r for r, _ in cells}) > 1 and len({c for _, c in cells}) > 1, (
            f"{key} is a straight line, not a bent path"
        )
    # the clue's own cell starts the path, so a clue reads its line inward
    for (side, i), cells in paths.items():
        assert (
            cells[0]
            == {
                "L": (i, 0),
                "R": (i, n - 1),
                "T": (0, i),
                "B": (n - 1, i),
            }[side]
        ), (side, i)


def test_unique_is_the_cp_sat_double_solve():
    n, bh, bw = 4, 2, 2
    lines = make_lines(n)
    grid = make_grid(random.Random(11), n, bh, bw)
    bare = Board(
        n=n,
        bh=bh,
        bw=bw,
        grid=grid,
        clue=dict.fromkeys(lines, 0),
        givens={},
        active=set(),
        lines=lines,
        height=n,
        digits=n,
    )
    # a bare 4x4 with no givens and no clues has many solutions
    assert unique(post_first_digit, bare) is False
    # every cell given: exactly one solution
    full = {(r, c): grid[r][c] for r in range(n) for c in range(n)}
    assert unique(post_first_digit, dataclasses.replace(bare, givens=full)) is True
    # an infeasible model (a given contradicting its own row) is neither: None,
    # so the carve loop cannot read "no solution" as "unique"
    broken = dict(full)
    broken[(0, 1)] = broken[(0, 0)]
    assert unique(post_first_digit, dataclasses.replace(bare, givens=broken)) is None
    # the clues alone do work: the whole ring pinned makes the border cells
    # given, and dropping every clue on the same givens loses uniqueness
    clue = {k: grid[cells[0][0]][cells[0][1]] for k, cells in lines.items()}
    clued = dataclasses.replace(bare, clue=clue)
    assert unique(
        post_first_digit, dataclasses.replace(clued, active=set(lines))
    ) != unique(post_first_digit, clued), "the active clue set must change the answer"


def test_generate_carves_a_unique_and_minimal_board():
    n, bh, bw = 4, 2, 2
    with temp_spec(
        ["FooComponent.js"], clue_fn=first_digit, cp_sat_clue_fn=post_first_digit
    ) as spec:
        board = generate(spec, Geometry.square(n, bh, bw), range(101, 104))
        assert board.seed in range(101, 104)
        assert (board.n, board.bh, board.bw) == (n, bh, bw)
        assert valid_sudoku(board.grid, n, bh, bw)
        # every clue is read off the solution, never invented
        for k, cells in board.lines.items():
            assert board.clue[k] == first_digit(
                [board.grid[r][c] for r, c in cells], cells, (bh, bw)
            ), k
        # the carved board is unique...
        assert unique(post_first_digit, board) is True
        # ...and minimal in both directions: put any dropped clue's line back
        # out, or any given back out, and it stops being unique
        for k in sorted(board.active):
            fewer = dataclasses.replace(board, active=board.active - {k})
            assert not unique(post_first_digit, fewer), (
                f"clue {k} is not load-bearing -- generate left a redundant clue"
            )
        for cell in sorted(board.givens):
            fewer = dataclasses.replace(
                board, givens={c: v for c, v in board.givens.items() if c != cell}
            )
            assert not unique(post_first_digit, fewer), (
                f"given {cell} is not load-bearing -- generate left a redundant given"
            )

        # paths=True draws bent paths instead of frame lines, and keeps only a
        # seed whose lines repeat a digit -- the property that makes the board
        # a bare-line fixture rather than a frame board in disguise
        bent = generate(spec, Geometry.square(n, bh, bw), range(101, 106), paths=True)
        assert repeating_lines(bent.grid, bent.lines), (
            "a paths board must repeat a digit"
        )
        assert unique(post_first_digit, bent) is True

    # a rule whose clues constrain nothing forces the other half of generate:
    # the interior-given carve, which the clue-only board above never reaches
    with temp_spec(["FooComponent.js"]) as spec:  # clue_fn 0, cp_sat posts nothing
        board = generate(spec, Geometry.square(n, bh, bw), range(101, 103))
        assert board.givens, "a board its clues cannot pin needs interior givens"
        assert unique(spec.cp_sat_clue_fn, board)
        for cell in sorted(board.givens):
            fewer = dataclasses.replace(
                board, givens={c: v for c, v in board.givens.items() if c != cell}
            )
            assert not unique(spec.cp_sat_clue_fn, fewer), (
                f"given {cell} is not load-bearing -- generate left a redundant given"
            )


def test_generate_and_unique_use_the_spec_s_own_grid_and_model():
    n, bh, bw = 4, 2, 2
    with temp_spec(["FooComponent.js"], **TOY) as spec:
        board = generate(spec, Geometry.square(n, bh, bw), range(101, 103))
        assert board.grid == striped_grid(None, n, bh, bw)
        # the model pins every cell, so no interior given is needed
        assert not board.givens
        assert unique(spec.cp_sat_clue_fn, board, spec.model_fn) is True
        # the sudoku model, with nothing pinned, has many solutions
        assert unique(spec.cp_sat_clue_fn, board) is False


def test_a_carve_keeps_only_the_steps_proved_inside_the_spec_s_carve_limit():
    # A carve limit no solve can meet: every carve-time proof comes back with
    # no verdict, so the carve keeps every given it adds and hides no clue --
    # and the board it returns still proves unique under the full limit.
    n, bh, bw = 4, 2, 2
    with temp_spec(["FooComponent.js"], carve_limit=1e-9, **TOY) as spec:
        board = generate(spec, Geometry.square(n, bh, bw), range(101, 102))
        assert len(board.givens) == n * n
        assert board.active == set(make_lines(n))
        assert unique(spec.cp_sat_clue_fn, board, spec.model_fn) is True
    with temp_spec(["FooComponent.js"], **TOY) as spec:
        assert spec.carve_limit is None
        board = generate(spec, Geometry.square(n, bh, bw), range(101, 102))
        assert not board.givens


def test_a_ring_only_search_keeps_the_layout_with_the_fewest_shown_clues():
    # Seeds 101 and 102 are both unique on their full ring of first-digit
    # clues; carved alone, 101 keeps 5 clues shown and 102 keeps 4. The
    # default search stops at the first board with no givens, so it ships
    # 101; the ring-only search carves both rings and ships 102.
    n, bh, bw = 4, 2, 2
    rule = {"clue_fn": first_digit, "cp_sat_clue_fn": post_first_digit}
    with temp_spec(["FooComponent.js"], **rule) as spec:
        assert spec.ring_only is False
        assert generate(spec, Geometry.square(n, bh, bw), range(101, 103)).seed == 101
    with temp_spec(["FooComponent.js"], ring_only=True, **rule) as spec:
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            board = generate(spec, Geometry.square(n, bh, bw), range(101, 103))
        assert (board.seed, board.givens, len(board.active)) == (102, {}, 4)
        assert unique(post_first_digit, board) is True
        assert "2 layouts tried, 2 unique on the ring alone" in out.getvalue()


def test_a_ring_only_search_skips_a_layout_it_has_already_tried():
    # The toy interior draws the same striped grid for every seed: one layout,
    # however many seeds.
    n, bh, bw = 4, 2, 2
    with temp_spec(["FooComponent.js"], ring_only=True, **TOY) as spec:
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            board = generate(spec, Geometry.square(n, bh, bw), range(101, 104))
        assert board.seed == 101 and not board.givens
        assert "1 layouts tried, 1 unique on the ring alone" in out.getvalue()


def test_a_ring_only_search_falls_back_to_interior_givens():
    # Clues that constrain nothing: no layout is unique on its ring, so the
    # search falls back to the default carve, which adds interior givens.
    n, bh, bw = 4, 2, 2
    with temp_spec(["FooComponent.js"], ring_only=True) as spec:
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            board = generate(spec, Geometry.square(n, bh, bw), range(101, 103))
        assert board.givens
        assert unique(spec.cp_sat_clue_fn, board) is True
        assert "2 layouts tried, none proved unique on the ring alone" in out.getvalue()


def _no_verdict_unless(keep):
    """`carve.unique` with every proof `keep(board, limit)` refuses
    answered None, the verdict a solve that spent its limit returns."""
    real = carve.unique

    def proof(post_clue, board, model_fn=None, limit=SOLVE_LIMIT):
        return real(post_clue, board, model_fn, limit) if keep(board, limit) else None

    return mock.patch.object(carve, "unique", proof)


def test_a_ring_only_search_proves_a_no_verdict_layout_again_at_the_full_limit():
    # Every carve-limit proof times out. The layout is not read as "not
    # unique": it is proved again at SOLVE_LIMIT and ships ring-only, every
    # clue kept, since no hiding step could be proved.
    n, bh, bw = 4, 2, 2
    with temp_spec(["FooComponent.js"], ring_only=True, carve_limit=1, **TOY) as spec:
        out = io.StringIO()
        with (
            _no_verdict_unless(lambda b, limit: limit == SOLVE_LIMIT),
            contextlib.redirect_stdout(out),
        ):
            board = generate(spec, Geometry.square(n, bh, bw), range(101, 102))
        assert not board.givens and board.active == set(make_lines(n))
        log = out.getvalue()
        assert "seed 101: no verdict on the ring alone inside the carve limit" in log
        assert "1 layouts tried, 1 unique on the ring alone" in log


def test_a_ring_only_fallback_reports_the_layouts_that_never_reached_a_verdict():
    # No ring-only proof reaches a verdict at any limit: the search falls back
    # to interior givens and says the layout was unproved, not "not unique".
    n, bh, bw = 4, 2, 2
    with temp_spec(["FooComponent.js"], ring_only=True, **TOY) as spec:
        out = io.StringIO()
        with (
            _no_verdict_unless(lambda b, limit: bool(b.givens)),
            contextlib.redirect_stdout(out),
        ):
            board = generate(spec, Geometry.square(n, bh, bw), range(101, 102))
        assert board.givens
        log = out.getvalue()
        assert "seed 101: still no verdict on the ring alone" in log
        assert (
            "none proved unique on the ring alone (1 with no verdict at "
            f"{SOLVE_LIMIT} s); falling back to interior givens"
        ) in log
        assert "not unique on the ring alone" not in log


def test_a_ring_only_fallback_carves_the_layouts_the_search_drew():
    # The fallback carves the grids the search tried, not a fresh draw: a
    # sampler need not redraw a seed's grid the same way twice.
    n, bh, bw = 4, 2, 2
    draws = itertools.count()

    def drifting_grid(rng, n, bh, bw):
        grid = make_grid(rng, n, bh, bw)
        if next(draws):
            grid = grid[::-1]  # a second draw of the same seed lands elsewhere
        return grid

    with temp_spec(["FooComponent.js"], ring_only=True, grid_fn=drifting_grid) as spec:
        with contextlib.redirect_stdout(io.StringIO()):
            board = generate(spec, Geometry.square(n, bh, bw), range(101, 102))
        assert board.grid == make_grid(random.Random(101), n, bh, bw)
        assert next(draws) == 1, "the fallback drew the layout again"


def test_generate_refuses_a_board_its_final_proof_does_not_confirm():
    # The carve proves at its own limit; the board ships only when the full
    # limit proves it too.
    n, bh, bw = 4, 2, 2
    with (
        temp_spec(["FooComponent.js"], carve_limit=1, **TOY) as spec,
        _no_verdict_unless(lambda b, limit: limit != SOLVE_LIMIT),
        contextlib.redirect_stdout(io.StringIO()),
    ):
        try:
            generate(spec, Geometry.square(n, bh, bw), range(101, 102))
        except AssertionError as e:
            assert "not proved unique" in str(e)
        else:
            raise AssertionError("shipped a board the full limit never proved")


def test_a_ring_only_search_refuses_bent_paths():
    with temp_spec(["FooComponent.js"], ring_only=True, **TOY) as spec:
        try:
            generate(spec, Geometry.square(4, 2, 2), range(101, 102), paths=True)
        except ValueError as e:
            assert "straight frame lines" in str(e)
        else:
            raise AssertionError("a ring-only search drew bent paths")


if __name__ == "__main__":
    test_a_ring_only_search_proves_a_no_verdict_layout_again_at_the_full_limit()
    test_a_ring_only_fallback_reports_the_layouts_that_never_reached_a_verdict()
    test_a_ring_only_fallback_carves_the_layouts_the_search_drew()
    test_generate_refuses_a_board_its_final_proof_does_not_confirm()
    test_a_ring_only_search_refuses_bent_paths()
    test_a_ring_only_search_keeps_the_layout_with_the_fewest_shown_clues()
    test_a_ring_only_search_skips_a_layout_it_has_already_tried()
    test_a_ring_only_search_falls_back_to_interior_givens()
    test_a_carve_keeps_only_the_steps_proved_inside_the_spec_s_carve_limit()
    test_generate_and_unique_use_the_spec_s_own_grid_and_model()
    test_make_grid_is_a_real_sudoku_reproducible_from_its_seed()
    test_make_paths_draws_one_bent_l_per_ring_key()
    test_unique_is_the_cp_sat_double_solve()
    test_generate_carves_a_unique_and_minimal_board()
    print("carve self-check OK")
