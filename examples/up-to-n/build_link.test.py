# Checks on the Up to N builder and the board it ships.
#
# 1. The rule's CP-SAT model and the JS component's `validate` agree on
#    hand-built lines: for each line, target and clue, the model with the line
#    fixed is satisfiable exactly when `validate` accepts the filled line, and
#    both match the sum worked out by hand. The lines include bare ones -- a
#    repeated digit, a repeated target, the target absent.
# 2. Every committed board -- the shipped 9x9 and the 4x4 and 6x6 variants:
#    its link decodes to a bare n x n sudoku whose drawn markers carry the
#    clues its gen JSON records, every clue is the true one for the recorded
#    solution, CP-SAT proves the givens and shown clues have exactly one
#    solution, and `build_size.py --rebuild` re-encodes it, with no search, to
#    the committed link byte for byte.
#
#   uv run examples/up-to-n/build_link.test.py

import json
import pathlib
import subprocess
import sys
import tempfile
from dataclasses import replace

HERE = pathlib.Path(__file__).parent
sys.path.insert(0, str(HERE.parent / "_shared"))
sys.path.insert(0, str(HERE))

import cpsat
from build_link import CONSTRAINT_NAME, SPEC, add_up_to_n, build
from framebuild import board_files, load_board, make_lines, rebuild, unique
from link_codec import decode_puzzle
from link_swap import blanked
from minify import minify_file
from ortools.sat.python import cp_model

# Hand-built lines, read from the marked end: (digits, target, the sum up to
# and including the first target, or None when the line never holds it).
# Worked by hand, not by any copy of the rule.
LINES = [
    ([3, 1, 4, 2], 4, 8),  # 3 + 1 + 4
    ([3, 1, 4, 2], 3, 3),  # the target is the first cell
    ([3, 1, 4, 2], 2, 10),  # the target is the last cell
    ([2, 2, 1, 3], 1, 5),  # a repeated digit before the target
    ([1, 4, 4, 2], 4, 5),  # the target twice: only the first counts
    ([2, 3, 2, 3], 4, None),  # the target absent
    ([6, 5, 4, 3, 2, 1], 1, 21),  # a 6-cell line summing all of it
    ([9, 8, 1, 2, 3, 4, 5, 6, 7], 3, 23),  # a 9-cell line
]


def model_accepts(digits, target, clue):
    """Is `digits` a solution of the CP-SAT clue model for (target, clue)?

    The line is posted as a row of a grid (row index target - 1), which is
    where a row marker's target comes from, and every cell is fixed."""
    n = len(digits)
    row = target - 1
    m = cp_model.CpModel()
    cells = [(row, c) for c in range(n)]
    x = {cell: m.NewIntVar(1, 9, f"x{cell}") for cell in cells}
    for cell, d in zip(cells, digits, strict=True):
        m.Add(x[cell] == d)
    add_up_to_n(m, x, cells, clue, n, "t", (1, n))
    return cpsat.solver(5).Solve(m) in cpsat.SOLVED


