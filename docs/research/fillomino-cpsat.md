# #280: a CP-SAT model that proves a fillomino clue set unique

**Question.** How is a fillomino grid modelled in CP-SAT so a clue set can be
proved unique? `examples/isofill/verify.py` models a *fixed* partition — N
regions of N cells, one per digit. Fillomino has variable region sizes, an
unknown number of regions, per-region connectivity, and the separation rule.

**Answer.** A working prototype: `docs/research/fillomino_cpsat.py`. It samples
a full 9x9 grid in about 0.1–0.5 s and proves a minimal clue set unique in
0.5–18 s. It stays far inside the 600 s limit `unique()` uses.

This is research, not the shipped generator. It lives under `docs/research/`
and nothing in `examples/` imports it.

## The one idea that keeps the model small

Fillomino looks like it needs region objects: a set of regions, each with a
size, a membership, and a connectivity proof. It does not. The separation rule
("two distinct regions of the same size may not touch") makes the region
*derivable* from the digits alone:

> A region is exactly an orthogonally connected component of equal digits.

Two adjacent cells with the same digit are always in the same region — if they
were in different regions, those regions would have the same size and would
touch. So the whole rule set collapses to a single statement about every
connected component of equal digits:

> Its cell count equals the digit its cells hold.

No region count, no variables indexed by region, no separation constraint
written out. Everything follows from that one line.

## Decision variables

For an N x N board, `idx(r, c) = r * N + c`:

| Variable | Domain | Meaning |
| --- | --- | --- |
| `x[p]` | `1..N` | the digit in cell `p` — the only variable a solution is read from |
| `rid[p]` | `0..N*N-1` | `p`'s region id: the cell index of its region's root |
| `root[p]` | bool | `p` is its region's root, i.e. `rid[p] == idx(p)` |
| `eq[p,q]` | bool | one per undirected edge: `x[p] == x[q]` |
| `flow[p,q]` | `0..N-1` | one per *directed* edge: units moving `p -> q` |
| `emit[p]` | `0..N` | `x[p]` when `p` is a root, else 0 |

On a 9x9 that is 81 + 81 + 81 + 81 integer variables, 81 + 144 booleans, and
288 flow integers. Small.

## The constraints

**1. The root is the region's lowest cell index.**

```python
m.Add(rid[p] <= idx(p))
m.Add(rid[p] == idx(p)).OnlyEnforceIf(root[p])
m.Add(rid[p] < idx(p)).OnlyEnforceIf(root[p].Not())
```

`rid[p] <= idx(p)` does real work, not just symmetry breaking. Because `rid` is
constant across a region (constraint 2), the region's id is at most its smallest
cell index, and the only cell that can be its root is the cell with that index.
So each region has **exactly one** root, and there is no root-choice symmetry
for the solver to enumerate.

**2. Separation, in one line.**

```python
m.Add(x[p] == x[q]).OnlyEnforceIf(eq[p, q])
m.Add(x[p] != x[q]).OnlyEnforceIf(eq[p, q].Not())
m.Add(rid[p] == rid[q]).OnlyEnforceIf(eq[p, q])
```

Equal digits across an edge means one region. This *is* the separation rule:
two same-size regions that touched would be forced to share an id, and a shared
id means one region.

**3. Connectivity and digit-equals-size, both out of one flow.**

```python
m.Add(flow[p, q] <= (N - 1) * eq[p, q])   # flow crosses equal-digit edges only
m.Add(emit == x[p]).OnlyEnforceIf(root[p])
m.Add(emit == 0).OnlyEnforceIf(root[p].Not())
m.Add(inflow - outflow == 1 - emit)        # every cell absorbs one unit
```

Single-commodity flow, the same device `examples/isofill/verify.py` uses per
digit — but here there is one shared network and the root emits a *variable*
amount, its own digit, instead of a fixed N.

Sum the conservation equation over one connected component `C` of the
equal-digit graph. Every arc is internal, so the flow terms cancel and
`|C| = sum of emit over C`. Then:

- `C` with no root is infeasible: it would need `|C| = 0`.
- `C` cannot have two roots: all its cells share one `rid`, and only one cell
  has that index.
- So `C` has exactly one root and `|C| == x[root] ==` every digit in `C`.

That is digit-equals-size, for free, from the same constraint that enforces
connectivity. A cell cut off from its root starves — its component has no
emitter — so a split region is infeasible.

Region size never exceeds N because `x <= N` and size equals the digit. The
digit cap is the only thing bounding region size; nothing extra is written.

## Why flow, and not the alternatives

The ticket named three candidates. Flow won on all three counts here.

- **Flow to a root (chosen).** One shared network — 288 integer variables on a
  9x9 — and it delivers connectivity *and* digit-equals-size from one
  conservation equation. It is also the device the repo already runs and has
  debugged in ISOFILL, so the two models read the same way.
