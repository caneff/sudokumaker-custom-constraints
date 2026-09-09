# Two circled rectangles: what stops them

Every hunt in #380 has been chasing a grid holding **two** chocolate rectangles
that each carry a circle — a group of `k` cells with a cell holding the digit
`k`. Nothing has ever produced one. This records what the obstruction actually
is, measured rather than guessed.

## The pool is smaller than its file count

`candidates*/cand_*.json` holds 78 files. All 78 pass `renbanana_verify.check`
from the rules, and 77 are distinct up to the dihedral-8 symmetry (the known
duplicate is `candidates/cand_07` == `candidates-only23/cand_03`). But by
shading they are not 77 independent grids:

| single-linkage threshold | families |
| --- | --- |
| 6 cells | 24 |
| 12 cells | **18** |
| 18 cells | 11 |

Two families hold 52 of the 78 grids, and 64 of 78 grids sit within five cells
of another grid. Treat the pool as roughly eighteen shading families with the
digits shuffled, not as a survey of the space. Any statement proved "over the
pool" is a statement about those eighteen.

## The geometry is not the obstruction

Straight off the #377 catalogue, with no solver:

| shape | placements | can carry a circle |
| --- | --- | --- |
| 2x2 | 64 | 28 |
| 2x3 | 56 | 38 |
| 3x2 | 56 | 38 |

Pairing the 28 with the 76 gives 2,128 combinations. 392 overlap and 376 touch
— touching is illegal because each rectangle must be a *maximal* chocolate
group, so a shared border cell would be chocolate in one and banana in the
other. **1,360 geometries survive.**

## Nor are the digits, at the level of the two rectangles

`tools/count_circled_pairs.py` asks, for each of those 1,360 geometries,
whether a solved sudoku exists in which both rectangles are internally
whisper-legal (every orthogonal pair inside differs by at least 5) and both
circles land — 4 somewhere in the 2x2, 6 somewhere in the 2x3, on cells the
catalogue allows.

**1,360 of 1,360 admit digits.** Layer B judges each rectangle alone; this
closes that gap by making the two share a real grid, and the pair survives it.

Those witness grids are *not* usable as candidates, and the control says why:
run them through the full shading model with the circle demand switched off
and they are still infeasible. They are near-random solved sudokus, and only
about 1 in 200 random grids admits any legal Renbanana shading at all. A sweep
over them measures that base rate, not the pair.

## The obstruction is the rest of the shading

`tools/probe_inverted.py --want-circled N` adds the demand to the full model:
one bool per catalogue-surviving circled placement meaning "this rectangle is a
maximal chocolate group here", every cell inside chocolate and every bordering
cell banana, and at least N of them chosen. Two chosen placements cannot
overlap — a shared cell would sit inside one and on the other's banana border —
so demanding two is already demanding two disjoint ones.

The gate, on a pool grid known to hold exactly one circled rectangle:

| | |
| --- | --- |
| `--want-circled 1` | feasible, 3.3s |
| `--want-circled 2` | infeasible, 0.1s |

Across the whole pool, 70 distinct digit-grids:

> **0 of 70 admit two circled rectangles. All 70 proved INFEASIBLE, 12 seconds
> for the lot.**

Not one was refused for lack of geometry — every grid offered between 8 and 20
candidate circled placements, and the solver ruled each out on the rules. So
what kills the pair is the banana side: with two rectangles pinned chocolate
and their borders pinned banana, the remaining cells cannot be partitioned into
groups that are all renbans and all non-rectangular.

## What this does and does not prove

It proves it for these eighteen families, in twelve seconds — against a night
of walking that proved nothing. It does **not** prove it for the space: the
pool is a clustered sample, and every grid in it was found by a search that
never had this constraint in it.

The next question is therefore joint: search digits and shading together with
`--want-circled 2` in the model from the start, rather than filtering grids
found without it. A prior attempt in the *forward* direction is on record and
failed — `candidates-circ2/stats.json`: 518 shadings built to carry the
property, 0 digit-feasible, 518 infeasible, 48 minutes. The joint model is a
different question and has not been asked.
