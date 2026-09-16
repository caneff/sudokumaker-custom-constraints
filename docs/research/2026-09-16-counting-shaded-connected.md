# Counting shaded, all visible and orthogonally connected

Target: a grid whose shaded cells are all visible (every shaded cell shows its
shaded-neighbour count as a given), those givens alone make the sudoku unique,
and the shaded cells form one orthogonally connected region. The 8-given
requirement is off for this hunt.

Prior state: 234 verified examples with no connectivity requirement
(`docs/research/counting_shaded/examples-verified.jsonl`, 25-33 shaded cells). Zero of them
are connected, so they validate nothing about this target.

## The ceiling: 26 shaded cells, proven

`finders/counting_shaded/joint.py --maximize` puts the digits, the shaded cell booleans, the
all-visible link and exact flow connectivity in one model and maximizes the
shaded cell count. **OPTIMAL at 26 shaded cells in 50s.** No connected all-visible shaded cell
set of 27 or more exists on any grid.

That is the number that decides how hard this is. Against the 234
unconstrained examples:

| shaded cells | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 |
|---|---|---|---|---|---|---|---|---|---|
| unique examples | 1 | 8 | 17 | 41 | 51 | 60 | 40 | 15 | 1 |

Only **9 of 234** sit at 26 or below. Connectivity confines the search to the
thin tail of the distribution where uniqueness is already rarest, and then adds
a constraint on top. Not proven impossible; the hardest corner of the space.

The first 26-cell shape found had **2 solutions** — one short of the target,
which is why the band is worth enumerating rather than abandoning.

## Connectivity: flow beats lazy cuts here

Both encodings are in `finders/counting_shaded/connected.py` behind `--conn flow|lazy`.

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

`finders/counting_shaded/gridfirst.py` fixes a solved grid, then solves for a shaded cell set
inside it. Sound idea, broken generator: `random_grid()` builds grids by
relabelling, in-band row moves, band and stack swaps and transposition of one
`BASE` grid. Those are exactly the sudoku-preserving symmetries, so every
"random grid" it produces is isomorphic to `BASE` — one equivalence class out
of 5.47 billion.

The shaded-count constraint is not invariant under those symmetries, so the
constraint does vary and the bug hides: 38,064 grids reported a maximum
connected shaded set size of 9, with 37,576 admitting none at all. **Those
numbers are artefacts of one orbit and must not be quoted.** The joint model
proves the true ceiling is 26.

Lesson, general: a grid sampler built from the puzzle's own symmetry group
samples one orbit, not the space. Check a sampler by asking whether two of its
outputs are isomorphic, not whether they look different.

## What "all visible" buys, and why this is the easiest variant

All shaded cells visible means the puzzle reduces to a plain sudoku whose givens are
the shaded cell digits. Any two solutions agree on every shaded cell cell, since those
digits are givens, so the shaded cell rule has the same truth value in all of them
and cannot separate a true solution from a false one. That is why
`count_solutions` is a plain bitmask sudoku solver with no shaded cell logic in it:
correct, not an oversight.

The reason visibility matters is sharper than "it supplies clues". **A shaded cell
marker only becomes a given digit if the shaded cell status of its entire 3x3
neighbourhood is known**, because the digit is that neighbourhood's shaded cell
count. Under the original rule, where some shaded cells are hidden, a visible shaded cell
is a marker whose value the solver cannot compute -- not a given at all.

So all visible is the maximally clued variant, not the hardest: every shaded cell
carries a digit precisely because nothing is hidden. Scarcity of connected
unique examples is a real property of the target, not an artefact of choosing
a hard variant, and moving to the hidden-shaded rule would make it strictly
worse -- fewer clues, and the surviving clues stop being digits.

## The size window: 17-21, closed on both sides by proof

Every shaded cell digit is a neighbour count, so it lies in 1-8 and **9 can never
appear on a shaded cell**. Combine that with a standard fact: a sudoku whose givens
omit two or more digits always has several solutions, because swapping the two
missing digits throughout any solution relabels it into another solution that
agrees with every given. So a unique puzzle needs at least 8 distinct given
digits -- and since 9 is unavailable, **all eight of 1-8 must appear**. No
slack.

That is cheap to post as a constraint (`joint.add_all_digits`) and it decides
the whole question. Asking the solver one size at a time, with symmetry
breaking on:

