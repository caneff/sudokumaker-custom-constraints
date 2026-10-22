# Prove the shipped ISOFILL Skyscrapers board is still the board its proof was
# run on, and still unique.
#
#   uv run examples/isofill-skyscraper/verify.py
#
# Three checks, on the one committed board (PUZZLE_LINK.txt, gen.json):
#
#   1. The link decodes to the board gen.json records -- the same interior
#      givens and the same shown clues, cell for cell -- and declares no box
#      regions and no row/column houses, which the ISOFILL model has none of.
#   2. The solution gen.json records really is a solution of that board: the
#      ISOFILL model accepts the grid with every cell pinned, the givens are
#      its digits, and every recorded clue is the one `visible` reads off it.
#      Uniqueness alone would not catch a corrupted grid: the solver would
#      find the one solution the clues do describe.
#   3. The board has exactly one solution, under the model build_size.py
#      carved it with (framebuild.unique on the ISOFILL interior, SPEC's
#      clue rule).
#
# A staleness check, not a second opinion on the rule: it shares the
# generator's model on purpose, and what it catches is a board that outlived
# its proof. That a link opens clean is check_layout.py's; that it ships its
# lane's own components is framebuild.Lane.check's, run by build_size.py.

import pathlib
import sys

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

from build_size import MIN_DIGIT, SPEC
from framebuild import FRAME_BACKENDS, RingGlobal, load_board, unique
from isofill_model import Board as IsofillBoard
from isofill_model import model
from ring_link import mismatches
from sudoku_kit import cpsat
from sudoku_kit.link_codec import decode_puzzle

ROWCOL_TITLE = dict(FRAME_BACKENDS)["frame-rowcol"]

# Seconds per solve for this gate's proofs: well past what the shipped board
# takes (OPTIMIZATION_LOG.md has the figure), so a loaded box does not turn a
# sound board red, and a model that slows past it still fails loud.
GATE_LIMIT = 60


def house_problems(doc):
    """What the link declares that the ISOFILL model does not: box regions
    (a type-1 constraint) or the frame's row/column houses."""
    problems = []
    if any(c.get("type") == 1 for c in doc["constraints"]):
        problems.append("the link draws box regions")
    names = [c.get("definition", {}).get("name") for c in doc["constraints"]]
    if ROWCOL_TITLE in names:
        problems.append("the link declares the interior's rows and columns as houses")
    return problems


def grid_problems(board):
    grid = board.grid
    m, x = model(IsofillBoard.of(board.n, MIN_DIGIT, board.rows, board.digit_count), {})
    for (r, c), v in x.items():
        m.Add(v == grid[r][c])
    status = cpsat.solver(GATE_LIMIT).Solve(m)
    assert status in (*cpsat.SOLVED, cpsat.cp_model.INFEASIBLE), (
        f"no verdict on the pinned grid: {status.name}"
    )
    read = {
        key: SPEC.clue_fn([grid[r][c] for (r, c) in cells], cells, board.box)
        for key, cells in board.lines.items()
    }
    return (
        (
            []
            if status in cpsat.SOLVED
            else ["the recorded grid is not an ISOFILL solution"]
        )
        + [
            f"given {key}: gen says {v}, the recorded grid has {grid[key[0]][key[1]]}"
            for key, v in sorted(board.givens.items())
            if grid[key[0]][key[1]] != v
        ]
        + [
            f"clue {key[0]}{key[1]}: gen says {board.clue[key]}, "
            f"the recorded grid reads {read[key]}"
            for key in sorted(board.lines)
            if read[key] != board.clue[key]
        ]
    )


def check(board, link_file):
    n, rows = board.n, board.rows
    givens, active, clue = board.givens, board.active, board.clue
    doc = decode_puzzle(link_file.read_text().strip())["puzzle"]
    assert (doc["width"], doc["height"]) == (n + 2, rows + 2), (
        f"{link_file.name} is {doc['width'] - 2}x{doc['height'] - 2}, "
        f"not the {n}x{rows} board gen records"
    )
    bad = mismatches(doc, givens, {k: clue[k] for k in active}) + house_problems(doc)
    assert not bad, f"{link_file.name} is not the recorded board:\n  " + "\n  ".join(
        bad
    )
    bad = grid_problems(board)
    assert not bad, (
        f"{link_file.name}: the recorded solution does not solve the recorded "
        "board:\n  " + "\n  ".join(bad)
    )
    verdict = unique(SPEC.cp_sat_clue_fn, board, SPEC.model_fn, GATE_LIMIT)
    # None is no verdict -- a solve spent the time limit, or the model is
    # unsatisfiable. Reporting it as "two solutions" would send a reader
    # hunting the wrong bug.
    assert verdict is not None, (
        f"{link_file.name}: no verdict inside the CP-SAT limit, a timeout or a "
        "board the model cannot satisfy, so uniqueness was never put to the test"
    )
    assert verdict is True, f"{link_file.name} has more than one solution"
    print(
        f"{link_file.name} ({n}x{rows}): {len(givens)} interior givens, "
        f"{len(active)} shown clues of {len(board.lines)} -- matches gen, grid "
        "solves it, exactly one solution"
    )


def main():
    link_file, gen_file = RingGlobal(SPEC).files(9)
    check(load_board(gen_file), link_file)


if __name__ == "__main__":
    main()
