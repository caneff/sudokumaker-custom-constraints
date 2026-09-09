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

## The answer: they exist

Every negative above is per-grid, on sampled grids. The joint model --
`tools/prove_pair.py`, digits and shading searched together with one geometry
pinned -- settles it, and the answer is yes.

Four grids so far, each verified from the rules by `renbanana_verify` and
re-verified from disk by `renbanana_cpsat.py verify`, held in
`candidates-two-circles/`.

The hardest of them is a **pair of circled 2x2s** -- the most forcing
configuration in the space, since a 2x2 admits a circle at only 5 of 9 box
offsets against 7 for a 2x3 and 9 for a 2x4:

```
315829476   bbbbbCCbC      2x2  circle at r1c7 holding 4
276541983   CbbCbCCbb      2x2  circle at r3c2 holding 4
849736125   bCCbCbbbC
693284517   bCCbCbbCb
154397268   bbbbbCCbb
728165349   CCCCCbbbC
561473892   bbbbbCCbC
932618754   CbbCCbbCb
487952631   CbCbbbbbb
```

And two of the 2x2-plus-2x3 grids:

```
679413285   bbCCbbCbb      2x2  circle at r1c4 holding 4
513928476   CbCCbCbbb      2x3  circle at r4c4 holding 6
842576931   bbbbCbCbC
981652347   bCCCbbbCb
327194568   bCCCbbCbb
456837129   CbbbCbbCb
134765892   bbbCbCbCb
798241653   bbCbbbCbb
265389714   bCbbbbbCb
```

```
179245863   CbCCbbbCb      2x2  circle at r2c3 holding 4
584936721   bbCCbbCbb      2x3  circle at r7c7 holding 6
632718594   bCbbbCbCb
461892375   CbCCbCbbC
825173946   bbbbCbCbb
793654218   bbbCbbbCb
947581632   CbCbCCCbC
356427189   bCbbCCCbC
218369457   bbCCbbbbb
```

Two days of walking produced none of these. What the walk could not do was
demand the property; it could only wander and hope. The joint model demands it.

## What made the joint model work

The first version could not decide anything: on 40 geometries at 120 seconds it
returned 3 infeasible, 20 unknown, and a median of **31 lazy cuts** per
geometry. Four changes, three of them catalogue reads:

1. **Rule 4 exactly, up front.** Every cut was costing a full joint solve, and
   the loop was the bottleneck. But the rule is finite -- a 9x9 holds 45 * 45 =
   2025 rectangle placements and forbidding each as a maximal banana group is
   one clause -- so the loop goes away entirely.
2. **Per-cell digit domains for the pinned rectangles**, from `support_at`.
   The solver was rediscovering the catalogue's enumeration on every geometry.
3. **Dead chocolate placements forbidden**, from `fillings_at`. The solver was
   free to propose a maximal 4x5, or a 3x3 at box offset (0,0) -- shapes that
   appear in no grid anywhere.
4. **The fives lemma stated on digits.** No chocolate cell with a chocolate
   neighbour holds a 5, since the neighbour would need to be <= 0 or >= 10.
   Stage 1 can only assert that *some* legal placement of the nine 5s exists,
   having no digits to point at; here they are present.

Same 40 geometries, same 120 second budget:

| | before | after |
| --- | --- | --- |
| hits | 0 | **5** |
| median cuts | 31 | **0** |
| infeasible | 3 | 3 |

## The label hole, which is NOT closed

Three of those first five hits were illegal, each tripping rule 6. The cause is
in the component-label encoding that stage 1, `probe_inverted` and `prove_pair`
all share: a label is pinned to be *at most* its component's least cell index,
never equal to it. Two disjoint components can therefore both claim a label
below both their minimums, and renban lands on their union -- a gap in one
component plugged by a digit from the other. That is how a banana group holding
1, 4 and 8 once came back "legal".

One clause was added toward closing it: whoever uses label `ell` must share it
with the cell whose index *is* `ell`. **It is not sufficient**, and the measured
result says so plainly. The owner cell lies in one component, so that
component satisfies the clause -- and a second, disconnected component then
rides along on the same label for free. Label propagation runs only from lower
index to higher, so nothing forces the label constant on a component either.

| same 40 geometries, 120s | hits | legal | illegal |
| --- | --- | --- | --- |
| before the clause | 5 | 2 | 3 |
| after the clause | 17 | 1 | 16 |

Closing it properly needs real connectivity -- "this cell reaches the owner cell
through banana cells all carrying this label" -- which CP-SAT has no cheap way
to state. That is a piece of work, not a clause, and it is not done.

The clause was kept: the soundness gate holds at 28 of 28, so it rules no legal
grid out, and it made the search markedly faster (20 unknown against 32).

### Which way the hole cuts, and why the results survive

It lets illegal shadings *through*; it never rules a legal one out, because the
solver can always give each component its own least index. So:

- **Every INFEASIBLE is still a proof.** The pool sweep, the 30,140 sampled
  grids and the 826 digit-impossible geometries all stand unchanged.
- **Every hit must go through `renbanana_verify` before it counts.** That is
  how the real grids were sorted from the candidates, and it is not optional.

## Still open

32 of the 40 geometries return unknown at 120 seconds, so the full count is not
in: how many of the 2,482 geometries a sudoku can carry admit a legal grid is
the open question. It is now a hunt with known yield rather than a search for
something that may not exist.
