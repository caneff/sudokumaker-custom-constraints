# Build an ISOFILL board inside an interactive Skyscrapers ring.
#
# The interior is a 9x9 ISOFILL: nine regions of nine orthogonally connected
# cells, one digit per region, every digit 1-9 used. Around it, one clue per
# row and column end counts the buildings visible reading inward, ties hidden.
# The shared frame builder (`_shared/framebuild.py`) does the rest through its
# interior hook: the solution grid comes from the ISOFILL sampler and every
# uniqueness proof runs on the ISOFILL CP-SAT model (`_shared/isofill_model.py`,
# shared with examples/isofill), with the clue rule below posted on top.
#
#   uv run examples/isofill-skyscraper/build_size.py 9 3 3 [seed_count]
#   uv run examples/isofill-skyscraper/build_size.py --rebuild 9
#
# The box arguments are the builder's grammar only: this board declares no box
# regions, so 3 3 records a shape nothing reads. Writes PUZZLE_LINK.txt and
# gen.json next to this script. The global lane is the only lane: there is no
# local board (example.toml: lanes = "global").

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent.parent / "_shared"))
from framebuild import Spec, main
from isofill_model import Board, model, sample

HERE = pathlib.Path(__file__).parent
COMPONENTS = ["IsofillComponent.js", "SkyscraperOneSidedComponent.js"]
MIN_DIGIT = 1


def rule_text(n):
    return (
        f"ISOFILL: divide the inner grid into {n} regions, each with {n} "
        "orthogonally connected cells. Every cell in a region holds the same "
        f"digit, and all of the digits 1-{n} appear in the grid. "
        "Skyscrapers (interactive outside clues): each outside cell holds the "
        "number of buildings visible along its row or column, reading inward. "
        "A building is visible when it is strictly taller than every building "
        "before it: one the same height as the tallest so far is hidden. Blank "
        "outside cells are interactive: read them off the line as you solve."
    )


def visible(v, _cells, _box):
    """The clue for one line of digits, read inward: the buildings strictly
    taller than every building before them. A tie is hidden."""
    count = 0
    tallest = 0
    for d in v:
        if d > tallest:
            count += 1
            tallest = d
    return count


def add_visible(m, x, cells, kk, n, tag, _box):
    """`visible` as CP-SAT constraints: a running maximum along the line, and
    a cell visible exactly when it is greater than the maximum before it. The
    line may repeat a digit, and an equal digit is not greater, so a tie is
    hidden. One max and one boolean per cell, where a pairwise model posts one
    boolean per pair of cells."""
    tallest = x[cells[0]]
    seen = []
    for i, cell in enumerate(cells[1:], start=1):
        b = m.NewBoolVar(f"v{tag}_{i}")
        m.Add(x[cell] > tallest).OnlyEnforceIf(b)
        m.Add(x[cell] <= tallest).OnlyEnforceIf(b.Not())
        seen.append(b)
        if i < len(cells) - 1:
            after = m.NewIntVar(MIN_DIGIT, n + MIN_DIGIT - 1, f"t{tag}_{i}")
            m.AddMaxEquality(after, [tallest, x[cell]])
            tallest = after
    # the first building is always visible
    m.Add(1 + sum(seen) == kk)


def isofill_grid(rng, n, _bh, _bw):
    """A random n x n ISOFILL solution, rows of digits MIN_DIGIT..: the
    sampler draws it on the portfolio with a seed taken off `rng`. The
    portfolio's several workers race, so a seed does not reproduce its grid;
    gen.json records the grid, and a rebuild reads it from there."""
    rows = sample(Board.of(n, MIN_DIGIT), seed=rng.randrange(1, 2**31))
    return [[int(ch) for ch in row] for row in rows]


def isofill_interior(n, _box):
    return model(Board.of(n, MIN_DIGIT), {})


SPEC = Spec(
    dir=HERE,
    title="ISOFILL Skyscrapers",
    constraint_name="ISOFILL Skyscrapers",
    components=COMPONENTS,
    min_digit=MIN_DIGIT,
    clue_fn=visible,
    cp_sat_clue_fn=add_visible,
    comment_fn=rule_text,
    grid_fn=isofill_grid,
    model_fn=isofill_interior,
    box_regions=False,
    rowcol_houses=False,
    rules_prefix="",
    # An ISOFILL proof takes seconds, not milliseconds: a carve step is kept
    # only when it proves inside 3 s a solve, so the shipped board proves
    # with about 3x margin under framebuild's 10 s cap.
    carve_limit=3,
    # Spec #855 ruling 2: givens in the ring only, across every sampled
    # layout, before any interior given.
    ring_only=True,
)

if __name__ == "__main__":
    main(SPEC)
