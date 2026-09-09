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

## Only four shapes can ever carry a circle

Straight off the #377 catalogue, no solver. A rectangle with both sides at
least 2 can hold its own size only if it is a **2x2, 2x3, 2x4 or 3x3** (plus
transposes). Every other living shape -- 2x5, 2x6, 2x7, 3x4, 3x5, 3x6, 4x4 --
is placeable and permanently uncircleable, so no hunt should ever aim at one.
1x5 is the same story on the thin side: alive at all nine box offsets, never
circleable, because the 5 it would need cannot sit beside another chocolate
cell (a difference of 5 or more puts one cell in {1,2,3,4} and the other in
{6,7,8,9}, and 5 belongs to neither).

How forcing each one is, as a clue, is also a catalogue read -- the count of
box offsets at which a circle fits at all:

| shape | offsets allowing a circle | placements |
| --- | --- | --- |
| **2x2** | 5 of 9 | 28 |
| **2x3** (and 3x2) | 7 of 9 | 38 each |
| 3x3 | 8 of 9 | 40 |
| 2x4 (and 4x2) | 9 of 9 | 48 each |

A 2x4 circle fits at every offset and so rules almost nothing out; a 2x2 is the
most constrained shape there is. That is why the hunt targets 2x2 and 2x3 and
leaves 2x4 and 3x3 alone.

## The geometry is not the obstruction

Pairs of circled rectangles drawn from 2x2, 2x3 and 3x2, disjoint and not
touching -- touching is out because each must be a *maximal* chocolate group,
so a shared border cell would be chocolate in one and banana in the other:

**3,308 geometries.** An earlier count of 1,360 was the mixed 2x2-against-2x3
slice only; it silently dropped every same-shape pair.

## The digits refuse some pairs outright

`tools/count_circled_pairs.py` asks, per geometry, for a solved sudoku in which
both rectangles are internally whisper-legal and both circles land. All 3,308
resolved, none timed out:

| pair | geometries | admit digits | proved impossible |
| --- | --- | --- | --- |
| 2x2 + 2x2 | 278 | 130 | **148** |
| 2x2 + 2x3 | 680 | 680 | 0 |
| 2x2 + 3x2 | 680 | 680 | 0 |
| 2x3 + 2x3 | 421 | 254 | **167** |
| 2x3 + 3x2 | 828 | 484 | **344** |
| 3x2 + 3x2 | 421 | 254 | **167** |
| **total** | **3,308** | **2,482** | **826** |

One pair type never fails: a 2x2 against a perpendicular 2x3 always admits
digits. Every impossibility is a same-shape or same-orientation pair, and a
quarter of the whole space dies here, before shading is considered at all.

## How many circled-rectangle layouts a sudoku can carry: 41,574

Geometry alone allows 422,438 non-empty sets of circled 2x2 / 2x3 placements --
disjoint, non-touching, at a box offset the catalogue permits a circle at --
peaking at 169,452 five-rectangle sets and topping out at 8, which is only ever
eight 2x2s in a lattice.

`tools/count_circled_sets.py` asks each set for a solved sudoku carrying every
rectangle in it, building levels in order and pruning: a set containing an
infeasible subset is infeasible, since it carries all of that subset's
constraints and more. Every level resolved, nothing timed out.

| rectangles | geometric sets | a sudoku can carry | share |
| --- | --- | --- | --- |
| 1 | 104 | 104 | 100% |
| 2 | 3,308 | 2,482 | 75% |
| 3 | 39,068 | 14,444 | 37% |
| 4 | 161,593 | 21,676 | 13% |
| 5 | 169,452 | 2,764 | 1.6% |
| 6 | 45,172 | 104 | 0.2% |
| 7 | 3,660 | **0** | -- |
| 8 | 81 | **0** | -- |
| **total** | **422,438** | **41,574** | **9.8%** |

