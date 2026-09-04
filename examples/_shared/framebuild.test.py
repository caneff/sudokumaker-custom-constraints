# framebuild's generator half (make_grid, make_paths, unique, generate, run)
# and its check: a built link must match its own doc, open the rules text
# right, and ship exactly the components its backend registers in both
# directions. These fixtures build a minimal doc via build_doc itself (a real
# n=4 board, one dummy component) rather than reconstructing framebuild's
# document shape by hand, so a case tracks the real builder instead of
# drifting from it. n=4 throughout: every uniqueness proof is a real CP-SAT
# double solve, and a 4x4 keeps `just check` in the tens of milliseconds.
#
#   uv run --with lzstring --with ortools examples/_shared/framebuild.test.py

import contextlib
import itertools
import pathlib
import random
import sys
import tempfile

import link_codec
from framebuild import (
    Spec,
    build_doc,
    check,
    generate,
    load_gen,
    make_grid,
    make_lines,
    make_paths,
    repeating_lines,
    run,
    unique,
)


@contextlib.contextmanager
def _spec(
    components,
    main_global="puzzle.addConstraintComponent(new FooComponent())",
    clue_fn=None,
    cp_sat_clue_fn=None,
):
    """A minimal Spec backed by a temp example dir: `main.js` /
    `main-global.js` plus one `FooComponent.js` and one `BarComponent.js`
    file (content unused by `check`; only the backend files' text matters).
    `components` names the global lane's own declared list.
    """
    with tempfile.TemporaryDirectory() as tmp:
        d = pathlib.Path(tmp)
        (d / "main.js").write_text("puzzle.addConstraintComponent(new FooComponent())")
        (d / "main-global.js").write_text(main_global)
        (d / "FooComponent.js").write_text("class FooComponent {}")
        (d / "BarComponent.js").write_text("class BarComponent {}")
        yield Spec(
            dir=d,
            title="Widget",
            lines_name="Widget Lines",
            components=components,
            min_digit=1,
            clue_fn=clue_fn or (lambda values, cells: 0),
            cp_sat_clue_fn=cp_sat_clue_fn or (lambda *a, **k: None),
            comment_fn=lambda n: "test rules",
        )


# A real, solver-backed clue rule for the generator cases: the clue is the
# digit in the cell nearest the clue, read inward. Trivial as a puzzle, but a
# genuine constraint on the model -- which is all generate()/unique() need, and
# it reads the same on a straight frame line and on a bent path.
def _first_digit(values, cells):
    return values[0]


def _post_first_digit(m, x, cells, kk, n, tag):
    m.Add(x[cells[0]] == kk)


def _valid_sudoku(grid, n, bh, bw):
    """True when every row, column and box of `grid` holds 1..n once."""
    want = set(range(1, n + 1))
    if any(set(row) != want for row in grid):
        return False
    if any({grid[r][c] for r in range(n)} != want for c in range(n)):
        return False
    return all(
        {grid[br + dr][bc + dc] for dr in range(bh) for dc in range(bw)} == want
        for br in range(0, n, bh)
        for bc in range(0, n, bw)
    )


