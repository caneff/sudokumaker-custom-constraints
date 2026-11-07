# Fixtures shared by the frame builder's tests (board, carve, document and
# lanes .test.py): a temp-directory Spec, a real n=4 board, a solver-backed
# toy clue rule, and a non-sudoku toy interior.

import contextlib
import dataclasses
import pathlib
import tempfile

from board import Board, Spec, make_lines


@contextlib.contextmanager
def temp_spec(
    components,
    main_global="puzzle.addConstraintComponent(new FooComponent())",
    clue_fn=None,
    cp_sat_clue_fn=None,
    **fields,
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
            constraint_name="Widget Lines",
            components=components,
            min_digit=1,
            clue_fn=clue_fn or (lambda values, cells, box: 0),
            cp_sat_clue_fn=cp_sat_clue_fn or (lambda *a, **k: None),
            comment_fn=lambda n: "test rules",
            **fields,
        )


# A real, solver-backed clue rule for the generator cases: the clue is the
# digit in the cell nearest the clue, read inward. Trivial as a puzzle, but a
# genuine constraint on the model -- which is all generate()/unique() need, and
# it reads the same on a straight frame line and on a bent path.
def first_digit(values, cells, box):
    return values[0]


def post_first_digit(m, x, cells, kk, n, tag, box):
    m.Add(x[cells[0]] == kk)


def valid_sudoku(grid, n, bh, bw):
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


def make_board(n=4, bh=2, bw=2, **fields):
    """A real n x n board value: a valid grid, no givens, every ring clue
    shown -- unit fixtures only, this board is never shared, so the "leave
    most of the ring blank" rule for a shared board does not apply here.
    """
    grid = [[((r * bw + r // bh + c) % n) + 1 for c in range(n)] for r in range(n)]
    lines = make_lines(n)
    return dataclasses.replace(
        Board(
            n=n,
            bh=bh,
            bw=bw,
            grid=grid,
            clue=dict.fromkeys(lines, 0),
            givens={},
            active=set(lines),
            lines=lines,
            height=n,
            digits=n,
        ),
        **fields,
    )


# A toy non-sudoku interior: every cell of row r holds r + 1. Rows repeat a
# digit, so neither the sudoku grid nor the sudoku model could ever agree with
# it -- a pass proves the Spec's own grid and model were used.
def striped_grid(rng, n, bh, bw):
    return [[r + 1] * n for r in range(n)]


def striped_model(n, box):
    from ortools.sat.python import cp_model

    m = cp_model.CpModel()
    x = {(r, c): m.NewIntVar(1, n, f"x{r}{c}") for r in range(n) for c in range(n)}
    for (r, _), v in x.items():
        m.Add(v == r + 1)
    return m, x


TOY = {
    "grid_fn": striped_grid,
    "model_fn": striped_model,
    "box_regions": False,
    "rowcol_houses": False,
}
