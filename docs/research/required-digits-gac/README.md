# RequiredDigitsGacComponent

A full-strength, drop-in replacement for the app's built-in RequiredDigits
rule (`RequiredDigitsComponent(name, values, cells)`): Hall's condition on
the value side instead of the built-in's greedy strike-off (see
`RequiredDigitsGacComponent.js`'s own header for the rule and the soundness
argument).

## Files

| File | What it is |
|---|---|
| `RequiredDigitsGacComponent.js` | The replacement itself. |
| `BuiltinRequiredDigitsComponent.js` | The built-in's own rule, ported verbatim from the bundle body, for the offline strength/cost comparisons below. Not for use in a puzzle — the app already has this one. |
| `soundness-harness.mjs` | Soundness (28,000 states, 0 violations), strength against the built-in, and completeness against a brute-force SDR oracle. |
| `bench-required-digits.mjs` | Per-call cost against the built-in, 20,000 states per shape, 3 reps. |
| `RequiredDigitsWrapperComponent.js`, `RequiredDigitsWrapperComponentBuiltin.js`, `main-required-digits-global.js`, `PUZZLE_LINK_required_digits*.txt` | The real-app timing rig (#534), below. |

## Offline: soundness and cost

```
node docs/research/required-digits-gac/soundness-harness.mjs
node docs/research/required-digits-gac/bench-required-digits.mjs
```

Soundness: 28,000 states, 0 violations, exact agreement with a brute-force
SDR oracle on every instance small enough to check. Strength against the
built-in is widest where the group is sparse: 275 removals against 20 on 9
cells with 4 required digits. Cost: 0.2–0.6 us/call on outside-clue shapes
(1–2 required digits, a 2–3 cell window), 3.1 us against the built-in's 1.3
us on a full 9-cell group.

## Real-app timing (#534)

The offline cost row above is our own GAC+DFS mock, not the app's own
solver (`docs/real-app-timing.md`). Timing it there needs a board that
registers a RequiredDigits-shaped component — no example did.
`RequiredDigitsWrapperComponent.js` is the host: it watches an Outside Sudoku
clue, idling while it is blank, and once filled swaps itself
(`puzzle.replaceComponent`, docs/gotchas.md #1) for a required-digits rule
over the clue's window — window-sized with its own copy of
`examples/outside-sudoku/OutsideSudokuComponent.js`'s `windowLength`. Two
swap targets, same host shape otherwise:

- `RequiredDigitsWrapperComponent.js` → `customComponents.RequiredDigitsGacComponent`
- `RequiredDigitsWrapperComponentBuiltin.js` → the real built-in `RequiredDigitsComponent`

This is not a second implementation for Outside Sudoku itself —
`OutsideSudokuComponent.js` already enforces the same rule in three bitmask
reads and stays the shipped component; see
`examples/outside-sudoku/OPTIMIZATION_LOG.md`. It exists only to give
RequiredDigitsGacComponent a real-app timing row.

### Building the boards

```
uv run examples/outside-sudoku/build_required_digits.py
```

Takes the shipped `examples/outside-sudoku/PUZZLE_LINK.txt` and replaces its
"Custom Outside Sudoku" constraint's backend and components — nothing else
— writing, into this directory:

- `PUZZLE_LINK_required_digits.txt` — the wrapper, GAC as the swap target
- `PUZZLE_LINK_required_digits_original.txt` — the wrapper, the built-in as the swap target

`examples/outside-sudoku/build_required_digits.test.py` (part of `just
test`) checks the rebuild is byte-identical and leaves the shipped links
untouched. This script stays in `examples/outside-sudoku/`, not here, because
`docs/research/` refuses a new `.py` file (`check_research_python`, #469).
These two links stay in `docs/research/`, not as `examples/outside-sudoku/`'s
own boards, because they are not that example's board:
`examples/_shared/check_layout.py` requires a shipped component to be one
the backend itself registers, true of a real example and not of a board
built only to compare a wrapper's two swap targets (`RequiredDigitsGacComponent`
here is reachable only through the wrapper's own `customComponents.Name`,
never `new`'d by the backend).

### Reproduce

Not timed through `just time`'s automation
(`examples/_shared/time_example.py`): that driver resolves an example's
backend against `main.js`/`main-global.js` inside the example directory,
and `main-required-digits-global.js` deliberately matches neither name, so
it is never mistaken for the real Outside Sudoku backend. Timed directly,
the way Numbered Rooms' own wrapper-vs-ours row is (`docs/real-app-timing.md`,
"link vs link"):

```sh
uv run examples/_shared/probe_link.py empty \
  docs/research/required-digits-gac/PUZZLE_LINK_required_digits.txt /tmp/rd_gac.txt
uv run examples/_shared/probe_link.py empty \
  docs/research/required-digits-gac/PUZZLE_LINK_required_digits_original.txt /tmp/rd_orig.txt
node examples/_shared/app-solve.mjs /tmp/rd_gac.txt 3 --ring-clues
node examples/_shared/app-solve.mjs /tmp/rd_orig.txt 3 --ring-clues
node examples/_shared/app-solve.mjs /tmp/rd_gac.txt 3 --ring-clues --after-logical
node examples/_shared/app-solve.mjs /tmp/rd_orig.txt 3 --ring-clues --after-logical
```

### Recorded rows (2026-09-17, v2026.08.14-d47fc4b, 3 reps, non-deterministic solve off)

| date | app version | board | mode | baseline (built-in) | candidate (GAC) | ratio | row PASS/FAIL |
|---|---|---|---|---|---|---|---|
| 2026-09-17 | v2026.08.14-d47fc4b | required-digits | cold | 400ms | 400ms | 1.00 | FAIL |
| 2026-09-17 | v2026.08.14-d47fc4b | required-digits | after-logical | 300ms | 300ms | 1.00 | FAIL |

`two-row rule: NO SHIP` (`docs/real-app-timing.md`): neither row clears
0.9x, so this is not a "ships" result either way — read as "no cost
regression, and no proven win here" for RequiredDigitsGacComponent's
real-app cost on this board. The invariant the ticket exists for
("a deduction must pay for itself in solve time," `AGENTS.md`) is still
unmet: 1.00x/1.00x is a null result, not a pass, and this board cannot
settle it — 0.2–0.6 us/call on this exact clue-window shape (1–2 required
digits, a 2–3 cell window) is small enough that a board this shallow (and
already "closed almost without searching," per
`examples/outside-sudoku/OPTIMIZATION_LOG.md`'s own history for this
component) cannot surface it against a 100ms solver timer. Settling it for
real needs a board with a sparser, larger required-digits group — the shape
the offline bench already shows a real gap on (275 removals against 20 on a
9-cell group with 4 required digits) — which is a follow-up, not something
this ticket's Outside Sudoku board can be made to show.

**Confirmed the GAC swap actually fires, not just parses.** A wrapper
sibling-class typo (docs/gotchas.md #1) fails silently in the UI — the
component just stops pruning — so a dead swap could in principle produce
exactly this same "identical numbers" result for the wrong reason.
Checked directly: pointed the GAC wrapper at a nonexistent
`customComponents.NopeTypoComponent` and captured the browser console during
a solve — the app threw `TypeError: ... is not a constructor` on every
`update` call, confirming the console listener catches a dead swap. Reverted
and re-ran against the real, committed `RequiredDigitsWrapperComponent.js`:
zero console errors or page errors during the same solve. The GAC target
resolves and runs.

**Caveat, checked against the unmodified board.** Both rows' per-rep verdict
reads "Found 10,000 solutions" (the app's counting cap), not "unique
solution" — `probe_link.py empty` keeps every ring cell (given or not), which
should be enough information to pin the grid down, per
`examples/outside-sudoku/build_size.py`'s own uniqueness check on the
committed board. Confirmed this is not something this wrapper introduced:
the unmodified shipped `examples/outside-sudoku/PUZZLE_LINK.txt`, put through
the identical `probe_link.py empty` + `app-solve.mjs --ring-clues` steps,
reads the same "Found 10,000 solutions" verdict, at the same ~500ms — the
number `just time outside-sudoku --ring-clues`'s own BASELINE row already
carries (README, `## Timing`), which does not itself surface the verdict
text (only the median). Both the GAC and built-in wrapper variants reach the
same search cap the unmodified board already does under this probe, so the
comparison is still apples-to-apples; it is a property of the probe/board
combination, not of either RequiredDigits variant.

This is a doc-vs-code contradiction worth naming rather than picking a side
on: `docs/real-app-timing.md` (lines ~293–294) says a `[not-unique]` verdict
"carries null times." The code disagrees on purpose —
`examples/_shared/app-solve-lib.test.mjs` asserts "a not-unique verdict
still reports both times," and every row above is real medians from exactly
that path. Both `just time outside-sudoku`'s own established README row and
this one rely on the code's behavior, not the doc's. Worth its own follow-up
ticket — fix the doc line, and decide whether `time_example.py` should
refuse a non-unique probe the way it already refuses a timeout — rather
than ruled on here.

## Sparse board timing (#541)

The Outside Sudoku wrapper board above could not settle the invariant: its
groups are 2-3 cells. This board is built for the shape the offline bench
favours (a sparse, large group) and searches deeply enough to read.

`sparse/` holds it: `gen.json` (solution grid, 10 givens, and the generated
table of 20 groups), `main-sparse-global.js` (the backend, which registers
each group's component directly -- no wrapper), and the two links.

- **Groups**: 20 orthogonally connected 9-cell snakes across at least three
  boxes, none a house (a house already requires all nine digits), overlapping
  freely, each requiring 5 digits its own cells hold in the solution. The
  required sets come from the table, not from clue cells.
- **Rule**: each listed digit occurs in at least one cell of its group (the
  group is not all-different). `model()` in the build script is the CP-SAT
  side, `RequiredDigitsGacComponent.js` the JS side.
- **Uniqueness**: CP-SAT proves the 10 givens unique
  (`build_sparse_required_digits.test.py`, part of `just test`); the app's own
  verdict on both links is "unique solution".
- **Depth**: givens carved greedily in seeded order until none can go. 20
  groups at 5 digits left 10 givens and a built-in median of 2.4s; 24 and 30
  groups left 2-6 givens and the built-in timed out (DNF), so they are too
  deep to time. 6 and 12 groups at 4 digits closed in 0ms.
- **Two links, one board**: `PUZZLE_LINK_sparse_original.txt` registers the
  built-in `RequiredDigitsComponent`; `PUZZLE_LINK_sparse.txt` registers
  `RequiredDigitsGacComponent`. Same board and table; the backend differs in
  that one identifier, and the candidate link also ships the component code.

```
uv run examples/outside-sudoku/build_sparse_required_digits.py   # rebuild both links
D=docs/research/required-digits-gac/sparse
uv run examples/_shared/probe_link.py strip $D/PUZZLE_LINK_sparse.txt cand.txt
uv run examples/_shared/probe_link.py strip $D/PUZZLE_LINK_sparse_original.txt base.txt
node examples/_shared/app-solve.mjs base.txt 1 [--after-logical]   # then cand.txt, alternating
```

The committed `gen.json` was drawn with `--search 2 --groups 20 --required 5`
(overlap is the default). Its grid comes from CP-SAT's portfolio search,
which is not reproducible from the seed (`examples/_shared/cpsat.py`), so a
rerun draws a different board: `gen.json` is the artifact, `--search` is a
one-shot for drawing another.

Not `just time`: the board sits under `docs/research/`, so the driver has no
example directory to resolve (same reason as the wrapper board). Timed the
way `docs/real-app-timing.md` says for a link-vs-link comparison: one rep per
variant per round, three rounds, non-deterministic solve off, the app's
"sum" readout.

### Recorded rows (2026-09-18, v2026.08.14-d47fc4b, 3 reps, non-deterministic solve off)

| date | app version | board | mode | baseline (built-in) | candidate (GAC) | ratio | row PASS/FAIL |
|---|---|---|---|---|---|---|---|
| 2026-09-18 | v2026.08.14-d47fc4b | sparse-required-digits | cold | 2400ms | 4500ms | 1.88 | FAIL |
| 2026-09-18 | v2026.08.14-d47fc4b | sparse-required-digits | after-logical | 500ms | 1000ms | 2.00 | FAIL |
| 2026-09-18 | v2026.08.14-d47fc4b | sparse-required-digits | cold | 2400ms | 3100ms | 1.29 | FAIL |
| 2026-09-18 | v2026.08.14-d47fc4b | sparse-required-digits | after-logical | 500ms | 600ms | 1.20 | FAIL |

The last two rows are the same board re-timed after the cost pass on
`RequiredDigitsGacComponent.js` described below; the first two are the
component as #541 measured it. Same procedure, same session, three
interleaved rounds per row.

### Reading the rule

`ReadableRequiredDigitsGacComponent.js` is the same rule written for a reader
rather than a machine -- digit sets and cell lists through the puzzle API, no
bit arithmetic, no shared memo, subsets enumerated by size the way
`docs/research/408-house-gac/ReadableHouseGacComponent.js` does. It removes
exactly what the shipped component removes across 27,000 random states (6,522
of them branch-killing), and costs about 18x more on a 9-cell group with 9
required digits: 25.4us against 1.4us. Read it first, ship the other one.

### What the rule is worth inside the app's own solver (2026-09-18)

Every row above measures a **custom component**, which pays a tax the built-in
does not: `handleRequiredDigitsComponent` registers the built-in's digits in
the app's candidate-set map (`bundle-api-reference.md:562`), feeding
`HiddenSingleLogicStep`; a custom component cannot register anything. So those
rows answer "is our component a good swap", never "is the Hall rule a better
rule".

`bundle-probe/hall-in-bundle-probe.mjs` answers the second question. It loads
the reference bundle in Node, builds the sparse board's state through the
bundle's own `buildSolverStateFromPuzzle`, and runs "find all solutions" twice:
once as shipped, once with the Hall walk swapped onto
`RequiredDigitsComponent.prototype.update`. Swapping the prototype keeps the
registration, because that is keyed on the class, not on `update`.

| rule | search nodes | solve time |
|---|---|---|
| built-in (as shipped) | 47,241 | 11,840ms |
| Hall | 33,726 (0.71x) | 10,558ms (0.89x) |

Deterministic: identical node counts across three reps, both rules returning
the board's one solution, checked against the rules restated in the probe.

**So the rule does pay for itself; our component does not.** As the built-in,
the Hall walk cuts the search by 29% and the clock by 11% -- past the 0.9x bar.
As a custom component on the same board it ran 1.20-1.29x slower. The whole
difference is the registration a custom component gives up. This is a case to
send the app's author, not something a puzzle link can carry.

Caveats: this is the search solver ("find all solutions"), not AutoStep, and
Node rather than the browser -- a ratio between two runs in one process, not a
wall-clock row comparable to the tables above.

**Quarantine.** The probe never writes a modified bundle: it reads
`docs/research/humanify-pedagogy/bundle.claude.js` verbatim, refuses to run if
its sha256 has changed, appends only the `globalThis.__probe` export line
bugcheck.mjs already uses, and swaps the rule on the exported class at runtime.
Nothing here may build or verify a shipped link -- it would be measuring a
solver nobody runs.

### The cost pass (2026-09-18)

Three changes, none of them to what the component deduces -- the output is
identical on 27,000 random states, 6,522 of them stops:

- the three subset memo arrays moved to module scope, allocated once instead
  of three `Int32Array`s per `update` call, the way `HouseGacComponent`
  shares `pooledDigitsOf`;
- `countBits` became a SWAR popcount rather than one iteration per set bit;
- the per-subset `visit` closure went away: `walkSubsets` fills the memo and
  its two callers scan it inline.

Offline cost (`bench-required-digits.mjs` shapes, best of 5, us/call):

| shape | built-in | before | after |
|---|---|---|---|
| 3 cells, 1 digit | 0.064 | 0.215 | 0.168 |
| 9 cells, 4 digits | 0.093 | 0.561 | 0.417 |
| 9 cells, 9 digits | 1.348 | 3.217 | 1.349 |

So per call the component now matches the built-in on the heavy shape, and
the real-app gap closed from 1.88x/2.00x to 1.29x/1.20x. `two-row rule: NO
SHIP` all the same -- neither row clears 0.9x, and 1.20x is still a real
regression. What is left is not micro-optimisation: the built-in feeds the
app's candidate-set map (`bundle-api-reference.md:562`,
`handleRequiredDigitsComponent`) and a custom component cannot, so the swap
still gives up the hidden singles that registration buys.

Per-rep sums, cold: built-in 2400/2400/2300, GAC 4600/4500/4500;
after-logical: built-in 500/500/500, GAC 1000/1000/900.

`two-row rule: NO SHIP`. On a board that does search (2.4s baseline), the GAC
component makes the real solver about twice as slow on both rows. The offline
win (275 removals against 20 on one sparse group) does not survive the app:
the stronger pruning costs more per call than the search it saves, so the
`AGENTS.md` deduction-pays-for-itself invariant is settled against shipping
`RequiredDigitsGacComponent` as a replacement for the built-in.

Two things this row does not separate, worth knowing before reading it as a
verdict on Hall's-condition pruning in general:

- The built-in is a first-class class to the solver: `addConstraintComponent`
  registers its required digits in the candidate-set map
  (`docs/research/bundle-api-reference.md`, `addConstraintComponent`), which
  the app's own logic reads. A custom component gets none of that, so the
  candidate loses that help as well as paying for its own `update`. The
  comparison is the real swap a puzzle author would make; it is not a
  measure of the pruning alone.
- One board, one seed. Denser or shallower boards were not timed to a ratio
  (too shallow: 0ms both; deeper: the built-in DNFs).
