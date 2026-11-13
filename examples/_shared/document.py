# The document parts every frame board shares: the rules sentences a link opens
# and closes with, the drawn groups of a local board (`frame_groups`), the
# frame's own backends, the opt-in House GAC filter, and the header fields
# around a board's cells (`board_document`).

import pathlib
import sys
from typing import NamedTuple

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from board import ring_name
from frame import ring_cell
from minify import minify_file
from sm_document import code_constraint, find_constraint, puzzle_doc

# Every generated link opens with a rules sentence (project rule). The board's
# shape picks it, through its lane's `rules_prefix`: a ring board opens with
# RULES_PREFIX unless its Spec names its own opening (`Spec.rules_prefix`, ""
# for an interior with no sudoku rules), and a no-ring board, which has no
# inner grid to name, with NO_RING_RULES_PREFIX.
RULES_PREFIX = "Normal sudoku rules apply on the inner grid. "
NO_RING_RULES_PREFIX = "Normal sudoku rules apply. "


# A bent-path link's rules text closes with this: its lines are drawn paths,
# not rows and columns, so a solver must not read them as houses. One
# sentence for every example, since the fact is the variant's, not the rule's.
# A local board whose drawn lines ARE the frame lines does not get it -- there
# the lines are houses.
LOCAL_RULES_SUFFIX = (
    " Each clue sits at the end of a drawn line, read inward. A line is not a "
    "row, a column, or any other house: a digit may repeat along it."
)


def frame_groups(n, lines):
    """The drawn groups for `lines` on an n x n interior: each group is the
    clue's ring cell, then that line's cells inward, which is the order
    `main.js` reads (docs/example-layout.md).

    A local board's `input.groups`, and the same input a wrapper that reads
    `input.groups` needs on a board whose own lane draws none -- see
    numbered-rooms/build_original.py and skyscraper/build_original.py.
    """
    W = n + 2

    def idx(r, c):
        return r * W + c

    return [
        {
            "cells": [
                idx(*ring_cell(ring_name(key), W)),
                *(idx(r + 1, c + 1) for r, c in lines[key]),
            ],
            "value": "",
        }
        for key in sorted(lines)
    ]


class SharedBackend(NamedTuple):
    """One backend file in `_shared/`: `stem` names `<stem>.js`, `title` is the
    constraint name it ships under, `component` the one component it registers
    (`<component>.js`), None for none."""

    stem: str
    title: str
    component: str | None = None


# The one registry of shared backends. The checker, the builders, the lanes and
# the timing tool read the file names and titles from here and keep no list of
# their own. The code is generated from the working tree, so it is not part of
# a board.
FRAME_ROWCOL = SharedBackend("frame-rowcol", "Frame Rows and Columns")
FRAME_CORNERS = SharedBackend("frame-corners", "Frame Corners")
# Opt-in per board (`Spec.house_gac`).
HOUSE_GAC = SharedBackend("house-gac", "House GAC", "HouseGacComponent")
# A no-ring board's one backend: every row and column of the whole grid as a
# house, in place of both frame backends (no ring lines to drop, no corners).
GRID_ROWCOL = SharedBackend("grid-rowcol", "Grid Rows and Columns")
SHARED_BACKENDS = (FRAME_ROWCOL, FRAME_CORNERS, HOUSE_GAC, GRID_ROWCOL)
SHARED_BACKEND_TITLES = frozenset(b.title for b in SHARED_BACKENDS)
# The two a ring board always carries: `refresh_frame_backends` treats their
# absence as an error.
FRAME_ALWAYS_ON = (FRAME_ROWCOL, FRAME_CORNERS)


def backend_code(backend, keep_comments=False):
    """`backend`'s minified code, read from the working tree. `keep_comments`
    is the annotated-link build."""
    shared = pathlib.Path(__file__).parent
    return minify_file(shared / f"{backend.stem}.js", keep_comments)


def component_code(backend, keep_comments=False):
    """`backend`'s one component's minified code, read from the working tree."""
    shared = pathlib.Path(__file__).parent
    return minify_file(shared / f"{backend.component}.js", keep_comments)


def refresh_frame_backends(doc):
    """Point a decoded document's frame backends at the code in the tree.

    A board `carve.generate` carved is rebuilt whole, so it picks the current code
    up for free. A hand-built frame board is not: its own script injects only
    that example's constraint, and the shared backends would keep whatever
    copy the board was first encoded with -- which `link_checks.check_houses`
    then reads as a link that declares no interior lines at all. Raises when a
    backend is missing, so a board that should carry them cannot quietly skip
    the refresh.
    """
    for backend in FRAME_ALWAYS_ON:
        find_constraint(doc, backend.title)["definition"]["backend"]["code"] = (
            backend_code(backend)
        )
    return doc


HOUSE_GAC_BACKEND_TITLE = HOUSE_GAC.title
HOUSE_GAC_COMPONENT_NAME = HOUSE_GAC.component

# HouseGacComponent.js's own MAX_CELLS: the largest house it will register on.
# `build_doc` reads it here, not from the JS, so a board past this size fails
# loud at build time instead of registering a component that refuses itself
# at solve time on a link already shipped.
HOUSE_GAC_MAX_CELLS = 9


def house_gac_constraint(n):
    """The house-GAC constraint block for an `n`-cell interior: the shared
    backend plus its one component, no input. `n` is every caller's board
    size, checked here -- not only in `build_doc` -- because a hand-built
    board (running-start's `build_link.py`) appends this constraint directly
    and never calls `build_doc` at all."""
    if n > HOUSE_GAC_MAX_CELLS:
        raise ValueError(
            f"house_gac_constraint: n={n} exceeds HouseGacComponent's "
            f"{HOUSE_GAC_MAX_CELLS}-cell house cap -- every interior row, "
            "column and box on this board would be that many cells, so the "
            "filter refuses to register at all (#421)"
        )
    return code_constraint(
        HOUSE_GAC.title,
        backend_code(HOUSE_GAC),
        [(HOUSE_GAC.component, component_code(HOUSE_GAC))],
    )


def board_document(spec, board, width, cells, constraints, comment, height=None):
    """The document around one board's cells and constraints: the header
    fields every frame-builder link shares, in the order they are encoded. `height`
    is the document's, the frame included; None is as tall as it is wide."""
    return puzzle_doc(
        {
            "name": f"{spec.title} {board.n}x{board.height}",
            "author": "",
            "comment": comment,
            # minDigit/maxDigit pin the digit range to the digit count; the app
            # otherwise defaults a custom puzzle to 1..9 regardless of grid size.
            "type": "custom",
            "width": width,
            "height": width if height is None else height,
            "minDigit": spec.min_digit,
            "maxDigit": board.digits,
            "cells": cells,
            "constraints": constraints,
        },
        sudokupad_export=True,
    )
