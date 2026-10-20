# #851: a CP-SAT model that proves a fortress fillomino clue set unique

**Question.** Can the repo's CP-SAT fillomino model prove a **fortress
fillomino** clue set unique inside the 600 s limit on a 9x9 board, at digit caps
9 and 12?

**Answer.** Yes, on every seed swept: 7 seeds at each cap. The extended model
proved each stripped clue set unique in **2.4–73 s at cap 9** (median 46 s) and
**10–94 s at cap 12** (median 23 s). The other half of `unique()`, finding a
second solution once one clue is dropped, took 3–424 s. The 424 s run used 71% of
the limit; it is the slowest single solve recorded here. One run of the
model without the implied bounds (below) came back as a timeout in the sweep.
It did not reproduce: the same proof on the same reproducible one-worker
configuration then proved unique in 105 s. Fourteen seeds give no bound. They
show the limit holds on every proof measured, with as little as 1.4x headroom.

Everything here was run by `docs/research/fortress-fillomino-cpsat/fortress.py`.
It is a research script, not shipped code, and nothing imports it. The raw
sweep rows are in `docs/research/fortress-fillomino-cpsat/sweep-rows.jsonl`.

## What the rule forces

The fortress rule (`GLOSSARY.md`): every region is strictly larger than all its
orthogonal neighbour regions (a **peak**) or strictly smaller than all of them
(a **pit**). The plain fillomino rule still holds: a cell's digit is its
region's size, and equal-size regions may not touch.

- **Neighbouring regions are one peak and one pit, the peak the larger.** If A
  is a peak, A > B, so B cannot be larger than all its neighbours. B is
  therefore a pit, and the reverse case is symmetric. So the region adjacency
  graph is bipartite and peak/pit is its 2-colouring.
- **Every 1 is a pit.** A peak beats some neighbour, so it is at least 2.
- **Every cap-sized region is a peak.** A pit loses to some neighbour, so it is
  at most cap − 1.
- Every region on a 9x9 with cap ≤ 12 has a neighbour, so each region is
  exactly one of peak or pit, and the label is a function of the digits. The
  label adds no solutions that `solutions()` would count twice.
- Further consequences, not encoded: a 2-peak touches only 1s, and a
  (cap − 1)-pit touches only cap-regions.

## The encoding

`fortress_model(board, givens)` calls the repo's `model()` from
`examples/fillomino/generate.py` unchanged and adds one boolean `peak[p]` per
cell. Per undirected edge `(p, q)`:

```python
m.Add(x[p] == x[q]).OnlyEnforceIf([peak[p], peak[q]])              # same side:
m.Add(x[p] == x[q]).OnlyEnforceIf([peak[p].Not(), peak[q].Not()])  #   one region
m.Add(x[p] > x[q]).OnlyEnforceIf([peak[p], peak[q].Not()])         # peak > pit
m.Add(x[q] > x[p]).OnlyEnforceIf([peak[q], peak[p].Not()])
```

`peak` is constant on a region. Equal digits across an edge are one region in
the base model (its separation rule), and labels that differ force digits that
differ. So two cells with equal digits and different labels contradict the
`>` line. Per cell, the forced facts above become implied bounds:

```python
m.Add(x[p] >= 2).OnlyEnforceIf(peak[p])               # every 1 is a pit
m.Add(x[p] <= cap - 1).OnlyEnforceIf(peak[p].Not())   # every cap is a peak
```

The model adds 81 booleans and 576 half-reified edge constraints to the base
model's variables. It needs no region objects: the base model's `rid` and flow
are untouched. `#280`'s note suggested a per-edge "different region" bool. That
bool is `x[p] != x[q]` and needs no variable of its own.

The shipped `solutions()`, `unique()` and `sample()` run unchanged inside a
`fortress()` context manager. It points `generate.model` at the fortress model
and sets the sampling portfolio to one worker. The proofs use `unique()`'s own
reproducible configuration: one worker, seed 0, a 600 s limit per solve.

## Validation against a solver-free brute force