def validate_accepts(cases):
    """`UpToNComponent.validate` on each filled line, run in Node through the
    shared harness mock. `cases` is [(digits, target, clue)]."""
    script = f"""
import {{ makeIo, makePuzzle, installGlobals }} from './examples/_shared/harness-lib.mjs'
const {{ load }} = makeIo({json.dumps(str(HERE))})
const mod = load('UpToNComponent.js', ['setParams', 'validate'])
installGlobals(1, 9)
const out = {json.dumps(cases)}.map(([digits, target, clue]) => {{
  const truth = Object.fromEntries(digits.map((d, i) => [i, d]))
  const inst = {{}}
  mod.setParams(inst, digits.map((_, i) => i), target, clue)
  return mod.validate(inst, makePuzzle(truth, (c, v) => [v], {{ kind: 'bare' }}))
}})
console.log(JSON.stringify(out))
"""
    res = subprocess.run(
        ["node", "--input-type=module", "-e", script],
        cwd=HERE.parent.parent,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(res.stdout)


def test_model_and_validate_agree_on_hand_built_lines():
    cases = []
    for digits, target, true_sum in LINES:
        # The true sum, one off either way, and an arbitrary clue for a line
        # with no target at all.
        clues = [true_sum, true_sum - 1, true_sum + 1] if true_sum else [5, 10]
        cases += [(digits, target, clue) for clue in clues if clue >= 1]
    js = validate_accepts(cases)
    for (digits, target, clue), js_ok in zip(cases, js, strict=True):
        want = {t: s for d, t, s in LINES if d == digits}.get(target) == clue
        assert model_accepts(digits, target, clue) == want, (digits, target, clue)
        assert js_ok == want, ("validate", digits, target, clue)


def shipped_board_matches_its_link(link_name, gen_name):
    board = load_board(HERE / gen_name)
    n = board.n
    puzzle = decode_puzzle((HERE / link_name).read_text().strip())["puzzle"]
    # "custom", with the whole-grid rows and columns: the live editor opens a
    # "sudoku" document as 9x9 (docs/research/368-up-to-n-setup-throw.md)
    assert puzzle["type"] == "custom"
    names = [c.get("definition", {}).get("name") for c in puzzle["constraints"]]
    assert "Grid Rows and Columns" in names
    assert (puzzle["width"], puzzle["height"]) == (n, n), "no ring around the grid"
    assert puzzle["comment"].startswith("Normal sudoku rules apply. ")
    assert (puzzle["minDigit"], puzzle["maxDigit"]) == (1, n)

    # Givens: exactly the recorded ones, and nothing entered anywhere else.
    for i, cell in enumerate(puzzle["cells"]):
        r, c = divmod(i, n)
        if (r, c) in board.givens:
            assert cell == {"value": board.grid[r][c], "given": True}
        else:
            assert "value" not in cell, f"r{r}c{c} carries a value"

    lc = next(
        c
        for c in puzzle["constraints"]
        if c.get("definition", {}).get("name") == CONSTRAINT_NAME
    )
    assert lc["definition"]["backend"]["code"] == minify_file(HERE / "main.js")
    groups = lc["input"]["groups"]
    # Every one of the 4n marker slots is drawn; the shown clues carry a value.
    assert len(groups) == 4 * n
    lines = make_lines(n)
    shown = {}
    for g in groups:
        (r0, c0), (r1, c1) = (divmod(cell, n) for cell in g["cells"])
        key = next(k for k, cells in lines.items() if cells[:2] == [(r0, c0), (r1, c1)])
        if g["value"] != "":
            shown[key] = int(g["value"])
    assert set(shown) == board.active

    # Each shown clue is the true one, read off the recorded solution by hand.
    for key, clue in shown.items():
        cells = lines[key]
        target = (cells[0][0] if key[0] in "LR" else cells[0][1]) + 1
        total = 0
        for r, c in cells:
            total += board.grid[r][c]
            if board.grid[r][c] == target:
                break
        assert clue == total, (key, clue, total)
    return board


# Every committed board: (link, gen JSON, size, box).
BOARDS = [
    ("PUZZLE_LINK.txt", "gen.json", 9, (3, 3)),
    ("PUZZLE_LINK_4x4.txt", "gen_4x4.json", 4, (2, 2)),
    ("PUZZLE_LINK_6x6.txt", "gen_6x6.json", 6, (2, 3)),
]


def test_every_committed_board_is_unique_and_rebuilds_without_a_search():
    assert sorted(f.name for f in HERE.glob("PUZZLE_LINK*.txt")) == sorted(
        link for link, *_ in BOARDS
    )
    for link_name, gen_name, n, box in BOARDS:
        assert board_files(SPEC, n, local=True) == (HERE / link_name, HERE / gen_name)
        board = shipped_board_matches_its_link(link_name, gen_name)
        assert board.n == n and board.box == box, link_name
        assert unique(add_up_to_n, board) is True, link_name
        # And not by accident: with no clue shown the givens alone do not pin it.
        assert unique(add_up_to_n, replace(board, active=set())) is False, link_name
        link = (HERE / link_name).read_text()
        assert rebuild(SPEC, n, local=True) + "\n" == link, (
            f"{link_name} is not what --rebuild makes of {gen_name}: regenerate "
            f"it with `build_size.py --rebuild {n} --local`"
        )


def test_component_swap_changes_only_that_component():
    with tempfile.TemporaryDirectory() as tmp:
        out = pathlib.Path(tmp) / "candidate.txt"
        build(HERE / "UpToNComponent.js", out)
        base = decode_puzzle((HERE / "PUZZLE_LINK.txt").read_text().strip())
        cand = decode_puzzle(out.read_text().strip())
        assert blanked(cand, CONSTRAINT_NAME) == blanked(base, CONSTRAINT_NAME)


def test_spec_is_a_no_ring_spec():
    assert SPEC.groups_fn is not None
    assert SPEC.rules_prefix == "Normal sudoku rules apply. "
    assert SPEC.bent_lines is False, "a marker names a straight row or column"


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            fn()
            print(f"ok {name}")
    print("PASS")
