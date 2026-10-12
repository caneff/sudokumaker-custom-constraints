"""One end-to-end test for the repo split (#748).

What this repo owes after the split, driven in the order an agent meets it:

  1. a committed link is read, decoded and re-encoded through the sudoku-kit
     library, and the library refuses to encode a document that would not
     decode back;
  2. a board is modelled and proved through the library: a 4x4 with one
     solution is unique, and a solve that runs out of time is a timeout --
     raised by `solve_unique`, reported as `timeout` by the uniqueness
     check -- never unique and never infeasible;
  3. nothing the cut moved to `caneff/grid-hunts` is left in the tree, and
     there is no `finders/`;
  4. the seam runs lint and suites under examples/ and nothing else;
  5. AGENTS.md states the worktree rule, points at `caneff/grid-hunts`, and
     no longer carries the machine-load rule.

WHAT A GREEN RUN DOES NOT COVER (this seam is blind to it):
  - the app: solve time (`just time`) and how a link renders and solves in
    sudokumaker.app. No link's bytes are meant to change in this spec, and
    nothing here opens one.
  - `caneff/grid-hunts`: whether a fresh clone passes its own gate after
    `uv sync` with no `~/src` sibling checkout. Step 3 proves the files left
    this repo, not that they work there.
  - `caneff/sudoku-kit`'s own gate. Steps 1 and 2 use the library at the
    pinned tag; its five statuses and its refusal cases are tested there.
  - the state outside any tree: which repo each issue sits in, the load rule
    in the global instructions, and gridfind archived. Each is read back with
    `gh` and `rg` and cited on the spec.

Left to their own suites, not driven here: the pin and the no-local-copy
checks (sudoku_kit_source.test.py), the gate wiring (gate.test.py) and the
recipe closure (recipe_discovery.test.py).

    uv run examples/_shared/spec_748_closing.test.py
"""

import pathlib
import sys

from sudoku_kit.cpsat import solve_unique, sudoku_model
from sudoku_kit.link_codec import decode_puzzle, encode_link, read_link
from sudoku_kit.uniqueness import check_uniqueness

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent.parent
sys.path.insert(0, str(HERE))

from gate_lib import runner_listing

MOVED = ROOT / "docs/research/2026-10-11-grid-hunts-cut/moved-files.tsv"

GRID_4X4 = [[1, 2, 3, 4], [3, 4, 1, 2], [2, 1, 4, 3], [4, 3, 2, 1]]

# A board far too large to settle in the time given: the forced timeout.
TIMEOUT_SIZE, TIMEOUT_BOX, TIMEOUT_LIMIT = 36, (6, 6), 0.01


def a_link_goes_through_the_library():
    doc = decode_puzzle(read_link(ROOT / "examples/house-gac/PUZZLE_LINK.txt"))
    assert doc["puzzle"]["constraints"], "the committed link decodes to a board"
    assert decode_puzzle(encode_link(doc)) == doc, "a committed link's round trip"

    try:
        encode_link({"puzzle": {1: "a key JSON cannot carry"}})
    except ValueError:
        pass
    else:
        raise AssertionError("encode_link returned a link that does not decode back")


def given_model(grid):
    m, x = sudoku_model(4, (2, 2))
    for r, row in enumerate(grid):
        for c, digit in enumerate(row):
            m.Add(x[r, c] == digit)
    return m, x


def a_board_is_proved_through_the_library():
    first, unique = solve_unique(*given_model(GRID_4X4), limit=10)
    assert unique and [[first[r, c] for c in range(4)] for r in range(4)] == GRID_4X4

    m, x = given_model(GRID_4X4)
    assert check_uniqueness(m, x.values()).status == "unique"
    m, x = sudoku_model(4, (2, 2))
    assert check_uniqueness(m, x.values()).status == "not_unique"

    m, x = sudoku_model(TIMEOUT_SIZE, TIMEOUT_BOX)
    result = check_uniqueness(m, x.values(), time_limit=TIMEOUT_LIMIT)
    assert result.status == "timeout" and not result.unique, result.status
    try:
        solve_unique(m, x, limit=TIMEOUT_LIMIT)
    except TimeoutError:
        pass
    else:
        raise AssertionError("solve_unique returned a verdict from a timed-out solve")


def nothing_the_cut_moved_is_left():
    moved = [line.split("\t")[0] for line in MOVED.read_text().splitlines()]
    assert len(moved) > 1000, f"the cut record names {len(moved)} paths"
    left = [p for p in moved if (ROOT / p).exists()]
    assert not left, f"paths the cut moved are back in the tree: {left[:5]}"
    assert not (ROOT / "finders").exists(), "finders/ is back"


# The two lint steps that name no directory: StandardJS takes its file set from
# package.json, and the lock check reads pyproject.toml.
WHOLE_REPO_LINT = {"npx standard", "uv lock --check"}


def the_seam_runs_examples_only():
    listed = runner_listing()
    assert len(listed) > 50, f"the seam lists {len(listed)} suites"
    stray = [
        command
        for command in listed
        if command not in WHOLE_REPO_LINT
        and command.split()[-1].split("/")[0] != "examples"
    ]
    assert not stray, f"the seam runs a suite outside examples/: {stray}"


def agents_md_carries_the_split():
    text = (ROOT / "AGENTS.md").read_text()
    assert "## Always work in your own worktree" in text, "the worktree rule"
    assert "caneff/grid-hunts" in text, "the pointer to the finders' repo"
    assert "Solver runs stay off the machine's back" not in text, (
        "the machine-load rule is global now and is not restated here"
    )


if __name__ == "__main__":
    a_link_goes_through_the_library()
    a_board_is_proved_through_the_library()
    nothing_the_cut_moved_is_left()
    the_seam_runs_examples_only()
    agents_md_carries_the_split()
    print("spec_748_closing.test.py: ok")