**Six is the digit maximum**, against a geometric maximum of 8: the all-2x2
lattices die on digits, and no seven-rectangle layout survives. One of the 104
six-rectangle grids, verified cell by cell -- valid sudoku, every rectangle
internally whisper-legal, every circle landing, none overlapping or touching:

```
981623547     2x2 @ (4,5)  circle at r5c6 or r6c7
647195283     2x2 @ (7,2)  circle at r8c3
352847619     2x3 @ (7,5)  circle at r9c6
495238761     3x2 @ (0,2)  circle at r1c4
276514938     3x2 @ (1,7)  circle at r4c8
813769452     3x2 @ (4,0)  circle at r7c2
168472395
734951826
529386174
```

This is the sharpest statement of where the difficulty lives. **Digits will
carry six circled rectangles at once. The full shading will not carry two.**
Everything above the rectangles -- the banana groups being renbans, being
non-rectangular, the 2x2-window rule, maximality -- is what refuses, and it
refuses long before the digits do.

## And the shading refuses all of them

`tools/probe_inverted.py --want-circled N` adds the demand to the full model:
one bool per catalogue-surviving circled placement meaning "this rectangle is a
maximal chocolate group here", every cell inside chocolate and every bordering
cell banana, at least N chosen. Two chosen placements cannot overlap -- a shared
cell would sit inside one and on the other's banana border -- so demanding two
is already demanding two disjoint ones.

The gate, on a pool grid known to hold exactly one circled rectangle:

| | |
| --- | --- |
| `--want-circled 1` | feasible, 3.3s |
| `--want-circled 2` | infeasible, 0.1s |

Three runs, none of which found a single grid:

| run | grids | result |
| --- | --- | --- |
| the pool | 70 distinct digit-grids | **0 feasible**, all 70 proved, 12s |
| 2x2+2x3 geometries, fresh grids | 13,600 attempts | **0 feasible**, all proved, 655s |
| all 2x2/2x3 pairs, fresh grids | 16,540 attempts | **0 feasible**; 12,410 proved, 4,130 had no grid to shade |

The fresh grids are built *around* a pinned geometry and steered to at least 46
whisper-legal adjacencies, so the constraint was in the search from the start
rather than filtered in afterwards. `--want-circled 2` also accepts any two
circled rectangles, not only the pinned pair, so a grid could have satisfied it
some other way. None did.

The 4,130 "no grid" outcomes are not timeouts: a sample of 24 was retried at
120 seconds with the steer removed and all 24 still had no solved sudoku at
all. They are the 826 digit-impossible geometries showing up again.

## No single rule is the obstruction

`Shadings` can drop rules one at a time. With two circled rectangles demanded,
on 12 pool grids:

| rule dropped | result |
| --- | --- |
| none | 12 infeasible |
| whisper | 1 infeasible, 11 unknown at 20s |
| renban-distinct | 12 infeasible |
| renban-consecutive | 12 infeasible |
| non-rectangle | 12 infeasible |

The whisper row looked like a lemma and is not one. Dropping a rule removes
clauses, which makes infeasibility harder to *prove* as well as less true, so
UNKNOWN at 20 seconds proves nothing. Re-run at 300 seconds: **6 of 6
infeasible**. The whisper was making the proof short, not doing the refusing.

So each of the four rules, removed alone, leaves the pair impossible. Whatever
refuses two circles is a joint effect, and naming it is the open question.

## What this does and does not prove

Proved: no grid in the pool, and none of 30,140 sampled grids built for the
purpose, holds two circled rectangles of size 2x2 or 2x3. Proved outright: 826
of the 3,308 geometries admit no digits whatever.

Not proved: that no such grid exists. Every negative above is per-grid, and the
grids are sampled. A proof over the space needs digits and shading searched
together with the demand in the model -- the joint model, not yet built. A
prior attempt in the *forward* direction is on record and failed:
`candidates-circ2/stats.json`, 518 shadings built to carry the property, 0
digit-feasible, 48 minutes.
