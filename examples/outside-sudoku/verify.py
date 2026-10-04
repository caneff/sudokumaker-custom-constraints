# Prove a board has exactly one solution, with OR-Tools CP-SAT. Defaults to
# the shipped board; name a link file to check a variant.
#
#   uv run --with lzstring --with ortools examples/outside-sudoku/verify.py
#   uv run --with lzstring --with ortools examples/outside-sudoku/verify.py \
#       examples/outside-sudoku/PUZZLE_LINK_6x6.txt
#
# Givens, shown clues, drawn groups and box regions all come off the link
# itself, so this checks the artifact a reader opens, not a side file that can
# fall out of step.
#
# Slow (a full CP-SAT solve plus a second-solution search), so `just test` does
# not run it. Run it by hand after changing the board or the rule.

import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

import cpsat
from build_link import CONSTRAINT_NAME
from frame import ring_cell
from framebuild import make_lines
from link_codec import decode_puzzle
from outside_rule import post_membership, window_length_by_region
from sm_document import find_constraint

SOLVE_LIMIT = 120


def clue_groups(link, W, n):
    """Every clue's cells -- clue cell first, then the line inward -- however
    the board carries them.

    The local board ships each line as a drawn group; the global board ships
    none, so this rebuilds the 4n frame lines the way main-global.js does."""
    groups = find_constraint(link, CONSTRAINT_NAME)["input"].get("groups")
    if groups is not None:
        return [g["cells"] for g in groups]
    groups = []
    for (side, i), cells in make_lines(n).items():
        cr, cc = ring_cell(f"{side}{i}", W)
        groups.append([cr * W + cc] + [(r + 1) * W + c + 1 for r, c in cells])
    return groups


def main(argv):
    path = pathlib.Path(argv[1]) if len(argv) > 1 else HERE / "PUZZLE_LINK.txt"
    link = decode_puzzle(path.read_text().strip())
    doc = link["puzzle"]
    W = doc["width"]
    n = W - 2
    cells = doc["cells"]
    region = next(c for c in doc["constraints"] if c.get("type") == 1)["regions"]
    row = [i // W for i in range(W * W)]
    column = [i % W for i in range(W * W)]
    interior = [i for i in range(W * W) if region[i] >= 0]

    houses = {}
    for i in interior:
        r, c = divmod(i, W)
        houses.setdefault(region[i], []).append((r - 1, c - 1))
    m, grid = cpsat.sudoku_model(n, None, regions=list(houses.values()))
    x = {(r + 1) * W + c + 1: v for (r, c), v in grid.items()}
    for i in interior:
        if cells[i].get("given"):
            m.Add(x[i] == cells[i]["value"])

    shown = 0
    for group in clue_groups(link, W, n):
        clue, *line = group
        # A hidden clue constrains nothing: the solver may fill it with any
        # window digit.
        if not cells[clue].get("given"):
            continue
        shown += 1
        value = cells[clue]["value"]
        w = window_length_by_region(line, region, row, column)
        post_membership(m, x, line[:w], value, str(clue))

    givens = sum(1 for i in interior if cells[i].get("given"))
    print(f"{path.name} ({n}x{n}): {givens} interior givens, {shown} shown clues")

    first, unique = cpsat.solve_unique(m, x, SOLVE_LIMIT)
    assert first is not None, "the shipped board has no solution"
    assert unique, "the shipped board has two solutions"
    print("ok — exactly one solution")


if __name__ == "__main__":
    main(sys.argv)
