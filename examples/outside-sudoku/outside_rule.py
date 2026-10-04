# The window rule's one Python copy, shared by build_size.py and verify.py. Its
# JS homes are OutsideSudokuComponent.js, window-length.js and
# soundness-harness.mjs (CODING_STANDARDS.md, "The rule has one home"): a
# change to the rule touches all of them.
#
# The two window lengths must agree; build_size.test.py checks that they do.
# Nothing here imports ortools, so the tests reach the rule without the solver.


def window_length_by_box(cells, bh, bw):
    """The window length of an interior line, from the box shape.

    `cells` are (row, column) pairs, nearest the clue first.
    """
    along_row = len(cells) == 1 or cells[1][0] == cells[0][0]
    return min(bw if along_row else bh, len(cells))


def window_length_by_region(line, region, row, column):
    """The window length of a line of board indices, from the board's regions.

    `region`, `row` and `column` are per-index lookups off the decoded link.
    A line whose first cell has no region (region -1) gets the whole line: the
    same weaker, never unsound fallback window-length.js makes.
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
