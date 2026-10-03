# The no-ring lane: a board with no clue ring around it, its clues typed into
# drawn groups on the bare n x n grid (up-to-n's shape, #366). A Spec with a
# `groups_fn` builds this lane and no other -- `framebuild.spec_lanes` says
# so -- because the groups are the only place its clues live.
#
# The ring lanes, the shared generator and the board round trip stay in
# framebuild.py; this module holds what only a no-ring board needs: its
# groups, its clue labels, its document, its check and its rebuild rules.

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from framebuild import Lane, _document, _named
from minify import minify_file
from sm_document import code_constraint

# A no-ring board's one shared backend: every row and column of the whole grid
# as a house. It takes the place of both frame backends there, since a board
# with no ring has no ring lines to drop and no corners to pin.
GRID_BACKEND = ("grid-rowcol", "Grid Rows and Columns")


def grid_backend_constraint():
    """The whole-grid rows-and-columns constraint a no-ring board ships, its
    code read from the working tree."""
    name, title = GRID_BACKEND
    return code_constraint(
        title, minify_file(pathlib.Path(__file__).parent / f"{name}.js")
    )


# The editor's text symbol, as the live editor writes one (a type-2002
# "Cosmetic symbols" entry), at a size that reads as an outside clue.
LABEL_STYLE = {
    "type": "text",
    "size": 0.35,
    "angle": 0,
    "strokeWidth": 0.02,
    "stroke": "#ffffff",
    "fill": "#000000",
}


def no_ring_groups(spec, board):
    """`spec.groups_fn`'s groups in the document's own shape: cell ids on the
    n-wide grid, and the typed value as the string the app reads (an empty
    group's is ""). Raises on a cell off the grid, which would otherwise wrap
    onto some other real cell's id."""
    n = board.n
    groups = []
    for cells, value in spec.groups_fn(board):
        off = [cell for cell in cells if not (0 <= cell[0] < n and 0 <= cell[1] < n)]
        if off:
            raise ValueError(f"a drawn group's cells {off} are off the {n}x{n} grid")
        groups.append(
            {
                "cells": [r * n + c for r, c in cells],
                "value": "" if value is None else str(value),
            }
        )
    return groups


def clue_labels(groups, n):
    """The text labels that show a no-ring board's clues, or None when no group
    is clued. A drawn group renders nothing in the app, so each clued group's
    typed value is drawn as text half a cell outside the grid, beyond the
    group's first cell and away from its second: a two-cell marker's border
    cell first, so the label sits where an outside clue would.

    Wire shape (docs/research/368-up-to-n-setup-throw.md): `params` holds one
    style per label, `symbols` one point per label in cell units from the
    grid's top-left corner, the third entry indexing `params` (absent for 0).

    Raises on a clued group of fewer than two cells, or one whose label would
    land on the grid: that is not a marker, and its label would cover a cell.
    """
    params, symbols = [], []
    for g in groups:
        if g["value"] == "":
            continue
        if len(g["cells"]) < 2:
            raise ValueError(f"cannot label the group {g['cells']}: it has one cell")
        (r0, c0), (r1, c1) = (divmod(cell, n) for cell in g["cells"][:2])
        point = [c0 + 0.5 + (c0 - c1), r0 + 0.5 + (r0 - r1)]
        if 0 < point[0] < n and 0 < point[1] < n:
            raise ValueError(
                f"cannot label the group {g['cells']}: its label would sit on the "
                "grid, so its first cell is not on the border facing away from "
                "its second"
            )
        symbols.append(point + ([len(params)] if params else []))
        params.append({**LABEL_STYLE, "text": g["value"]})
    return {"type": 2002, "params": params, "symbols": symbols} if params else None


class NoRing(Lane):
    """The bare n x n grid, its clues typed into `spec.groups_fn`'s groups.

    One lane per no-ring example, so its file names carry no lane tag: the
    9x9 is plain-named and every other size is tagged by size alone (#370).
    """

    name = "no-ring"
    backend = "main.js"
    # A no-ring board ships the grid backend in place of the two frame ones.
    generated = (GRID_BACKEND[1],)
    # `check` holds the clue labels to the drawn groups, and a rebuild
    # compares the groups, so the labels are not board data either.
    derived = frozenset({2002})

    @property
    def paths(self):
        return self.spec.bent_lines

    def drawn(self, board):
        return no_ring_groups(self.spec, board)

    def files(self, n):
        return _named(self.spec, "" if n == 9 else f"{n}x{n}")

    def build_doc(self, board):
        """The whole document: the bare n x n grid, its boxes and givens, and
        the example's constraint reading `spec.groups_fn`'s groups.

        None of the ring's machinery applies: there are no corners to pin and
        no ring to paint over. The document is `"custom"`, because the live
        editor opens a `"sudoku"` document as 9x9 whatever its width says
        (docs/research/368-up-to-n-setup-throw.md). A custom document's region
        constraint gives boxes only (docs/gotchas.md #9), so the rows and
        columns ship as `grid-rowcol.js`.
        """
        spec = self.spec
        n, bh, bw = board.n, board.bh, board.bw
        cells = [
            {"value": board.grid[r][c], "given": True} if (r, c) in board.givens else {}
            for r in range(n)
            for c in range(n)
        ]
        regions = [
            (r // bh) * (n // bw) + (c // bw) for r in range(n) for c in range(n)
        ]
        groups = self.drawn(board)
        labels = clue_labels(groups, n)
        constraints = [
            {"type": 1, "regions": regions},
            {"type": 0},
            grid_backend_constraint(),
            self.example_constraint(groups),
            *([labels] if labels else []),
        ]
        comment = spec.rules_prefix + spec.comment_fn(n)
        return _document(spec, board, n, cells, constraints, comment)

    def _check_lane(self, lc, doc, board):
        spec = self.spec
        assert lc["input"]["groups"] == no_ring_groups(spec, board), (
            "the drawn groups are not the ones the Spec's groups_fn draws"
        )
        assert grid_backend_constraint() in doc["puzzle"]["constraints"], (
            "a no-ring board must carry the current grid-rowcol.js, or its rows "
            "and columns are not houses"
        )
        shown = [c for c in doc["puzzle"]["constraints"] if c.get("type") == 2002]
        want = clue_labels(no_ring_groups(spec, board), board.n)
        assert shown == ([want] if want else []), (
            "the clue labels are not the drawn groups' values: a player would "
            "read a different clue from the one the constraint enforces"
        )
        return "main.js", spec.components
