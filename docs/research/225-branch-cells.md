# Research: ring-clue candidates and branch cells (#225)

Part of #222 (hit-counts 9x9 brute force closes fast). Question: what
candidates do the outer-ring clue cells start with on the shipped 9x9 board,
which cells does the app's "Find all solutions" search branch on, and which
ring clues never settle? Method copied from the skyscraper sibling, #121.

App build: v2026.08.14-d47fc4b. Board: `examples/hit-counts/PUZZLE_LINK.txt`
(11x11 grid: a 9x9 sudoku plus an outside-clue ring), loaded as shipped — 35
givens, no entered values, so the app must search. The board carries 36 clue
groups: 27 given clues and 9 blank clue cells.

## Method

1. **Starting candidates.** An instrumented copy of `HitCountsComponent.js`
   logs `puzzle.getCandidates(clue)` twice per instance: once at the top of
   `initialize`, and once on the instance's first `update` call. Swapped in
   with `build_link.py --component` (board and sibling components unchanged)
   and run headless through `examples/_shared/app-solve.mjs`, which relays
   browser console lines that start with `[probe]`.
2. **Ring branching.** A second, throttled log (every 200th `update` call
   across all instances) snapshots which of the 36 clue cells `hasValue`, and
   what value.
3. **Interior branching.** A third probe samples all 81 interior cells every
   500 calls and counts, per cell, assignments (`_` to a value) and retries
   (value to a different value) — the signature of a DFS branch variable.
4. **Depth.** A fourth probe logs, every 200 calls, how many interior cells are
   filled alongside the live value and candidate set of the two ring cells that
   move. A flip at a low fill count is a decision near the root; a flip at a
   high fill count is a deep consequence.

Every run used `app-solve.mjs` defaults: non-deterministic solve off, singles
only, the `ShowCandidates` icon, one rep, the driver's own 300 s limit. Scratch
probes and raw logs are per-session tmp and are not committed; the instrumented
components are reproducible from the steps above.

## Finding 1: ring clues start with 0..9, and lose only the 8

Every clue cell's `initialize` log reads:

```
[probe] init clue=11 hasValue=false cand=[0,1,2,3,4,5,6,7,8,9]
```

Ten candidates, not nine: the board sets `minDigit: 0` and `maxDigit: 9`,
because a hit count of 0 is legal. By each instance's first `update` call the
nine blank clues read:

```
[probe] first clue=11 min=0 max=9 hasValue=false cand=[0,1,2,3,4,5,6,7,9]
```

The only candidate gone is 8, dropped by `HitCountsComponent.initialize`'s
`n - 1` rule. `SideSumComponent` has not run yet at that point. The 27 given
clues report a single candidate throughout.

## Finding 2: seven of the nine blank clues settle at once and never move

The 200-call snapshot log covers 59,101 samples over 11.82 million `update`
calls. At the very first sample every one of the 36 clue cells already holds a
value, and seven of the nine blanks hold the value they keep for the whole run
— zero changes, and never once back to `_`:

| clue cell | index | settled value | changes in 59,101 samples |
| --- | --- | --- | --- |
| r0c7 | 7 | 1 | 0 |
| r1c10 | 21 | 0 | 0 |
| r3c10 | 43 | 0 | 0 |
| r5c10 | 65 | 0 | 0 |
| r7c10 | 87 | 0 | 0 |
| r9c10 | 109 | 0 | 0 |
| r10c7 | 117 | 1 | 0 |

`SideSumComponent` explains all seven from the givens alone. The right side's
four given clues (2, 2, 3, 2) already sum to 9, so its five blanks are forced
to 0. The top side's eight given clues sum to 8, so its one blank is 1; the
bottom side is the same. Only the left side is short: its seven given clues sum
to 7, so its two blanks must sum to 2 and neither is fixed.

## Finding 3: only two ring clues move, and they move once

The two left-side blanks, r1c0 (index 11) and r4c0 (index 44), are the only
clue cells whose value changes at all. Each changes exactly once in the whole
run:

