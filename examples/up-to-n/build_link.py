# Up to N: the rule's Python half and the board builder.
#
# Holds the Spec every Up to N board is built from -- the clue rule, its CP-SAT
# model, the rules text, and the drawn markers. build_size.py builds and
# rebuilds boards from it. Run directly, this builds a same-board comparison
# link for `just time` (docs/real-app-timing.md): the committed PUZZLE_LINK.txt
# (or --board) with the named component's code swapped for the given file's.
#
#   uv run examples/up-to-n/build_link.py --component UpToNComponent.js --out <file>
#
# The board is a bare n x n sudoku with no ring. All 4n marker slots are drawn
# as two-cell groups at the ends of every row and column; a shown clue is the
# group's typed value, a hidden one an empty value that main.js ignores.

import argparse
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from framebuild import Spec
from link_codec import decode_puzzle
from link_swap import check_and_write, swap_component_code
from minify import minify_file

HERE = pathlib.Path(__file__).parent
CONSTRAINT_NAME = "Up to N"
TIMED_COMPONENT = "UpToNComponent"

# The worked example in the rules text, per size: a row read from its left
# marker. Row 2 aims at the 2.
RULE_EXAMPLES = {
    4: "a clue of 6 at the left end of row 2 is true of the row 3124, since 3 + 1 + 2 = 6",
    6: "a clue of 13 at the left end of row 2 is true of the row 416253, since 4 + 1 + 6 + 2 = 13",
    9: "a clue of 17 at the left end of row 5 is true of the row 921564738, since 9 + 2 + 1 + 5 = 17",
}


def rule_text(n):
    rule = (
        "Up to N: a clue sits in a two-cell marker at one end of a row or "
        "column. N is that row's or column's number. Reading inward from the "
        "marker, the digits up to and including the first N sum to the clue. "
        "A marker with no number is not a clue."
    )
    ex = RULE_EXAMPLES.get(n)
    if ex:
        rule = f"{rule} For example, {ex}."
    return rule


def target_digit(cells):
    """N for a line given as (row, column) cells from its marked end: the row's
    1-based number for a row, the column's for a column."""
    (r0, c0), (r1, _) = cells[0], cells[1]
    return r0 + 1 if r0 == r1 else c0 + 1


def up_to_n(values, cells, _box):
    # the digits up to and including the first N, summed; None if N is absent
    target = target_digit(cells)
    total = 0
    for v in values:
        total += v
        if v == target:
            return total
    return None


def add_up_to_n(m, x, cells, kk, n, tag, _box):
    # hit[i]: cell i holds N. before[i]: no earlier cell holds N, so cell i is
    # read. The read cells sum to kk, and some cell holds N -- on a row of a
    # sudoku that is automatic, but the rule itself demands it.
    target = target_digit(cells)
    hit = []
    for i, cell in enumerate(cells):
        h = m.NewBoolVar(f"h{tag}_{i}")
        m.Add(x[cell] == target).OnlyEnforceIf(h)
        m.Add(x[cell] != target).OnlyEnforceIf(h.Not())
        hit.append(h)
    m.AddBoolOr(hit)
    read = []
    for i, cell in enumerate(cells):
        before = m.NewBoolVar(f"b{tag}_{i}")
        m.AddBoolAnd([h.Not() for h in hit[:i]]).OnlyEnforceIf(before)
        if i:
            m.AddBoolOr(hit[:i]).OnlyEnforceIf(before.Not())
        else:
            m.Add(before == 1)
        term = m.NewIntVar(0, n, f"t{tag}_{i}")
        m.Add(term == x[cell]).OnlyEnforceIf(before)
        m.Add(term == 0).OnlyEnforceIf(before.Not())
        read.append(term)
    m.Add(sum(read) == kk)


def markers(board):
    # every line's two cells at its marked end, clued when the board shows it
    return [
        (cells[:2], board.clue[key] if key in board.active else None)
        for key, cells in sorted(board.lines.items())
    ]


SPEC = Spec(
    dir=HERE,
    title="Up to N",
    constraint_name=CONSTRAINT_NAME,
    components=["UpToNComponent.js"],
    min_digit=1,
    clue_fn=up_to_n,
    cp_sat_clue_fn=add_up_to_n,
    comment_fn=rule_text,
    groups_fn=markers,
    # a marker names a whole row or column, so the lines never bend
    bent_lines=False,
    rules_prefix="Normal sudoku rules apply. ",
)


def build(component_path, out_path, board_path=None):
    component_path = pathlib.Path(component_path)
    board_path = pathlib.Path(board_path) if board_path else HERE / "PUZZLE_LINK.txt"
    code = minify_file(component_path)
    base = decode_puzzle(board_path.read_text().strip())
    doc = swap_component_code(base, CONSTRAINT_NAME, component_path.stem, code)
    return check_and_write(base, doc, CONSTRAINT_NAME, out_path)


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--component", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--board")
    args = p.parse_args()
    build(args.component, args.out, board_path=args.board)
    print(f"wrote {args.out}")
