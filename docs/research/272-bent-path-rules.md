# #272 — hit-counts local board: which rules stay alive on bent paths, and where the search goes wide

Part of map #270. Question: on `examples/hit-counts/PUZZLE_LINK_local.txt` (36
bent one-ended paths, bare lines: not houses, digits may repeat), which of the
shipped hit-counts rules still fire, and which gate shut? Then, where does the
search go wide?

## The board's real geometry: 34 one-ended paths, not 36

`examples/hit-counts/gen_local.json` (seed 103, the source of the committed
link) stores each path as a list of `(row, col)` cells. Two of them are not
independent one-ended paths at all — they are the same route walked in
opposite directions:

```
R2 [[2, 8], [2, 7], [2, 6], [2, 5], [2, 4], [2, 3], [2, 2], [1, 2], [0, 2]]
T2 [[0, 2], [1, 2], [2, 2], [2, 3], [2, 4], [2, 5], [2, 6], [2, 7], [2, 8]]
```

`T2` is `R2` reversed, cell for cell. `main.js`'s own pairing test
(`sameReversed`, `examples/hit-counts/main.js:22-27`) catches this by cell
identity and gives the R2/T2 line a `HitCountsJointComponent`
(`examples/hit-counts/main.js:29-40`) instead of two independent
`HitCountsComponent`s. A probe run against the real `main.js` wiring (see
"Method" below) confirms it: 34 `HitCountsComponent` instances and exactly 1
`HitCountsJointComponent`, not 36 and 0.

The example's own README (`examples/hit-counts/README.md:329-331`) states "no
two paths cover the same cells in opposite directions, so none of them pairs"
— true of the *generator's design*, false of this *specific committed seed*.
`build_size.py --paths` draws each side's path independently at random
(`framebuild.make_paths`) and never checks against the other 35, so a
coincidental reverse-pair like R2/T2 can and did slip through. This is
worth a note on #270's board-regeneration lever (a fresh seed could remove or
add such a coincidence), but changes nothing about the analysis below: R2/T2
still cannot reach the frame board's strength, for the reason in the next
section.

## Line contract: what each rule needs, and what a bent path has

