# Framebuild carve cost: solve dominates, a C solver is not worth it (2026-10-03)

Ticket #473, step 1. Question: in `framebuild.generate`, is the carve's cost
model construction and solver startup, or the CP-SAT search itself?

**Verdict: the search. Model build is about 7% of `unique()`; the two solves
are about 93%. Step 2 (a C bitmask DFS) is not started, as the ticket says.**

## Measurement

One 9x9 skyscraper `generate` (`examples/skyscraper/build_size.py`, box 3x3,
seeds 101 up), `unique` replaced by a copy that times each phase with
`time.perf_counter`. Same model, same `cpsat.solver(SOLVE_LIMIT)`, same
`forbid`; the clock calls and counters are the only additions. Box load average was about 4 on a
32-core WSL machine. Reps: one per row, no repeats.

| seeds | wall | `unique()` calls | build | first solve | forbid | second solve | loop overhead |
|---|---|---|---|---|---|---|---|
| 3 (101-103) | 34.3 s | 174 | 2.10 s (6.1%) | 16.08 s (46.9%) | 0.12 s (0.3%) | 15.97 s (46.6%) | 0.04 s |
| 10 (101-110) | 85.9 s | 575 | 6.14 s (7.1%) | 39.87 s (46.4%) | 0.33 s (0.4%) | 39.39 s (45.9%) | 0.13 s |

Per call (10 seeds): build 10.7 ms, first solve 69.3 ms, second solve 68.5 ms.

- No first solve came back empty (the script counts those). It does not count
  a second solve that hit the 10 s cap, which `unique` turns into `None`; the
  per-call means (about 70 ms) leave no room for many such calls in the 10-seed
  row, but a 3-seed rerun with a counter added is the only direct check, and
  it found none.
- Calls per seed: about 54, not the ticket's 117 (`n^2 + 4n`). The 4n = 36
  ring-key pass and the final assert run once per `generate`, not per seed
  (about 37 calls in all). Each seed costs `1 + 2a` calls, `a` being the givens
  the add loop put in before the board went unique: 538 carve calls over 10
  seeds gives `a` of about 26 per seed, and 4 to 6 givens survive the removal
  pass. `a` is inferred from the call count, not measured directly.
- Most of those calls solve the full 36-clue board (about 538 of 575). The
  "20 shown clues" of the chosen board describes only the ring pass and the
  final assert.
- Extrapolated to the 40-seed default: about 5.5 to 5.7 min under this load
  (the `up-to-n` README says about 4 min for its own 9x9). Single runs, so the
  difference between the two is noise. The cost scales with seed count and is
  per-solve, not per-model.

## What follows

- Removing all model build (the best a C solver or a reused model could do on
  that axis) saves at most 7%. The CP-SAT solves are about 70 ms each at 9x9
  with 20 shown clues, not "milliseconds".
- A C bitmask DFS would replace the solves, not the build, so its payoff is a
  different question from the ticket's premise: it would have to beat about
  70 ms per proof at 9x9 with the Spec's clue check at the leaves. This
  measurement does not say whether it would; it only removes the stated
  reason for trying (build dominating). Not measured: `up-to-n` and the 4x4
  and 6x6 sizes, other ring-key counts, and a bitmask DFS of any kind.
- The `ortools-tuning.md` idea (one solve in place of "find any, then forbid
  it") does apply here. `generate` builds every clue and given from `grid`, so
  every board the carve checks already has `board.grid` as a known solution:
  `unique` can forbid `grid` and run one solve, skipping the first solve (about
  46% of wall time in the table). Not measured: the infeasibility proof that
  remains may be the costlier half, so the saving is up to 46%, not a given.
  The same grid also lets the removal pass ask `x[p] != v` for a single given.

## Reproduce

From the repo root:
`uv run python docs/research/2026-10-03-framebuild-carve-cost/measure_carve.py 9 3 3 10`.
It imports `examples/_shared/framebuild.py` and the skyscraper Spec and writes
nothing. Its `unique` is a copy of `framebuild.unique` as of base `9c703cf`
with clock calls added; if `unique` changes, re-check the copy before reusing
the numbers. It counts first-solve failures only, not second-solve timeouts.
