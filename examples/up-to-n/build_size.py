# Build an Up to N board at any size, or re-encode a committed one.
#
# The board is a plain n x n sudoku with no ring: framebuild's no-ring mode
# draws all 4n markers, fills every clue from a fresh grid, carves givens and
# then shown clues while CP-SAT still proves one solution, and encodes the
# link. The rule itself -- clue function, CP-SAT model, rules text, markers --
# is `SPEC` below.
#
#   uv run examples/up-to-n/build_size.py 4 2 2 --local
#   uv run examples/up-to-n/build_size.py 6 2 3 --local
#   uv run examples/up-to-n/build_size.py --rebuild 6 --local
#
# Args: n box_height box_width [seed_count] --local, or --rebuild n --local.
# `--local` is required: a no-ring board has only the drawn-groups lane, and
# framebuild refuses the other. --rebuild re-encodes a committed board against
# the code in the tree, with no fresh CP-SAT search.
#
# The 9x9 has two boards. The carve's minimal one, PUZZLE_LINK_9x9.txt /
# gen_9x9.json, is unique by CP-SAT but times out in the live app
# (docs/research/368-up-to-n-setup-throw.md, finding 5). The shipped one,
# PUZZLE_LINK.txt / gen.json, is the same solution with more clues shown and
# still no givens, derived from the minimal one:
#
#   uv run examples/up-to-n/build_size.py 9 3 3 --local   # writes the plain pair
#   (move the plain pair to PUZZLE_LINK_9x9.txt / gen_9x9.json)
#   uv run examples/up-to-n/build_size.py --derive-shipped-9x9
#   uv run examples/up-to-n/build_size.py --rebuild 9 --local
#   uv run examples/up-to-n/build_size.py --rebuild-minimal-9x9

import pathlib
import random
import sys
from dataclasses import replace

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
import link_codec
from framebuild import (
    NO_RING_RULES_PREFIX,
    Spec,
    board_files,
    build_doc,
    check,
    load_board,
    main,
    rebuild,
    save_board,
    unique,
)

HERE = pathlib.Path(__file__).parent
CONSTRAINT_NAME = "Up to N"

# The worked example in the rules text, per size: a row read from its left
# marker. Row 2 aims at the 2.
RULE_EXAMPLES = {
    4: "a clue of 4 at the left end of row 2 is true of the row 3124, since 3 + 1 = 4",
    6: "a clue of 11 at the left end of row 2 is true of the row 416253, since 4 + 1 + 6 = 11",
    9: "a clue of 12 at the left end of row 5 is true of the row 921564738, since 9 + 2 + 1 = 12",
}


def rule_text(n):
    rule = (
        "Up to N: a clue sits in a two-cell marker at one end of a row or "
        "column. N is that row's or column's number. Reading inward from the "
        "marker, the digits before the first N sum to the clue; N itself is "
        "not added. A marker with no number is not a clue."
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
    # the digits strictly before the first N, summed; None if N is absent
    target = target_digit(cells)
    total = 0
    for v in values:
        if v == target:
            return total
        total += v
    return None


def add_up_to_n(m, x, cells, kk, n, tag, _box):
    # hit[i]: cell i holds N. before[i]: no cell up to and including i holds
    # N, so cell i is read -- the first N itself never is. The read cells sum
    # to kk, and some cell holds N -- on a row of a sudoku that is automatic,
    # but the rule itself demands it.
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
        m.AddBoolAnd([h.Not() for h in hit[: i + 1]]).OnlyEnforceIf(before)
        m.AddBoolOr(hit[: i + 1]).OnlyEnforceIf(before.Not())
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
    # the board has no ring, so no "inner grid" to name
    rules_prefix=NO_RING_RULES_PREFIX,
)

MINIMAL_9X9 = (HERE / "PUZZLE_LINK_9x9.txt", HERE / "gen_9x9.json")
# Clues the shipped 9x9 shows. 18 is the fewest of the counts probed that the
# live app solves: 15 times out, 18 is unique in 15 s (finding 5).
SHIPPED_9X9_CLUES = 18


def shipped_9x9(minimal):
    """The minimal 9x9 with clues added, in a fixed seeded order, until it
    shows SHIPPED_9X9_CLUES. The order is the one the live-app probe used."""
    extra = sorted(set(minimal.lines) - minimal.active)
    random.Random(370).shuffle(extra)
    more = SHIPPED_9X9_CLUES - len(minimal.active)
    return replace(minimal, active=set(minimal.active) | set(extra[:more]))


def derive_shipped_9x9():
    board = shipped_9x9(load_board(MINIMAL_9X9[1]))
    assert unique(SPEC.cp_sat_clue_fn, board) is True
    doc = build_doc(SPEC, board, local=True)
    link = link_codec.encode_link(doc)
    check(SPEC, link, doc, board, local=True)
    link_path, gen_path = board_files(SPEC, 9, local=True)
    link_path.write_text(link + "\n")
    save_board(board, gen_path)
    print(f"wrote {link_path.name} ({len(link)} chars) and {gen_path.name}")


if __name__ == "__main__":
    if sys.argv[1:] == ["--derive-shipped-9x9"]:
        derive_shipped_9x9()
    elif sys.argv[1:] == ["--rebuild-minimal-9x9"]:
        link = rebuild(SPEC, 9, local=True, files=MINIMAL_9X9)
        MINIMAL_9X9[0].write_text(link + "\n")
        print(f"wrote {MINIMAL_9X9[0].name} -- current component code, same board")
    else:
        main(SPEC)
