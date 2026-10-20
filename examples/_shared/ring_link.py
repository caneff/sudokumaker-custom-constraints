# Read a committed ring board's link back as board data: the interior givens
# and the shown ring clues, keyed the way a gen JSON records them, and compare
# the two. Shared by every verify.py that proves a ring board is still the
# board its gen JSON records (skyscraper, isofill-skyscraper).

from frame import ring_cell


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