Per `docs/line-contract.md`, a line is bare, house, or full house, and a rule
gates on the weakest kind it needs. A bent path spans more than one row and
more than one column by construction (`framebuild.make_paths`'s doc comment:
"both legs are non-empty, so the path spans more than one row and more than
one column"). Because `getCellsCanHaveRepeats` asks whether every cell in the
line sees every other cell in some registered exclusion group (row, column, or
box), and a path that leaves its own row and column never satisfies that for
its full length, **`lineKind` returns `BARE` for every one of the 36 paths, on
every call, for the life of the puzzle.** This is a geometric fact fixed at
generation, not a solve-time candidate state — unlike the frame board, where
every line starts bare only until the app registers the row/column houses,
promoting all 36 lines to `HOUSE` and then (once the digit set settles)
`FULL_HOUSE` in `docs/line-contract.md`'s terms. On the local board there is no
later promotion: `oneToN` never gets set (it is only computed once bare-gated
`lineKind` stops short of testing it — `HitCountsComponent.js:39-50`,
`HitCountsJointComponent.js:141-152`), so `instance.kind` stays `BARE` and
`instance.oneToN` stays falsy forever.

Walking each shipped rule against that:

| Rule | Needs (line-contract kind) | On this board |
| --- | --- | --- |
| `HitCountsComponent` reverse bound (`clue ∈ [forced, possible]`) | bare — sound on any kind (`HitCountsComponent.js:18-20`) | **Fires**, on all 36 lines (35 one-ended + the R2/T2 pair, which also gets its own bounds via the joint component below) |
| `HitCountsComponent` forward bounds ("no more hits" / "every free cell must hit") | bare | **Fires**, same 36 |
| `HitCountsComponent.noNMinusOne` (a full house of `1..n` can never clue `n-1`) | full house, digit set `{1..n}` | **Gate shut, permanently** — `fullHouseOfOneToN` needs `oneToN`, which a bare-gated line never reaches |
| `HitCountsJointComponent` case sweep (mirrored-pair hit exclusion) | bare for the weak (non-house) reading; house to exclude the "both L and R hit the mirrored pair's shared digit" case (`HitCountsJointComponent.js:99-104`) | **Fires only for R2/T2**, and only in its weakest (non-house) mode — `house = kind >= HOUSE` is `false` forever, so both `(L, R)` and `(R, L)` mirrored-pair readings stay open, exactly the case the contract's Ties/house section calls the loose reading |
| `HitCountsJointComponent` permutation DP (exact sweep over `1..n` permutations) | full house, digit set `{1..n}` | **Gate shut, permanently**, same reason as `noNMinusOne` |
| `HitCountsJointComponent`'s own `n-1` reject | full house of `1..n` | **Gate shut, permanently** |
| `SideSumComponent` | a whole side: `n` clues + `n` full-house perpendicular lines, only registered by `main-global.js` | **Never constructed.** `main.js` (the local variant) has no side and never calls `new SideSumComponent(...)` (`examples/hit-counts/main.js`, confirmed by reading it end to end — no reference to the class). This is a harder "no" than a gate: the component does not exist on this board, gated or not. |
| `SideHitMatchingComponent` | same side shape, plus each position a house of `1..n` | **Never constructed**, same reason |

So of the four shipped components, two (`SideSumComponent`,
`SideHitMatchingComponent`) are structurally absent from the local board's
wiring — not a gate that could still open, but code `main.js` never
registers. The other two run, but every rule inside them that needs more than
"bare" is gated shut for good: only the naive per-cell forced/possible bound
survives, on 36 lines (35 through `HitCountsComponent`, one line through
`HitCountsJointComponent`'s weak case sweep). None of the board's strong
deductions — the `n-1` reject, the exact permutation sweep, the side sum, the
side hit matching — ever fires.

## Where the search goes wide

**Method.** No existing probe in this repo wires `main.js` (the local
variant) over drawn path geometry — `recovery-probe.mjs` and
`soundness-harness.mjs` both hardcode `main-global.js` and
`frame-geometry.mjs`'s straight frame lines. A throwaway script (not
committed; job scratch only, mirroring `recovery-probe.mjs`'s own engine) built
the real `main.js` + `HitCountsJointComponent`/`HitCountsComponent` wiring over
`gen_local.json`'s `paths` field, on top of the shared Régin-strength (GAC)
all-different floor and MRV DFS from `examples/_shared/recovery-lib.mjs` — the
same engine `docs/research/224-search-cost.md` used for the frame board, node
cap 200,000.

**Result.**

| Wiring | search nodes | solutions |
| --- | --- | --- |
| Régin floor alone (no hit-counts components) | 200,001 | 0, **CAPPED** |
| shipped local wiring (34 `HitCountsComponent` + 1 `HitCountsJointComponent`) | 200,004 | 0, **CAPPED** |

Both runs hit the cap without finding a single solution. Unlike the frame
board — where dropping `HitCountsComponent` or `SideSumComponent` blew the
node count from 39,549 to over 200,000 (`docs/research/224-search-cost.md`) —
here the *full shipped wiring* is already indistinguishable from *no
hit-counts components at all* at this cap. The line-contract analysis above
explains why: the only rule that fires everywhere is the naive
forced/possible bound, and that bound is weak by construction — it is the same
bound `examples/hit-counts/README.md`'s own "tighter bound we measured and did
not ship" section shows over-counts on a line as short as three cells. On 36
lines of nine bare cells each, it prunes very little, and the fixpoint check
above confirms it: from a fresh start, the shipped local wiring plus the Régin
floor removes only 90 candidates in 3 passes before settling — a small,
early, one-time gain, not a deduction that bites during search.

This matches the 9x9's own "wide, not slow" finding by the same evidence
(mock node count against a strong floor), but the local board's case is more
extreme: the frame board's shipped wiring was worth 5x fewer nodes than the
floor alone (39,549 vs a component-count that blew the 200,000 cap);
the local board's shipped wiring is worth nothing measurable against the same
cap. The lever for #270, if it is component strength, is not "make the
existing rules run harder" — they already run everywhere they can — it is a
genuinely new bare-line deduction, the "not yet specified" question map #270
already flags.

## Caveats

- The mock's node counts are not the app's; per `docs/research/224-search-cost.md`,
  the app's real search (weaker default heuristics) can only be as wide or
  wider than what a Régin-strength floor needs.
- Both search rows are lower bounds (CAPPED at 200,000): the true gap between
  "floor alone" and "shipped wiring" could reappear beyond the cap, though the
  fixpoint result (90 candidates removed, 3 passes) makes a large gap deeper in
  the tree unlikely — the wiring is not holding back a reserve of unused
  pruning power, it has already applied everything it can early and stopped.
- The R2/T2 coincidental pair is a fact of the *committed seed* (103), read
  directly off `gen_local.json`, not a general property of `--paths` boards.
  A regeneration with a different seed could produce zero such pairs, or a
  different one.
- No app timing was run (out of scope per the ticket; #264 covers the DNF
  explicit-timeout reporting this board needs).
