# The window rule, as Python says it. OutsideSudokuComponent.js and
# soundness-harness.mjs are its other two homes (CODING_STANDARDS.md, "The rule
# has one home"); this file keeps the Python side to one copy, shared by the
# generator (build_size.py) and the uniqueness proof (verify.py).
#
# The rule: the clue digit appears in the line's window — its first w cells,
# w being the extent of line[0]'s box along the line's direction, capped by the
# line length.
#
# Two ways to measure w, because the two callers hold different things. The
# generator knows the box shape it asked for; verify.py knows only what it
# decodes off a link. They must agree, and build_size.test.py checks that they
# do. Nothing here imports ortools: `post_membership` takes the model it posts
# to, so the tests reach the rule without the solver.


def window_length_by_box(cells, bh, bw):
    """The window length of an interior line, from the box shape.

    `cells` are (row, column) pairs, nearest the clue first. A line along a row
    crosses a box's width, one along a column crosses its height.
    """
    along_row = len(cells) == 1 or cells[1][0] == cells[0][0]
    return min(bw if along_row else bh, len(cells))


def window_length_by_region(line, region, row, column):
    """The window length of a line of board indices, from the board's regions.

    `region`, `row` and `column` are per-index lookups off the decoded link.
    A line whose first cell has no region (region -1) gets the whole line: the
    same weaker, never unsound fallback OutsideSudokuComponent.windowLength
    makes.
    """
    head = line[0]
    if region[head] < 0:
        return len(line)
    along_row = len(line) == 1 or row[line[1]] == row[head]
    same = (
        (lambda c: row[c] == row[head])
        if along_row
        else (lambda c: column[c] == column[head])
    )
    extent = sum(1 for c, r in enumerate(region) if r == region[head] and same(c))
    return min(extent, len(line))


def post_membership(m, x, window, value, tag):
    """Post "some window cell holds `value`" on CP-SAT model `m`.

    `x` maps a cell to its variable, keyed however the caller keys cells:
    (row, column) pairs in the generator, board indices in verify.py.
    """
    lits = []
    for i, cell in enumerate(window):
        b = m.NewBoolVar(f"w{tag}_{i}")
        m.Add(x[cell] == value).OnlyEnforceIf(b)
        m.Add(x[cell] != value).OnlyEnforceIf(b.Not())
        lits.append(b)
    m.AddBoolOr(lits)