- **Reachability layers / spanning forest with parent pointers.** The grilops
  and cspuz encoding (`docs/research/connectivity-techniques.md` §1). It needs
  parent-direction booleans (5 per cell) *plus* a subtree-size variable, and it
  still needs `rid` on top: a spanning forest lets a size-6 equal-digit blob
  split into two trees of 3, which is precisely the separation violation the
  model must reject. Same variable count, one more moving part, and a
  wrong-by-default failure mode.
- **Lazy no-good cuts on a disconnected solution.** Rejected: it turns one solve
  into an unbounded loop of solves, and the loop is worst exactly where the
  answer matters — an under-clued board with many disconnected near-solutions.
  A 600 s budget on a single solve is easy to reason about; a budget spread
  across an unknown number of re-solves is not. Flow is cheap enough that the
  extra machinery buys nothing.

## The model is checked against brute force, not against itself

`self_check()` enumerates **every** valid grid two ways and asserts the sets are
equal: once from the CP-SAT model (solve, forbid that grid, repeat) and once
from `brute()`, a plain flood-fill reading of the rule with no solver in it.

- 2x2: both say **0 grids**. (Sanity: `1 2 / 2 1` fails — each 2 is alone but
  holds the digit 2.)
- 3x3: both say **38 grids**, and the same 38.
- 3x3: `unique()` agrees with brute force on three clue sets.
- 9x9: a sampled grid with all 81 cells given is unique, and an independent
  flood fill confirms every region's size equals its digit.
- A 1 ms cap raises `TimeoutError`; a timeout is never reported as unique.

## Measured runtimes (9x9, digits 1–9)

One run per seed, 8 workers, on the dev machine. `strip` is the greedy
minimal-clue reduction: it calls `unique()` 81 times, once per candidate
removal.

| Seed | sample | strip (81 proofs) | clues kept | prove unique | find a second solution |
| --- | --- | --- | --- | --- | --- |
| 3 | 0.10 s | 12.9 s | 36 | 0.29 s | — |
| 4 | 0.13 s | 37.9 s | 34 | 0.96 s | 6.61 s |
| 5 | 0.36 s | 22.9 s | 32 | 0.72 s | 0.90 s |
| 6 | 0.11 s | 79.4 s | 34 | 2.92 s | 5.08 s |
| 7 | 0.10 s | 12.6 s | 33 | 0.54 s | 0.54 s |
| 8 | 0.46 s | 267.8 s | 30 | **17.97 s** | 12.43 s |

"Find a second solution" drops one clue from the minimal set and times the
`not unique` verdict — the other half of `unique()`, and the half with no early
exit.

**Does it stay inside 600 s?** Yes, with two orders of magnitude of room. The
worst single 9x9 proof measured was 18.0 s, on the sparsest clue set (30 clues,
seed 8); the median is under 1 s. Cost tracks clue count, not seed: every proof
over 2 s came from a clue set of 30–34, and none approached the limit.

`strip` is the expensive call, not `unique` — 81 proofs in a row, up to 268 s.
That is a generator-side cost, run once, and it still fits one 600 s budget.

**Sampling diversity is the weak spot.** `randomize_search` moves the seed, but
seeds 1 and 2 return heavily striped grids (alternating 1/2 and 2/3 rows) that
tile a valid but dull board. Seed 3 onward look like real puzzles. A shipped
generator will want a diversity knob — a randomized objective, or a handful of
random cells pinned before the solve — rather than the raw seed.

## Running it

```
uv run --with ortools docs/research/fillomino_cpsat.py            # self-check
uv run --with ortools docs/research/fillomino_cpsat.py sample 7   # a full grid
uv run --with ortools docs/research/fillomino_cpsat.py strip 7    # + a clue set
uv run --with ortools docs/research/fillomino_cpsat.py gen.json   # prove unique
```

`sample` and `strip` print the `{"grid": [...], "clues": [...]}` shape ISOFILL's
`verify.py` prints, so the surrounding generator tooling transfers unchanged.
`set_board(n)` takes any board side; the digits are always `1..n`.

## What this does not answer

- **Fortress fillomino** (#277 stage two). The neighbour-ordering rule needs
  region-to-region comparisons. `rid` is already in the model, so the hook
  exists — a per-edge "different region" bool plus a local-max or local-min
  choice per region — but it is unmeasured.
- **The shipped generator's shape.** Whether generation runs `sample` + `strip`
  as ISOFILL does, or seeds from a clue pattern, is a separate ticket.
- **Rectangular and larger boards.** Only 9x9 was timed. Flow arcs grow with the
  cell count and the digit cap grows with the board side, so a 16-wide board is
  a real question, not an extrapolation.