| shaded cells | all eight digits possible? | basis |
|---|---|---|
| <=16 | irrelevant | below the 17-given minimum (all-visible reduces to plain sudoku) |
| 17 | yes | witness, 5s |
| 18 | yes | witness, 23s |
| 19 | yes | witness, 6s |
| 20 | yes | witness, 21s |
| 21 | yes | witness, 13s |
| 22 | **no** | INFEASIBLE |
| 23 | **no** | INFEASIBLE |
| 24 | **no** | INFEASIBLE |
| 25 | **no** | INFEASIBLE |
| 26 | **no** | INFEASIBLE |
| >=27 | no configuration at all | INFEASIBLE, three encodings |

**A unique connected all-visible counting shaded puzzle has between 17 and 21 shaded cells, or
does not exist.** The wall at 22 is structural: a connected blob that large has
a high-count interior, so its digits crowd into 5-8 and the low counts vanish.
A big connected region and a 1 or 2 on it are incompatible.

This also closes the earlier hunt at 25-26 -- which the corpus had suggested was
the only viable band, itself an artefact of a generator floor. See the decision
log, entries 9 and 15.

## Symmetry

The symmetry group is the 8 dihedral images and nothing else: they preserve the
sudoku houses and both adjacencies, king for counting and orthogonal for
connectivity. Band and stack swaps preserve houses but scramble adjacency;
digit relabelling is not a symmetry because digits are counts.

`joint.add_symmetry_breaking` keeps only the lexicographically smallest image,
verified against explicit enumeration (`joint.py --check-symmetry`): 300/300
agreement, and 200/200 orbits keep exactly one representative, which is the
property that makes it lossless. **Never combine it with pinned cells** -- a pin
already fixes the orientation, so demanding canonical form on top forbids real
solutions. `build()` raises rather than allowing the combination.

Before it existed the corpus carried 29 symmetric duplicates in 197 rows.

## Pinned cells: r9c1 + r9c2

| | max shaded cells | digits | solutions |
|---|---|---|---|
| connected | 22 (proved) | 1-7, no 8 | 1000+ |
| connected, all digits required | 21 (proved) | 1-8 | 1000+ |
| not connected | **34** (proved) | 1-8 | **9** |

The unconnected 34 is the closest anything has come to unique. Connectivity
costs 12 shaded cells here, and at the maximum it also costs the digit 8, which alone
makes that configuration permanently non-unique.

Separately, r9c1+r9c2+r9c8 with r7c4 banned is infeasible outright -- no valid
grid at all, at any shaded cell count, connected or not. That is an existence result,
not a uniqueness one: `recheck_pins.py` posts only necessary conditions (counts
1-8, digits distinct within each house) and so is a relaxation of the real
problem, which makes its INFEASIBLE carry up to the real problem.

Re-asked 2026-09-16 under the shown-shading-only rules (`joint.build` with
`force`/`ban`, 4 workers, each answer in under 3 s). The ban is not what kills
it; the pair r9c1 + r9c8 already is, and only under connectivity:

| pins (all shaded) | connected | result |
|---|---|---|
| r9c1 r9c2 | yes | feasible |
| r9c1 r9c2 r9c8 | yes | INFEASIBLE |
| r9c1 r9c2 r9c8 | no | feasible, 23 shaded |
| r9c1 r9c2 r9c8, r7c4 unshaded | no | INFEASIBLE |
| r9c1 r9c8 | yes | INFEASIBLE |
| r9c2 r9c8 | yes | INFEASIBLE |
| r9c1 r9c5 | yes | feasible, 21 shaded |
| r9c1 r9c7 | yes | INFEASIBLE |
| r9c1 r9c9 | yes | INFEASIBLE |

A connected shading cannot hold two bottom-row cells six or more columns
apart. Not hand-proved; the solver's INFEASIBLE is the record.

## Method, and why

Following the idiom that produced the 234 examples and the repo's other
working finders: CP-SAT states everything except uniqueness, and uniqueness is
decided outside it by the bounded bitmask counter. `finders/counting_shaded/jointharvest.py`
enumerates joint seeds by solve-then-forbid within a fixed shaded cell count and
counts solutions for each.

Note on reading its output: CP-SAT `UNKNOWN` is a timeout, not a proof that
the size band is exhausted. Only `INFEASIBLE` proves that.
