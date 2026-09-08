# Inverting the pipeline: fix the digits, solve for the shading

*Research notes for #380. Tools: `tools/probe_inverted.py`,
`tools/probe_which_rule_binds.py`, `tools/probe_neighbourhood.py`.*

## Why we tried it

The shading-first hunt wastes almost everything it does. Across every batch in
#380, roughly 2.7% of legal shadings admit any digit fill, and none of the
shading-layer constraints we added all session moved that number — requiring
both a circled 2x2 and a 2x3 cost essentially nothing (2.5% against a 2.7%
baseline). Measured end to end, a candidate costs 4,000–5,000 CPU-seconds.

Inverting the order would make every candidate digit-valid by construction. The
question this file answers is what the other direction costs.

## The inverted model is sharper, not weaker

Fixing the digits first tightens two rules that were previously expensive:

- **The whisper becomes a plain clause.** An orthogonal pair differing by less
  than 5 simply cannot both be chocolate. No search, no digit stage.
- **Renban stops being lazy.** Stage 1 already carries component labels for the
  banana size cap. With known digits, a label plus a digit value states both
  halves of renban exactly: at most one cell of each digit per label
  (distinctness), and no digit absent between two digits present in the same
  label (consecutiveness).

Only the banana-non-rectangle rule stays lazy, cut one pattern at a time. So an
INFEASIBLE from this model is a **proof**: that solved grid carries no legal
Renbanana shading at all.

`tools/test_probe_finds_known_grids.py` is the guard. The model finds a legal
shading for all 23 grids we had already verified, recovering the exact original
shading in 7 of them, in a couple of seconds each.

## Result 1: random solved grids are essentially never shadeable

200 random solved sudoku grids, one worker, 726 seconds:

| outcome | count |
| --- | --- |
| a legal shading exists | **0** |
| proved impossible | 200 |
| timed out | 0 |

Not one timeout — every verdict is a proof, at a median of 3.6 seconds. So the
uniform grid population is the wrong place to look, and the inversion does not
work as "sample a grid, shade it".

## Result 2: no single rule is the gate

The obvious suspect was the whisper, since it is the only rule that cares about
digit *values*. It is not, and steering grid generation toward more
whisper-legal adjacencies (the `--steer` flag) changed nothing: 0 of 6 at the
known-good mean of 49.

Dropping one rule at a time says why. On random grids, removing **any** of the
whisper, renban consecutiveness, or the banana-non-rectangle rule makes the
grid shadeable, usually in under a second:

| rule dropped | shadeable |
| --- | --- |
| nothing | 0/2 |
| whisper | 2/2 |
| renban consecutiveness | 2/2 |
| banana non-rectangle | 2/2 |
| renban distinctness | 0/2 |

Only the conjunction is rare. That is why one lever moved nothing, and it
predicts that any single-signal filter on grids will fail the same way.

Renban distinctness is the odd one out: dropping it does not help, even though
it also removes the group size cap that distinctness implies.

## Result 3: shadeability clusters, weakly but usefully

If shadeable grids were isolated points, local search would be dead too. They
are not. Taking each of the 23 known-good grids and applying **one** symmetry
move that actually changes the whisper structure — swapping two rows inside a
band, two columns inside a stack, or relabelling two digits:

| population | shadeable |
| --- | --- |
| uniform random | 0 / 200 |
| one move from a known-good grid | **2 / 69** (3%) |

Transposition and the `v -> 10 - v` relabel are excluded from the move set on
purpose: both preserve every absolute difference, so they carry a legal grid to
a legal one for free and would have flattered the number.

## What it costs

The comparison that decides the pipeline, in CPU-seconds per candidate:

| approach | cost per candidate |
| --- | --- |
| shading-first (current) | 4,000–5,000 |
| inverted, uniform grids | > 700 per 200 tries, still 0 found |
| inverted, one move off a known grid | **~175** |

Roughly 35 neighbours per hit at ~5 seconds each. That is a ~25x saving over
the current pipeline, with one risk not yet measured: a neighbour of a known
grid may only yield a shading close to its parent's, so the pool could be
cheap and inbred. Diversity has to be measured before this replaces anything.

## Verdict

Inverting the pipeline works, but not as first framed. Sampling grids is dead —
0 of 200, all proved. Seeding from grids we already have and walking is alive
and roughly 25x cheaper per candidate than the shading-first hunt. The next
question is whether its output is diverse or inbred.
