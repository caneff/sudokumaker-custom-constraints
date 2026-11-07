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
    W, H = doc["width"], doc["height"]
    n, rows = W - 2, H - 2
    cells = doc["cells"]
    givens = {}
    for r in range(rows):
        for c in range(n):
            cell = cells[interior_index(W, r, c)]
            if cell.get("given"):
                givens[(r, c)] = cell["value"]
    shown = {}
    for side in "LRTB":
        # a left or right clue names a row, a top or bottom clue a column
        for i in range(rows if side in "LR" else n):
            r, c = ring_cell(f"{side}{i}", W, H)
            cell = cells[r * W + c]
            if cell.get("given"):
                shown[(side, i)] = cell["value"]
    return givens, shown


def mismatches(doc, givens, shown):
    """Readable mismatch lines between the link and the gen JSON: the link's
    interior givens against `givens`, its shown ring clues against `shown`
    (both keyed as `link_board` keys them). An empty list means they match."""
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


def stale_against_grid(board, read):
    """Lines for every gen given or clue the recorded grid contradicts. `board`
    carries `grid`, `givens` and `clue`; `read` maps each clue key to the value
    the grid reads there. An empty list means the grid agrees with the gen."""
    grid = board.grid
    return [
        f"given {key}: gen says {v}, the recorded grid has {grid[key[0]][key[1]]}"
        for key, v in sorted(board.givens.items())
        if grid[key[0]][key[1]] != v
    ] + [
        f"clue {key[0]}{key[1]}: gen says {board.clue[key]}, "
        f"the recorded grid reads {read[key]}"
        for key in sorted(board.lines)
        if read[key] != board.clue[key]
    ]