```
calls=200        filled=7/81   c11=1(cand 1) c44=1(cand 1)
calls=10023400   filled=10/81  c11=2(cand 2) c44=0(cand 0)
```

Two facts from that pair of lines. First, both cells are pinned to a singleton
candidate set at both samples — they are never a live multi-valued domain
during the search. Second, the flip happens with only 10 of 81 interior cells
filled, so it sits near the root of the tree: the search backtracked almost to
the top, and the pair re-derived to a different pair summing to 2. The third
option (0, 2) was never reached before the 300 s limit. `gen_9x9.json` records
the true clues as `L0: 1` and `L3: 1`, so the correct pair is the first one the
search held.

This is the opposite of #121's skyscraper result. There the ring cells cycled
through several values with drops back to unresolved — the assign, propagate,
fail, undo, try-next signature of a branch variable. Here no ring cell ever
reads `_`, and no ring cell ever takes a third value.

## Finding 4: the DFS branches on interior cells in the left columns

The per-cell interior probe, after 12.5 million `update` calls, counted 83,831
assignments and 73,158 retries across the 81 interior cells. 76 of the 81 were
re-assigned at least once. The five that never moved are the four interior
givens (r2c3, r4c7, r7c3, r8c1) and r1c1, which propagation fixes at the root.

The heaviest cells:

| cell | assignments | retries |
| --- | --- | --- |
| r4c1 | 2868 | 5508 |
| r5c1 | 2616 | 5163 |
| r6c1 | 2998 | 4309 |
| r9c1 | 2589 | 3941 |
| r3c3 | 1721 | 4376 |
| r4c2 | 3237 | 3085 |
| r7c1 | 2157 | 3884 |
| r3c1 | 1236 | 4799 |

The churn concentrates in columns 1, 2 and 3 — the near end of every left-side
line. Those are the cells the search assigns and retries thousands of times.

The run never finished. The verdict was `[timeout]` at 300 s, and the deepest
sample reached 53 of 81 interior cells filled: in five minutes the app never
completed a single grid, let alone proved uniqueness.

## Recommendation

Do not spend a ticket on collapsing ring-clue domains. On this board the ring
is not where the search lives: 34 of the 36 clue cells hold one value from the
first 200 `update` calls to the last, and the remaining two are singletons at
every sample. A deduction that pinned r1c0 and r4c0 outright would remove one
near-root choice out of three and leave the interior work untouched.

The deduction worth prototyping is a **side-hit matching**, a side or frame
component that pushes the side's clue arithmetic into interior candidates.
Take the left side. The README already proves the side sum by regrouping hits
by column: for column j, digit j sits in column j exactly once, so exactly one
row hosts column j's hit. Turn that regrouping into a bipartite assignment
rather than a total. The 9 columns are one part, the 9 rows the other; row r
has capacity equal to its left clue; column j is eligible for row r while digit
j is still a candidate at cell (r, cj). Total capacity is exactly 9 for exactly
9 columns, so the assignment is tight and Hall's condition bites in both
directions: a column with too few eligible rows is a contradiction, a set of
columns whose eligible rows have exactly matching capacity forces every
placement inside it, and a column left with one eligible row forces digit j
into that cell.

Two reasons this is the right shape. It lands on the cells that actually cost
time — eligibility for column j is a statement about cell (r, cj), and the
churn in Finding 4 is columns 1, 2 and 3. And it supplies the one kind of
inference `HitCountsComponent` cannot make: its forward rule mostly *forbids*
hits, while the matching *forces* a hit into a specific cell. It also settles
Finding 3's pair as a side effect — if the columns still needing a host reduce
to two that only rows 1 and 4 can take, both clues pin to 1, which is the truth
on this board.

Caveat, from #222's own notes: #12's clue-bound matching was reverted in #18
for earning no app time. A matching that pays here has to prune interior
candidates, not just tighten clue bounds, and it must clear the two-row rule in
`docs/real-app-timing.md` like any other deduction. Measure it; do not assume
it.
