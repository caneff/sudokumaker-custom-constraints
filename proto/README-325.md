# Quad Rank uniqueness check (#325)

Answers the ticket: is CP-SAT affordable as the uniqueness checker for a 9x9
quad-rank puzzle, and does a unique puzzle exist at a shippable clue count?

**Answer: yes on both.** Strategy B holds at 64 windows.

## Run it

    node proto/dump_grids.mjs 9 6 11 > /tmp/g.json    # grids + oracle ranks
    uv run --with ortools proto/qr_cpsat.py           # self-check vs the oracle
    uv run --with ortools proto/qr_probe.py sweep /tmp/g.json 60
    uv run --with ortools proto/qr_probe.py minim /tmp/g.json 120

`dump_grids.mjs` emits every rank from `quadrank-lib.mjs`, so the oracle stays
the single definition and the Python model is only ever checked against it.

## The encoding

A window's value is the linear expression `1000*TL + 100*TR + 10*BL + BR`.
SQL RANK is "1 + how many windows are strictly smaller", so a clued window `w`
with rank `R` gets 63 reified booleans `lt[u] <=> V[u] < V[w]` and one equality
`sum(lt) == R - 1`. Ties fall out for free -- two equal windows each count zero
for the other, so they share a rank and the ranks after them are skipped.
Nothing treats ranks as all-different or as a permutation of 1..64.

The leading-digit bound (#324) rides along as a redundant `allowed_assignments`
on each clued top-left. It is implied by the rank equality, so it is free
soundness-wise and helps propagation.

Pure satisfaction, no objective (#323: an objective model was ~200x worse at
proving infeasibility). `interleave_search` on, so wall times reproduce.

## Uniqueness is one infeasibility proof

Strategy B never searches for a witness -- the oracle hands us the grid. So
`unique()` asserts the clues, the givens, and "differ from this grid in at
least one cell", and asks CP-SAT to prove that infeasible.

## Timing sweep

6 random 9x9 grids, clues and givens placed at random, 60s budget. No timeouts
anywhere.

| clues | givens | unique | median s | max s |
|------:|-------:|-------:|---------:|------:|
| 4 | 0 | 0/6 | 1.23 | 1.35 |
| 4 | 8 | 0/6 | 1.13 | 1.47 |
| 4 | 16 | 0/6 | 0.41 | 0.71 |
| 4 | 24 | 0/6 | 0.10 | 0.27 |
| 8 | 0 | 0/6 | 1.66 | 2.01 |
| 8 | 8 | 0/6 | 1.52 | 1.68 |
| 8 | 16 | 4/6 | 0.75 | 1.44 |
| 8 | 24 | 5/6 | 0.03 | 0.05 |
| 16 | 0 | 6/6 | 13.00 | 24.24 |
| 16 | 8 | 6/6 | 0.58 | 0.77 |
| 16 | 16 | 6/6 | 0.06 | 0.07 |
| 16 | 24 | 6/6 | 0.03 | 0.04 |
| 32 | 0 | 6/6 | 0.04 | 0.05 |
| 32 | 8 | 6/6 | 0.03 | 0.05 |
| 64 | any | 6/6 | 0.01 | 0.01 |

The expensive cell is the interesting one: 16 clues with no givens costs 13s
median. Eight digit givens cut that 20x. Givens are the lever #323 predicted.

## Minimal clue sets

Full strategy-B pass: start from all 64 clues, shuffle, drop each clue that the
puzzle survives without. 65 uniqueness checks per row.

| grid | givens | clues left | total s | max s |
|-----:|-------:|-----------:|--------:|------:|
| 0 | 0 | 14 | 301.0 | 78.53 |
| 0 | 8 | 12 | 36.5 | 3.14 |
| 0 | 16 | 6 | 6.5 | 1.03 |
| 1 | 0 | 13 | 68.2 | 12.64 |
| 1 | 8 | 10 | 23.2 | 1.61 |
| 1 | 16 | 6 | 3.6 | 0.50 |
| 2 | 0 | 15 | 64.6 | 16.67 |
| 2 | 8 | 10 | 20.8 | 2.36 |
| 2 | 16 | 7 | 4.8 | 0.87 |

These are greedy-minimal for one random drop order, not the global minimum --
a different order lands elsewhere, which is exactly the search #328 wants.

## Caveats

- Two rows breached the 60s sweep budget's spirit: the `0 givens` minimization
  hit a 78.5s single check. Budget 120s+ for zero-given work.
- Every number here is one machine, `num_workers=8`.
- Random clue placement, not chosen clues. A hunt that picks clues well will
  do better than these counts; #328 owns that.
