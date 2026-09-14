# Audit: every shipped constraint against the mined bundle facts

Date: 2026-09-14. Tree: `46a15a6` on main. Read-only; no code changed.

Scope: every component and main-code segment under `examples/` (skyscraper,
running-start, numbered-rooms, outside-sudoku, hit-counts, isofill, fillomino,
house-gac) plus the shared frame snippets in `examples/_shared/`. Checked
against the facts mined from the bundle since 2026-09-12: `docs/gotchas.md`
1-12, `docs/component-contract.md`, `docs/puzzle-api.md`, the contract
sections of `docs/research/bundle-api-reference.md` (lines 39-700), the SM
issue #22 note, `docs/agents/per-call-cost.md`, and `CODING_STANDARDS.md`.
Five parallel reviews, one per example group, each reading the bundle body at
the cited lines rather than the reference alone. The checklist they applied is
reproduced at the end.

## Verdict

**Zero soundness findings.** Every removal in every component traces to the
rule and the filled cells; the three memo rules (#316, #329, #336) are
honoured everywhere. What the audit found is one strength bug, one class of
misleading comments, a missing `| 0` on the two largest boards, four dead
`initialize` bodies, and a long tail of allocation and duplication that the
bundle facts now let us remove.

| Category | Count |
|-|-|
| soundness | 0 |
| contract (behaves other than the code or its comment says) | 13 |
| perf (a concrete cheaper shape exists, unmeasured) | 29 |
| readability | 15 |
| docs-drift | 14 |

## Cross-cutting findings, ranked

### 1. "Fail loud" throws are console-only and abort the rest of the backend

**Contract, high.** Bundle: `registerCustomConstraint` wraps the whole main
segment in try/catch (`bundle.claude.js:10116-10133`); `logConstraintError`
is one `console.error(error)` (9911-9913); a throw inside `update` is caught
the same way and the generator just ends (10049-10062). Nothing reaches the
UI. Five places rely on a throw and call it loud:

| Site | What actually happens |
|-|-|
| `examples/_shared/HouseGacComponent.js:76,79` (RangeError in `setParams`) | Constructor runs in main code; the catch is outside the registration loop, so a board tripping the cap on row 1 ships with **zero** GAC instances, not eight. |
| `examples/house-gac/main.js:16-23` | Throw precedes every registration: the board ships with no filter at all. |
| `examples/outside-sudoku/main.js:14-16` (bent group) | Throw is inside the group loop, after earlier groups registered: the constraint **half-applies**, silently. Worse than fail-open. |
| `examples/_shared/frame-lines.js:75` (`framePairs`) | Console-only; a throw is still right here since the alternative is a mispaired component. Comment should say it is invisible. |
| `examples/isofill/IsofillComponent.js:471` (cells do not divide) | Throw in `update`: the board solves as if ISOFILL were absent. Use `puzzle.stop(...)`, which reaches the step log. |

The genuinely loud guards are the build-time ones (`framebuild.py:456`
`HOUSE_GAC_MAX_CELLS`, `check_layout.py`) and the Node harnesses. Fix: keep
the checks, rewrite each comment to say where the failure is visible, and for
outside-sudoku either `continue` past the bad group or validate every group
before registering any.

The same wrong mental model is in `CODING_STANDARDS.md` "Fail loud, never
silently no-op": it still says `replaceComponent` with a custom target
"silently does nothing", which gotcha 1 corrected on 2026-09-13. Repeated in
`examples/running-start/README.md:107-111` and `running-start/main.js:5-6`;
softer form in `numbered-rooms/README.md:53` ("the pattern gotcha 1
requires").

### 2. Whole-board components get uncoerced cell ids

**Perf, high on the mechanism.** `examples/isofill/main.js:18` and
`examples/fillomino/main.js:14` build every id with
`helpers.cellIds.getIdFromCoordsSafe` and never `| 0`. That is the exact
function `getCellAt` delegates to (`bundle.claude.js:9278`), so gotcha 10's
measured 1.2-1.3x per-candidate-read cost applies to the two components that
read candidates most. Every other main in the repo coerces
(`house-gac/main.js:12`, `frame-rowcol.js:33`, `frame-lines.js:36`).
`frame-corners.js:13` also does width arithmetic uncoerced, four cells, near
zero cost, but two headers citing #276/#394 disagreeing is how a load-bearing
`| 0` decays into decoration. Fillomino cold rows run 8-25 s, so `just time
fillomino` will show whether this is the cheapest win in the repo.

### 3. Four `initialize` bodies duplicate the `update` the base class runs

**Contract, high.** The wrapper runs your `initialize`, then the base class's,
which ends in `yield* this.update(...)` (`bundle.claude.js:10031-10034`,
2686-2704). `hit-counts/SideSumComponent.js:70-72`,
`HitCountsJointComponent.js:521-523`, `SideHitMatchingComponent.js:277-279`
are literally `yield* update(...)`; `HitCountsComponent.js:129-131` yields
`noNMinusOne`, which `update` opens with. Each does its load-time pass twice.
Delete all four and their comments (each promises a benefit `update` already
delivers). No other component defines `initialize`, so SM issue #22's
one-shot trap is unreachable here.

### 4. `getAffectedCells` mismatches: one under-lists, one over-lists

- **`hit-counts/SideSumComponent.js:8-10` — contract, high, the one strength
  bug.** Lists only the clue cells, but `gateOpen` (39-43) reads every cell of
  the n crossing lines. The solver re-runs `update` only when a listed cell is
  dirtied (`runPass`, 9006). The gate opens when the inner lines lose their 0,
  which dirties no clue cell, so in that branch the side sum can never fire.
  Corollary (medium): with only clue cells listed, once they are filled while
  the gate is shut `validate` returns true and `getIsDone` retires the
  component unchecked. Strength only, since the joint component still enforces
  the real rule. Fix: `cells.concat(...lines)`, which widens the trigger set
  from n to n+n² and so needs a `just time hit-counts` row.
- **`outside-sudoku/OutsideSudokuComponent.js:18-20` — perf, medium.** Lists
  the whole line; both `update` loops stop at the window `w` (3 of 9 on the
  shipped board), so two thirds of its wakeups read nothing. `w` needs
  `puzzle`, which `getAffectedCells` never gets, so compute it in main code
  (both mains already have `getRegion`) and pass it as a third argument. Must
  move with `validate`'s filled-check (`[clue, ...line.slice(0, w)]`) in the
  same diff, or a narrowed list lets `getIsDone` retire a violated component on
  a vacuous true.

### 5. `SudokuDigitSet` allocations where a raw mask is accepted

**Perf/readability, high on the mechanism.** The change factories store the
first argument raw (`bundle.claude.js:1878`) and the only consumer is
`cell.candidates & digitMask` (8899-8901) or `.valueOf()` (561-563). A Number
works. Sites: `skyscraper/SkyscraperLineComponent.js:254-257`,
`SkyscraperOneSidedComponent.js:186`, `_shared/HouseGacComponent.js:187`,
`hit-counts/HitCountsJointComponent.js:332,334,337,503,505,509` (each wraps a
mask as `SudokuDigitSet.from(bits(mask))`, making `bits()` at 514-518 dead
code), `outside-sudoku/OutsideSudokuComponent.js:62,82`, plus isofill and
fillomino's per-yield sets.

**Blocker:** `examples/_shared/harness-lib.mjs:172` throws unless the argument
is a `DigitSet`, and its comment says "The app takes a DigitSet here and
nothing else". `isofill/README.md:181-183` repeats the claim. The real hazard
the mock guards is a plain **array** (its `valueOf` is not a number, so `&`
gives 0 and the removal is a silent no-op). Fix the mock to accept a DigitSet
or an integer and reject everything else, correct the README, then the sites
above are deletions. The mock also lacks `removeCandidatesFromCells` and
`filterCandidatesInCell`, which the next two items need.

Related single-call shapes the bundle offers:

- `filterCandidatesInCell(mask, cell)` (9946) for "keep only d":
  `hit-counts/HitCountsComponent.js:118-123` and
  `SideHitMatchingComponent.js:265-268` both build the complement as an array.
  A no-op filter returns `UnchangedResult` (8913), so the length guard goes too.
- `removeCandidatesFromCells(mask, cells)` for one mask over many cells:
  `numbered-rooms/NumberedRoomsComponent.js:86-90` (up to eight type-3 changes
  for one mask), `isofill/IsofillComponent.js:410,434,454`.
- Bitmask min/max instead of `Math.min(...Array.from(getCandidates))`:
  `hit-counts/SideSumComponent.js:49-66`, `running-start/RunningStartComponent.js:50-59,79-104,131,151`.
  The idioms are already in the tree at `SideHitMatchingComponent.js:195-196`.

### 6. The repeats gate caches only the "no repeats" answer

**Perf, medium; a decision.** `getCellsCanHaveRepeats` builds a fresh Set per
cell over every component on that cell (8815/8849/8860), O(n) and not cheap.
Six gates latch only the true-house answer, so on a line that genuinely allows
repeats the walk runs on every `update` and every `validate` for the whole
solve: `running-start/RunningStartComponent.js:31-35`,
`RunningStartPairComponent.js:40-44`, `numbered-rooms/NumberedRoomsComponent.js:43-48`,
`hit-counts/HitCountsComponent.js:41-44`, `HitCountsJointComponent.js:164-167`,
`_shared/HouseGacComponent.js:111-114`. Latent on every shipped frame board
(all lines are houses, latch on call one); paid on the local variants' drawn
lines and on any future non-house board. House-ness is geometry-fixed in both
directions once `update` runs (every constraint is registered by then, gotcha
6), so caching false is as safe as caching true. **The decision:**
`docs/line-contract.md` prescribes re-asking, but its reason is the
full-house kind, which reads live candidates; none of these six looks above
HOUSE through this call. One caveat to name in the comment: `getIsDone` can
retire a built-in house mid-branch, which would weaken but not falsify a
cached answer.

### 7. Per-call allocation in hot loops (per-call-cost.md)

Ordered by likely size. None is in an OPTIMIZATION_LOG as tried.

| Site | Shape |
|-|-|
| `fillomino/FillominoComponent.js:221,345,391,418,448` | `getCandidates(c).has(d)` allocates a DigitSet per neighbour visit; 221 is the inner loop of `walk`. The file already switched to `getCandidatesBitMask` at 482 and its README records that switch as worth 2.13x → 2.09x. Five sites were never converted. |
| `isofill/IsofillComponent.js:555-605` (`budget`) | Opts out of the file's own scratch-buffer discipline: ~110 allocations per call (two typed arrays, three arrays, a Uint8Array per open cell in `augment`, one array per node for `adj`, three more in `sccs`). Pooling elsewhere in the file measured 5.7 s → 4.1 s. |
| `isofill/IsofillComponent.js:316` | `Array.from(getCandidates(c))`, two allocations per open cell in the one hot scan. |
| `hit-counts/HitCountsJointComponent.js:386-449` | The non-permutation path grows `combos` by push and allocates U+2 arrays per call, beside a `permScratch` (187-204) that is allocation-free and cites per-call-cost.md. |
| `hit-counts/HitCountsJointComponent.js:362-372` | Reads every line cell's mask three times before deciding whether to work (`cm`, `lineKind`, `signature`); the memo-hit path pays all three. Pass the masks in. |
| `running-start/RunningStartComponent.js:50-59,79-104` | `below` builds two `Array.from`, two filters and a set per call, up to kmin times per pass; `feasibleClues` a Set plus a DigitSet per line cell. |
| `hit-counts/HitCountsComponent.js:137`, `HitCountsJointComponent.js:534`, `SideHitMatchingComponent.js:284` | `validate` rebuilds `[clue, ...line]` or calls `getAffectedCells` again on every search node. The constructor already stored that array as `instance.cells` (10004-10007). |
| `skyscraper/SkyscraperLineComponent.js:276-277` | `validate` runs the O(n) gate before the O(1)-short-circuit fill check; swap the two lines. |
| `skyscraper/SkyscraperLineComponent.js:67-90` | `dpFor` keeps one slot keyed on `m`; a rectangular frame alternates m and reallocates every call. Cache per m or size at MAXN. |
| `skyscraper/*.js:134-200` | `rev` arrow, returned object literal, `drop` closure, `for...of` iterators. Small; measure as one change. |
| `_shared/HouseGacComponent.js:126,136` | `freePositions` is confined to the yield-free walk, so it could be module scratch; `candidates`/`startingCandidates` cross a yield and must stay per-call. |
| `fillomino/FillominoComponent.js:387-402,418,448` | `allowed` row built then ignored by the re-walk; `doors.includes` linear scan in a file that carries a stamped mask for that job. |
| `isofill/IsofillComponent.js:640` | `validate` allocates a boxed full-board array per digit. |

### 8. Duplicated helpers where `#include` already reaches component files

**Readability, high on the fact; a decision.** `minify_file` resolves
`// #include` in any paste target and prunes unused functions
(`examples/_shared/minify.py:27-28,73`; `docs/example-layout.md:225-235`), so
the link carries the same bytes either way.

- `running-start`: `isHouse` duplicated verbatim with ten lines of comment;
  `less(puzzle, a, b)` is `below(puzzle, a, b, true)` letter for letter.
- `hit-counts`: `lineKind` hand-maintained in three files; the comment at
  `HitCountsJointComponent.js:159-160` says the copies "cannot share code",
  which is true of the runtime and false of the authoring. Three copies of a
  soundness gate is what #336 was about.
- `isofill` / `fillomino`: ~110 lines shared (`neighbours`, `domTree`,
  `subtreeSums`, the starve half of `cutFilter`), fillomino's own comment at
  243-245 says "Transferred from ISOFILL unchanged".

**The trade:** `harness-lib.mjs:72` `loadAt` refuses a source carrying a
directive, so a component with an `#include` can never be pinned as an
update-strength floor, and both running-start components are pinned today
(REF_COMMIT db93523). Either teach `loadAt` to assemble, or accept the copies.

### 9. Latent throws (silent, per finding 1)

- `skyscraper/SkyscraperLineComponent.js:230`: `peak > MAXN` guards only the
  top; a zero-length line (a two-wide frame) opens the gate, `dpFor(-1)` does
  `new Uint8Array(1 << 31)`, RangeError. Fix: `peak < 1 ||`.
- `running-start/RunningStartComponent.js:156-159`: a clue given as 0 on a
  minDigit-0 board indexes `line[-1]`. No shipped board; one `k >= 1` clause.
- `isofill/main.js` reads only `spec.size.width` and `setParams` recovers side
  as `round(sqrt(length))`, so a non-square board is silently mis-neighboured
  and can pass the divides-evenly guard.
- Both region components bump an unbounded visit stamp against a typed-array
  mask with no wrap; unreachable in a browser solve.

### 10. Smaller contract and readability items

- `_shared/house-gac.js:20` names its instances `row 1`, identical to
  `frame-rowcol.js:31`, so on a frame board the step log and stop message
  cannot say which component fired. Defeats the point of gotcha 9. Name them
  `GAC row 1`.
- `_shared/house-gac.js:22` has no region-count check while
  `house-gac/main.js:21-23` does; `getRegions` back-fills missing ids with
  empty arrays (8512-8522), so a short list registers zero-cell filters
  silently.
- `_shared/HouseGacComponent.js:81` `instance.cells = cells` restates what the
  compiled constructor already set (10004-10007).
- `house-gac/main.js:14` coerces rows and columns but not boxes, without the
  one-clause reason `house-gac.js:11-14` gives (region ids are the state's own
  loop indices).
- `hit-counts/HitCountsComponent.js:21-23,50`: `oneToN` implies `FULL_HOUSE`
  (its popcount is `line.length`), so every `kind === FULL_HOUSE && oneToN`
  has a dead left half; the three-rung kind collapses to BARE vs not.
  `README.md:136-151` is written in three rungs and moves with it.
- `hit-counts/HitCountsJointComponent.js:323-326,495-498`: after a `stop()`
  the solver stops draining (9107), so the `stopped` boolean and line 381 never
  run in the app; the memo-after-stop rule is honoured by terminal-change
  abandonment. The boolean still earns its place in the Node harnesses, which
  drain fully. Comment should name both guards.
- `hit-counts/HitCountsJointComponent.js:372-373`: `instance.sig` is a 32-bit
  hash, while `docs/component-contract.md` describes the safe memo as "keyed
  on the state itself". A collision skips a sweep: strength only. One line in
  the code and one word in the doc.
- `hit-counts/SideHitMatchingComponent.js:256`: the null-side exit leaves a
  stale `sig`, opposite to the care at 273. One line.
- `running-start/RunningStartPairComponent.js` defines no `validate`, so it is
  never retired (`getIsDone`). Deliberate or not, say so.
- `skyscraper/SkyscraperLineComponent.js:235-236`: history comment ("this
  used to surface as an emptied clue cell").
- `hit-counts` non-finding for the record: on a board with maxDigit > n the
  joint component masks clue candidates above n instead of removing them;
  every shipped board has maxDigit == n.

### 11. Docs drift

| Doc | Says | Reality |
|-|-|-|
| `CODING_STANDARDS.md` "Fail loud" | `replaceComponent` with a custom target silently does nothing | Gotcha 1: the swap works; a bare class name throws, and it reaches the console |
| `running-start/README.md:107-111`, `main.js:5-6` | same | same |
| `numbered-rooms/README.md:53` | gotcha 1 "requires" one self-contained component | it is one of two routes |
| `skyscraper/README.md:159` | main.js registers a running-cap component | `SkyscraperOneSidedComponent` since #241 (timing rows at 459-500 are historical and correct) |
| `hit-counts/README.md:170-172` | the line kind is "cached on the instance" | `lineKind` recomputes every call by design (#336); only `noRepeats` is cached |
| `isofill/README.md:181-183` | the app wants a real DigitSet | bundle ANDs a raw mask; only our mock throws |
| `docs/component-contract.md` memo paragraph | memo "keyed on the state itself" | it is a 32-bit hash |
| `AGENTS.md` rules-prefix bullet, `docs/example-layout.md:109`, `check_layout.py:10` | only isofill is exempt | `check_layout.py:96` exempts fillomino too, and fillomino's build relies on it |
| `HouseGacComponent.js:46-47,76-79`, `house-gac/main.js:16-23`, `outside-sudoku/main.js:14-16` | throw is loud | console-only (finding 1) |

Two contradictions that are **decisions, not fixes**:

- `house-gac/build_link.py:57,137`: the committed link's rules text opens
  "Normal sudoku rules apply on the inner grid." on a plain 9x9 with no ring.
  The code follows AGENTS.md; AGENTS.md does not fit this board. Either a
  second exemption for ringless boards or the sentence stands.
- `framebuild.py` `build_doc` comment says a custom puzzle defaults to 0..9;
  `bundle-solve-lib.mjs:68-69` says 1..width. The headless solver agrees with
  the .mjs side on the house-gac link (1 solution), not resolved against the
  live app.

## Per-example status

| Example | Soundness | Findings | Headline |
|-|-|-|-|
| skyscraper | clean | 7 | zero-length line throws; DigitSet allocs; validate gate order |
| running-start | clean | 7 | replaceComponent claim in README; allocation in `below`; duplicated `isHouse`/`less` |
| numbered-rooms | clean | 4 | strongest of the line components; bulk removal; gate re-ask |
| outside-sudoku | clean | 2 | over-listed `getAffectedCells`; half-registering throw |
| hit-counts | clean | 18 | SideSum trigger set (strength bug); four dead `initialize`; six mask wraps |
| isofill | clean | 8 | uncoerced ids; `budget` allocation; throw in update |
| fillomino | clean | 7 | uncoerced ids; five `getCandidates().has` in the walk |
| house-gac + `_shared` | clean | 13 | console-only "loud" throws; `row 1` name collision |

Checked and clean everywhere: no `validate` returns an object; every
`validate` returns true while incomplete; no `replaceComponent` anywhere, so
gotcha 1's spelling trap is unreachable; nothing is yielded after a `stop()`;
no memo is written on a stopped path; no cached fact is candidate-derived;
change-builder argument order is mask-first everywhere; no component reaches
`helpers.lines`, `helpers.misc` or `getSubsetsPerRegion`; the two bundle bugs
(`getCoordsPointedAtByOuterClue`, `groupsArePolarityPair`) are unused;
`check_layout.py` reports 0 violations; both region components are right to
re-derive connectivity rather than call `getOrthogonallyConnectedGroups`,
which allocates a LineGraph per component per call (485-494, 345).

## Suggested slicing

Each ships behind the two-row `just time` bar where it touches `update`.

1. **Docs-only, auto-ship:** every row of the drift table, the
   "loud"-throw comments, `component-contract.md` hash wording, the fillomino
   exemption in three places. Plus the two decisions above once ruled.
2. **Harness mock accepts an integer mask** (`harness-lib.mjs:172`) and gains
   `removeCandidatesFromCells` / `filterCandidatesInCell`. Unblocks 3-5.
3. **hit-counts:** delete four `initialize`; widen SideSum's trigger set; six
   raw masks and dead `bits()`; two `filterCandidatesInCell`; three
   `validate` arrays; collapse FULL_HOUSE. One `just time hit-counts`.
4. **isofill + fillomino:** `| 0` in both mains first, measured alone
   (`just time fillomino`, `just time isofill`); then the five
   `getCandidates().has` sites; then `budget` pooling.
5. **skyscraper:** `peak < 1` guard, raw masks, validate order, history
   comment, README:159.
6. **outside-sudoku:** window passed from main code, `getAffectedCells` and
   `validate` narrowed together; group loop made safe.
7. **running-start + numbered-rooms:** bitmask `below`/`feasibleClues`,
   `k >= 1` guard, bulk removal in numbered-rooms.
8. **Decisions before code:** cache the "repeats allowed" answer (against
   `line-contract.md`); `#include` into pinned-floor components; `GAC row 1`
   naming; rules prefix on ringless boards; digit-range default comment.

## Checklist applied

1 `getAffectedCells` lists every read cell and no unread one. 2 `initialize`
is one-shot and precedes a base `update`. 3 `validate` bare boolean, true
while incomplete, retirement via `getIsDone`. 4 terminal changes (`stop`,
`replaceComponent`), `customComponents.Name`. 5 `instance` lives for the
solve: no memo after stop, no candidate-derived cache. 6 silent throws in
`update`. 7 change-builder order and bulk forms. 8 DigitSet fresh copies,
mutating algebra, statics. 9 component-scope `helpers`. 10 `| 0` on derived
ids; spent generators. 11 `getCellsCanHaveRepeats` cost and caching. 12
`update` inside hypotheses. 13 GAC strength vs refutation-only. 14 names in
the step log. 15 frame boards declare rows/columns and the rules prefix. 16
bundle bugs. 17 per-call cost. 18 comments describe the code, not history.
19 dead code, duplication, misleading names. 20 soundness with a
counterexample required.
