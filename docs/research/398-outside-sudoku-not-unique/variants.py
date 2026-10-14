# Two variants of an outside-sudoku link, for #398 (see ../398-outside-sudoku-not-unique.md).
#
#   uv run --with lzstring --with ortools python variants.py fill <src> <out>
#   uv run --with lzstring --with ortools python variants.py drop <src> <out>
#
# fill: every blank outside clue becomes a given, set to the digit the CP-SAT
#       solution holds in the first cell of its window. The app should read it
#       unique.
# drop: every blank outside clue becomes a given, and its component is not
#       registered (the embedded main code skips that clue). The app then counts
#       exactly the inner grids that satisfy the shown clues, so its solution
#       count is the inner-grid count of the bare link: 1 means no second inner
#       grid exists in the app's own model.
#
# Reads the link the way verify.py does and reuses its clue_groups and the
# window rule from outside_rule.py; writes a research copy, never a shipped link.

import copy
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
EX = ROOT / "examples" / "outside-sudoku"
sys.path[:0] = [str(ROOT / "examples" / "_shared"), str(EX)]

import verify
from outside_rule import post_membership, window_length_by_region
from sudoku_kit import cpsat
from sudoku_kit.link_codec import decode_puzzle, encode_link

GLOBAL_ANCHOR = "for (const g of frameLines(puzzle)) {\n"
LOCAL_ANCHOR = "  const [clue, ...line] = cells\n"


def solve_inner(doc, link, W, n, groups):
    cells = doc["cells"]
    region = next(c for c in doc["constraints"] if c.get("type") == 1)["regions"]
    row = [i // W for i in range(W * W)]
    col = [i % W for i in range(W * W)]
    houses = {}
    for i in range(W * W):
        if region[i] >= 0:
            r, c = divmod(i, W)
            houses.setdefault(region[i], []).append((r - 1, c - 1))
    m, grid = cpsat.sudoku_model(n, None, regions=list(houses.values()))
    x = {(r + 1) * W + c + 1: v for (r, c), v in grid.items()}
    for i in x:
        if cells[i].get("given"):
            m.Add(x[i] == cells[i]["value"])
    for clue, *line in groups:
        if cells[clue].get("given"):
            w = window_length_by_region(line, region, row, col)
            post_membership(m, x, line[:w], cells[clue]["value"], str(clue))
    first, unique = cpsat.solve_unique(m, x, 120)
    assert unique, "the inner grid is not unique; nothing to compare"
    return first


def skip_blank_clues(doc, blanks):
    comp = next(
        c for c in doc["constraints"] if c.get("type") == 1000 and "definition" in c
    )
    code = comp["definition"]["backend"]["code"]
    skip = "if (new Set(%s).has(%s)) continue\n"
    ids = sorted(blanks)
    if GLOBAL_ANCHOR in code:
        code = code.replace(
            GLOBAL_ANCHOR, GLOBAL_ANCHOR + "  " + skip % (ids, "g.clue"), 1
        )
    else:
        assert LOCAL_ANCHOR in code, "main code has neither known loop"
        code = code.replace(LOCAL_ANCHOR, LOCAL_ANCHOR + "  " + skip % (ids, "clue"), 1)
    comp["definition"]["backend"]["code"] = code


def main(argv):
    mode, src, out = argv[1], argv[2], argv[3]
    link = decode_puzzle(pathlib.Path(src).read_text().strip())
    doc = link["puzzle"]
    W = doc["width"]
    groups = verify.clue_groups(link, W, W - 2)
    first = solve_inner(doc, link, W, W - 2, groups)
    new = copy.deepcopy(link)
    cells = new["puzzle"]["cells"]
    blanks = [g[0] for g in groups if not doc["cells"][g[0]].get("given")]
    for clue, *line in groups:
        if clue in blanks:
            value = first[line[0]] if mode == "fill" else doc["minDigit"]
            cells[clue] = {"value": value, "given": True}
    if mode == "drop":
        skip_blank_clues(new["puzzle"], blanks)
    pathlib.Path(out).write_text(encode_link(new))
    print(f"{mode}: {len(blanks)} blank clues of {len(groups)} -> {out}")


if __name__ == "__main__":
    main(sys.argv)