def _build(spec, n=4, bh=2, bw=2):
    """A real n x n board built through `build_doc`, no drawn groups (global
    lane), no givens, and every ring clue shown -- unit fixtures only, this
    board is never shared, so the "leave most of the ring blank" rule for a
    shared board does not apply here.
    """
    grid = [[((r * bw + r // bh + c) % n) + 1 for c in range(n)] for r in range(n)]
    lines = make_lines(n)
    clue = dict.fromkeys(lines, 0)
    doc = build_doc(spec, n, bh, bw, grid, clue, {}, set(lines), lines, local=False)
    link = link_codec.encode_link(doc)
    return link, doc


if __name__ == "__main__":
    # backend registers exactly the declared component: check passes
    with _spec(["FooComponent.js"]) as spec:
        link, doc = _build(spec)
        check(spec, link, doc, 4, local=False)

    # the declared list carries a dead name the backend never registers with
    # `new`: the existing two checks both pass (names == want; registered is
    # a subset of shipped), so only the new shipped-minus-registered
    # assertion catches it (#292)
    with _spec(["FooComponent.js", "BarComponent.js"]) as spec:
        link, doc = _build(spec)
        try:
            check(spec, link, doc, 4, local=False)
        except AssertionError as e:
            assert "BarComponent" in str(e), e
        else:
            raise AssertionError("a shipped, never-registered component was not caught")

    # ---- make_grid: a real sudoku solution, and reproducible from its seed
    for seed in (1, 7, 101):
        g = make_grid(random.Random(seed), 6, 2, 3)
        assert _valid_sudoku(g, 6, 2, 3), f"seed {seed} is not a valid sudoku"
    assert make_grid(random.Random(5), 4, 2, 2) == make_grid(random.Random(5), 4, 2, 2)
    assert make_grid(random.Random(5), 4, 2, 2) != make_grid(random.Random(6), 4, 2, 2)

    # ---- make_paths: one bent L per ring key, on the grid, n cells long
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

    # ---- unique: the CP-SAT double solve
    n, bh, bw = 4, 2, 2
    lines = make_lines(n)
    grid = make_grid(random.Random(11), n, bh, bw)
    no_clue = dict.fromkeys(lines, 0)
    # a bare 4x4 with no givens and no clues has many solutions
    assert unique(_post_first_digit, lines, no_clue, set(), {}, n, bh, bw) is False
    # every cell given: exactly one solution
    full = {(r, c): grid[r][c] for r in range(n) for c in range(n)}
    assert unique(_post_first_digit, lines, no_clue, set(), full, n, bh, bw) is True
    # an infeasible model (a given contradicting its own row) is neither: None,
    # so the carve loop cannot read "no solution" as "unique"
    broken = dict(full)
    broken[(0, 1)] = broken[(0, 0)]
    assert unique(_post_first_digit, lines, no_clue, set(), broken, n, bh, bw) is None
    # the clues alone do work: the whole ring pinned makes the border cells
    # given, and dropping every clue on the same givens loses uniqueness
    clue = {k: grid[cells[0][0]][cells[0][1]] for k, cells in lines.items()}
    assert unique(_post_first_digit, lines, clue, set(lines), {}, n, bh, bw) != unique(
        _post_first_digit, lines, clue, set(), {}, n, bh, bw
    ), "the active clue set must change the answer"

    # ---- generate: the carved board really is unique, and minimal
    with _spec(
        ["FooComponent.js"], clue_fn=_first_digit, cp_sat_clue_fn=_post_first_digit
    ) as spec:
        # hide_key orders the clue carve: keys whose clue sorts first are
        # dropped first, so the shown set skews toward the ones it ranks last
        seed, grid, clue, givens, active, lines = generate(
            spec, n, bh, bw, range(101, 104), hide_key=lambda v: -v
        )
        assert seed in range(101, 104)
        assert _valid_sudoku(grid, n, bh, bw)
        # every clue is read off the solution, never invented
        for k, cells in lines.items():
            assert clue[k] == _first_digit([grid[r][c] for r, c in cells], cells), k
        # the carved board is unique...
        assert unique(_post_first_digit, lines, clue, active, givens, n, bh, bw) is True
        # ...and minimal in both directions: put any dropped clue's line back
        # out, or any given back out, and it stops being unique
        for k in sorted(active):
            fewer = active - {k}
            assert not unique(
                _post_first_digit, lines, clue, fewer, givens, n, bh, bw
            ), f"clue {k} is not load-bearing -- generate left a redundant clue"
        for cell in sorted(givens):
            fewer = {c: v for c, v in givens.items() if c != cell}
            assert not unique(
                _post_first_digit, lines, clue, active, fewer, n, bh, bw
            ), f"given {cell} is not load-bearing -- generate left a redundant given"

        # paths=True draws bent paths instead of frame lines, and keeps only a
        # seed whose lines repeat a digit -- the property that makes the board
        # a bare-line fixture rather than a frame board in disguise
        _s, grid, clue, givens, active, lines = generate(
            spec, n, bh, bw, range(101, 106), paths=True
        )
        assert repeating_lines(grid, lines), "a paths board must repeat a digit"
        assert unique(_post_first_digit, lines, clue, active, givens, n, bh, bw) is True

    # a rule whose clues constrain nothing forces the other half of generate:
    # the interior-given carve, which the clue-only board above never reaches
    with _spec(["FooComponent.js"]) as spec:  # clue_fn 0, cp_sat posts nothing
        _s, grid, clue, givens, active, lines = generate(
            spec, n, bh, bw, range(101, 103)
        )
        assert givens, "a board its clues cannot pin needs interior givens"
        assert unique(spec.cp_sat_clue_fn, lines, clue, active, givens, n, bh, bw)
        for cell in sorted(givens):
            fewer = {c: v for c, v in givens.items() if c != cell}
            assert not unique(
                spec.cp_sat_clue_fn, lines, clue, active, fewer, n, bh, bw
            ), f"given {cell} is not load-bearing -- generate left a redundant given"

    # ---- run: generate + build_doc + check + both output files, end to end
    with _spec(
        ["FooComponent.js"], clue_fn=_first_digit, cp_sat_clue_fn=_post_first_digit
    ) as spec:
        argv = sys.argv
        sys.argv = ["framebuild", str(n), str(bh), str(bw), "2"]
        try:
            run(spec)
        finally:
            sys.argv = argv
        link = (spec.dir / f"PUZZLE_LINK_{n}x{n}.txt").read_text().strip()
        doc = link_codec.decode_puzzle(link)
        # the written link decodes, and passes the same check run() ran
        check(spec, link, doc, n, local=False)
        # a cell holds a value only when it is a given: the shipped board must
        # never carry the solution or a hidden clue as an entered digit
        assert not [
            c for c in doc["puzzle"]["cells"] if "value" in c and not c.get("given")
        ]
        # gen_<n>x<n>.json reads back into the shape build_doc takes, and its
        # board is the one the link ships
        gbh, gbw, ggrid, gclue, ggivens, gactive, glines = load_gen(spec.dir, n)
        assert (gbh, gbw) == (bh, bw)
        assert _valid_sudoku(ggrid, n, bh, bw)
        assert glines == make_lines(n), "a straight-frame run records no paths"
        assert (
            unique(_post_first_digit, glines, gclue, gactive, ggivens, n, bh, bw)
            is True
        ), "the recorded board must be the unique one run() proved"
        assert (
            link_codec.encode_link(
                build_doc(
                    spec,
                    n,
                    gbh,
                    gbw,
                    ggrid,
                    gclue,
                    ggivens,
                    gactive,
                    glines,
                    local=False,
                )
            )
            == link
        ), "rebuilding from gen JSON must reproduce the written link"

    # ---- run(paths=True): the local lane, bent paths drawn as groups
    with _spec(
        ["FooComponent.js"],
        main_global="puzzle.addConstraintComponent(new FooComponent())",
        clue_fn=_first_digit,
        cp_sat_clue_fn=_post_first_digit,
    ) as spec:
        argv = sys.argv
        sys.argv = ["framebuild", str(n), str(bh), str(bw), "4"]
        try:
            run(spec, paths=True)
        finally:
            sys.argv = argv
        tag = f"{n}x{n}_local"
        link = (spec.dir / f"PUZZLE_LINK_{tag}.txt").read_text().strip()
        doc = link_codec.decode_puzzle(link)
        check(spec, link, doc, n, local=True)
        assert not [
            c for c in doc["puzzle"]["cells"] if "value" in c and not c.get("given")
        ]
        # the local board records its generated geometry, and load_gen reads it
        # back as the lines -- a paths board's lines are not derivable from n
        _bh, _bw, ggrid, _c, _g, _a, glines = load_gen(spec.dir, n, tag=tag)
        assert glines != make_lines(n), "a paths run must record bent paths"
        assert repeating_lines(ggrid, glines), "the recorded board must repeat a digit"

    print("framebuild self-check OK")