`fortress.py check` compares the model with `brute()`, a depth-first search
over digits that uses no solver. Its final test, `is_fortress()`, reads the rule
literally. It flood-fills equal-digit components, then checks size == digit and
that each component's neighbour digits are all above it or all below it. It
does not use the peak/pit 2-colouring that the model is built on. The search
prunes only states that fail in every completion: a component larger than its
digit; a closed component whose size is not its digit; a component with
assigned neighbours both above and below it.

**Whole solution sets:** every fortress grid, enumerated through the model
(solve, forbid, repeat), equals brute's set. Both the bare model and the model
with implied bounds were checked:

| Board | Cap | Fortress grids |
| --- | --- | --- |
| 2x2 | 2 | 0 |
| 3x3 | 3 | 2 |
| 3x3 | 5 | 63 |
| 4x4 | 4 | 28 |
| 4x4 | 6 | 554 |
| 5x5 | 5 | 2616 |

A first, cruder brute (full-board re-flood at each step, no neighbour-order
pruning) gave the same counts on 3x3 (both caps), 4x4 cap 4 and 4x4 cap 6. That
shows the pruning dropped no grid there.

**Random clue sets (seed 851):** `solutions()` and `unique()` agree with brute
on each one.

| Board | Cap | Clue sets | brute: unique / not |
| --- | --- | --- | --- |
| 4x4 | 4 | 40 | 24 / 16 |
| 5x5 | 5 | 40 | 21 / 19 |
| 5x5 | 7 | 20 (8–12 givens) | 13 / 7 |

On 5x5 cap 7, a clue set with more than 50 brute solutions is compared on the
verdict and on both model grids being in brute's set, not on the full set. The
first validation run listed every grid of a thinly clued 5x5 cap 7 set through
the forbid loop. Each forbidden grid makes the next solve dearer: 0.1 s at
grid 1 and 0.4 s by grid 300 on the unclued board. That run went 17 h and ended
on a 600 s timeout, which is no verdict. It is a cost of enumerating thousands
of grids, not of a uniqueness proof. Brute alone on the unclued 5x5 cap 7 board
did not finish in 300 s, so that board's clue sets start at 8 givens.

## How the timed instances were made

Per seed, on a 9x9 at the given cap:

1. **Sample** a fortress grid with the shipped `sample()` on the fortress model:
   4 random cells pinned, `randomize_search`, one worker, striped grids
   retried. At cap 12 one pin is forced above 9, so every cap-12 grid holds a
   digit above 9 (`max_digit` 12 on all seven).
2. **Strip greedily:** visit the 81 cells in a seeded random order and drop a
   given when `unique()` still proves the rest unique. Each strip proof had a
   **60 s** cap. A strip proof that timed out kept its clue. That is safe for
   uniqueness, but the final set may then not be minimal.
3. **Time** `unique()` on the stripped set at the full 600 s limit, with and
   without the implied bounds. Then drop one seeded-random given and time the
   `not unique` verdict.

Each seed ran as its own single-worker process, three at a time. The machine was
a shared WSL2 VM with 32 cores and a 1-minute load of about 1–2. OR-Tools
9.15.6755. Each figure is one run, wall clock.

## Timings (9x9, seconds)

| Cap | Seed | Clues | Strip timeouts (of 81) | Prove unique, implied | Prove unique, bare | Second solution |
| --- | --- | --- | --- | --- | --- | --- |
| 9 | 1 | 18 | 2 | 28.3 | 56.3 | 24.8 |
| 9 | 2 | 15 | 4 | 61.0 | 77.8 | 76.5 |
| 9 | 3 | 13 | 1 | 2.4 | 3.0 | 3.1 |
| 9 | 4 | 20 | 7 | 69.8 | 87.8 | 99.8 |
| 9 | 5 | 17 | 0 | 14.1 | 17.4 | 13.2 |
| 9 | 6 | 19 | 4 | 45.9 | 67.6 | **423.9** (rerun 371.9) |
| 9 | 7 | 22 | 6 | 73.0 | 60.7 | 24.3 |
| 12 | 1 | 15 | 0 | 22.9 | 18.3 | 9.3 |
| 12 | 2 | 12 | 1 | 10.2 | 10.0 | 9.2 |
| 12 | 3 | 15 | 1 | 16.2 | 17.8 | 34.9 |
| 12 | 4 | 12 | 1 | 21.1 | 15.1 | 29.9 |
| 12 | 5 | 14 | 0 | **94.1** | 58.0 | 28.9 |
| 12 | 6 | 14 | 4 | 38.9 | 39.7 | 192.9 |
| 12 | 7 | 14 | 3 | 59.4 (rerun 59.8) | timeout in sweep; rerun **105.3** unique | 151.4 |

