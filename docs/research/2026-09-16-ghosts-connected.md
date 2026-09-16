# Ghosts, all visible and orthogonally connected

Target: a grid whose ghosts are all visible (every ghost shows its
ghost-neighbour count as a given), those givens alone make the sudoku unique,
and the ghost cells form one orthogonally connected region. The 8-given
requirement is off for this hunt.

Prior state: 234 verified examples with no connectivity requirement
(`docs/research/ghosts/examples-verified.jsonl`, 25-33 ghosts). Zero of them
are connected, so they validate nothing about this target.

## The ceiling: 26 ghosts, proven

`finders/ghosts/joint.py --maximize` puts the digits, the ghost booleans, the
all-visible link and exact flow connectivity in one model and maximizes the
ghost count. **OPTIMAL at 26 ghosts in 50s.** No connected all-visible ghost
set of 27 or more exists on any grid.

That is the number that decides how hard this is. Against the 234
unconstrained examples:

| ghosts | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 |
|---|---|---|---|---|---|---|---|---|---|
| unique examples | 1 | 8 | 17 | 41 | 51 | 60 | 40 | 15 | 1 |

Only **9 of 234** sit at 26 or below. Connectivity confines the search to the
thin tail of the distribution where uniqueness is already rarest, and then adds
a constraint on top. Not proven impossible; the hardest corner of the space.

The first 26-ghost shape found had **2 solutions** — one short of the target,
which is why the band is worth enumerating rather than abandoning.

## Connectivity: flow beats lazy cuts here

Both encodings are in `finders/ghosts/connected.py` behind `--conn flow|lazy`.

| encoding | result |
|---|---|
| lazy flood-fill cuts | 2073 cuts in 120s, never returned a connected shape |
| single-commodity flow | connected shape in 77s |

Lazy cuts lose because each cut kills one component layout and the solver finds
another — the whack-a-mole failure the grid-finder lessons warn about, where a
cut has to kill a family to pay for itself. Flow is one encoding, solved once.
The earlier ruling to use lazy cuts was for the pinned-infeasibility question,
which is unaffected.

## Shape-only search cannot see solvability

`connected.py` returns connected shapes with admissible givens and **0 sudoku
solutions**: no grid completes them. The distinct-givens rule is necessary, not
sufficient. Any connected hunt has to hold the grid as a variable, which is
what `joint.py` does — every shape it returns is solvable by construction,
the grid being the witness.

## A sampler that only samples one grid (recorded so it is not rebuilt)

`finders/ghosts/gridfirst.py` fixes a solved grid, then solves for a ghost set
inside it. Sound idea, broken generator: `random_grid()` builds grids by
relabelling, in-band row moves, band and stack swaps and transposition of one
`BASE` grid. Those are exactly the sudoku-preserving symmetries, so every
"random grid" it produces is isomorphic to `BASE` — one equivalence class out
of 5.47 billion.

The ghost-count constraint is not invariant under those symmetries, so the
constraint does vary and the bug hides: 38,064 grids reported a maximum
connected ghost-set size of 9, with 37,576 admitting none at all. **Those
numbers are artefacts of one orbit and must not be quoted.** The joint model
proves the true ceiling is 26.

Lesson, general: a grid sampler built from the puzzle's own symmetry group
samples one orbit, not the space. Check a sampler by asking whether two of its
outputs are isomorphic, not whether they look different.

## What "all visible" buys, and why this is the easiest variant

All ghosts visible means the puzzle reduces to a plain sudoku whose givens are
the ghost digits. Any two solutions agree on every ghost cell, since those
digits are givens, so the ghost rule has the same truth value in all of them
and cannot separate a true solution from a false one. That is why
`count_solutions` is a plain bitmask sudoku solver with no ghost logic in it:
correct, not an oversight.

The reason visibility matters is sharper than "it supplies clues". **A ghost
marker only becomes a given digit if the ghost status of its entire 3x3
neighbourhood is known**, because the digit is that neighbourhood's ghost
count. Under the original rule, where some ghosts are hidden, a visible ghost
is a marker whose value the solver cannot compute -- not a given at all.

So all visible is the maximally clued variant, not the hardest: every ghost
carries a digit precisely because nothing is hidden. Scarcity of connected
unique examples is a real property of the target, not an artefact of choosing
a hard variant, and moving to the hidden-ghost rule would make it strictly
worse -- fewer clues, and the surviving clues stop being digits.

## Method, and why

Following the idiom that produced the 234 examples and the repo's other
working finders: CP-SAT states everything except uniqueness, and uniqueness is
decided outside it by the bounded bitmask counter. `finders/ghosts/jointharvest.py`
enumerates joint seeds by solve-then-forbid within a fixed ghost count and
counts solutions for each.

Note on reading its output: CP-SAT `UNKNOWN` is a timeout, not a proof that
the size band is exhausted. Only `INFEASIBLE` proves that.
