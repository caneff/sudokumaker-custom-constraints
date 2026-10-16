# grid_to_link: 81 characters in, a plain 9x9 puzzle link out. The seam is the
# link, read back through the app's own codec -- never the builder's internals.
#
#   uv run examples/_shared/grid_to_link.test.py

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from grid_to_link import grid_to_link
from sudoku_kit.link_codec import decode_puzzle

# Platinum Blonde, from docs/research/406-gac-demo/hard/README.md's source list.
PLATINUM = (
    ".......12........3..23..4....18....5.6..7.8.......9.....85.....9...4.5..47...6..."
)
# The same board spelled with zeros, the way Royle's file writes it.
PLATINUM_ZEROS = PLATINUM.replace(".", "0")


def givens(doc):
    cells = doc["puzzle"]["cells"]
    return "".join(str(c["value"]) if c.get("given") else "." for c in cells)


def test_round_trip_dots():
    doc = decode_puzzle(grid_to_link(PLATINUM))
    assert givens(doc) == PLATINUM


def test_round_trip_zeros():
    doc = decode_puzzle(grid_to_link(PLATINUM_ZEROS))
    assert givens(doc) == PLATINUM


def test_board_is_plain_9x9_with_rows_columns_and_boxes():
    p = decode_puzzle(grid_to_link(PLATINUM))["puzzle"]
    assert (p["width"], p["height"], len(p["cells"])) == (9, 9, 81)
    regions = next(c for c in p["constraints"] if c["type"] == 1)["regions"]
    assert regions[:12] == [0, 0, 0, 1, 1, 1, 2, 2, 2, 0, 0, 0]
    # the box rows below the first, read off cell positions (row 3 col 0,
    # row 3 col 3, row 6 col 0, the last cell)
    assert [regions[27], regions[30], regions[54], regions[80]] == [3, 4, 6, 8]
    assert sorted(regions) == sorted(list(range(9)) * 9)
    assert any(c["type"] == 1000 for c in p["constraints"])  # rows and columns


def test_rules_text_is_the_ringless_sentence():
    p = decode_puzzle(grid_to_link(PLATINUM))["puzzle"]
    assert p["comment"].startswith("Normal sudoku rules apply.")


def test_bad_grids_are_refused_with_the_reason():
    # Each reason is the check's own message: a character int() would also
    # refuse must still be refused by the character check, by name.
    for bad, reason in [
        ("", "81 characters, got 0"),
        (PLATINUM[:-1], "81 characters, got 80"),
        (PLATINUM + ".", "81 characters, got 82"),
        (PLATINUM[:-1] + "x", "got ['x']"),
        (PLATINUM[:-1] + "A", "got ['A']"),
        (PLATINUM[:-1] + " ", "got [' ']"),
    ]:
        try:
            grid_to_link(bad)
        except ValueError as e:
            assert reason in str(e), f"{bad!r}: {e}"
            continue
        raise AssertionError(f"accepted {bad!r}")


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
    print("ok")