### Summary, split by verdict

| Cap | Run | Proven unique | Proven not unique | Timed out | Median | Range |
| --- | --- | --- | --- | --- | --- | --- |
| 9 | prove, implied | 7 | 0 | 0 | 45.9 s | 2.4–73.0 s |
| 9 | prove, bare | 7 | 0 | 0 | 60.7 s | 3.0–87.8 s |
| 9 | second solution | 0 | 7 | 0 | 24.8 s | 3.1–423.9 s |
| 12 | prove, implied | 7 | 0 | 0 | 22.9 s | 10.2–94.1 s |
| 12 | prove, bare | 6 (+1 on rerun) | 0 | 1 in sweep | 18.1 s (the 6) | 10.0–58.0 s (the 6) |
| 12 | second solution | 0 | 7 | 0 | 29.9 s | 9.2–192.9 s |

**The one timeout.** In the sweep, the cap 12 seed 7 bare proof returned a
timeout after 6210 s of wall clock. `unique()` makes at most two solves of
600 s each, and the seed's process also ran under an outer `timeout 3600`. That
outer timeout did not fire: the process exited 0 2 h 8 min (7676 s, the row's own stage sum) after its slot
opened. So the process seems to have been stalled from outside for at least 83 (6210 − 2 × 600 s)
minutes, and CP-SAT's wall-clock deadline expired during the stall. The cause
was not found. The rerun on the same clue set and the same reproducible
configuration proved it unique in 105.3 s (wall and monotonic clocks agree).
The sweep result stays recorded as a timeout, which is no verdict. Treat it as
unexplained, not as evidence that the bare model exceeds 600 s.

**Strip proofs at 60 s.** 24 of 567 strip proofs at cap 9 and 10 of 567 at
cap 12 hit the 60 s strip cap. Each kept its clue. So single-removal proofs over
60 s are common, and a strip at the full 600 s cap would cost more wall clock
than the 4–25 min per seed measured here.

**Implied bounds.** With the bounds, the cap 9 proof was faster on 6 of 7 seeds
(median 46 s against 61 s). At cap 12 the bounds won on 3 of 7 seeds. Seed 5
went 94 s with them and 58 s without. Each figure is one run, so the cap 12
difference is inside the seed-to-seed noise. Keep the bounds: they are free and
help at cap 9.

**Sampling** a fortress grid on one worker took 118–1438 s (median 555 s). That
cost belongs to how these instances were made, not to the proof. It is slower
than plain fillomino's 0.1–1 s on eight workers (`fillomino-cpsat.md`).

## What this does not answer

- **A bound.** Fourteen seeds, one run each. The slowest solve used 71% of the
  600 s limit (cap 9 seed 6, second solution). That is too close to promise the
  limit on an unswept seed.
- **The sweep's stall.** Why one process sat for at least 83 minutes without its
  outer `timeout` firing was not diagnosed.
- **Minimal clue sets.** Strip proofs capped at 60 s kept their clues, so the
  timed sets are proven unique but not proven minimal. A minimal set might be
  harder to prove.
- **Clue sets made another way.** The app's own strip (`app-strip.mjs`), a
  hand-set clue pattern, and clues chosen to need the fortress rule were not
  timed.
- **Stronger implied constraints.** "A 2-peak touches only 1s" and the
  bipartite region graph's parity were not encoded or measured.
- **Rectangular or larger boards, and caps other than 9 and 12.**
- **The app.** Nothing here touches how SudokuMaker solves a fortress
  fillomino link (`just time`).
