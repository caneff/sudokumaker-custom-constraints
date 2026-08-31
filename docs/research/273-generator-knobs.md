# #273: what the hit-counts local generator can dial

**Parent.** Map #270 — hit-counts local board (36 bent-path lines) needs a
verdict: strengthen components, regenerate, or accept DNF. This ticket covers
the regenerate lever only: what `examples/hit-counts/build_size.py --paths`
and `examples/_shared/framebuild.py` can already turn, and how constrained the
shipped board already is.

## Question

If the lever is the board, what knobs exist, and which one buys search
closure cheapest before the triviality guard (the app's logical pass alone
must not finish the board) starts to bite?

## What the shipped board is

`examples/hit-counts/gen_local.json` (seed 103, `9 3 3`): 2 interior givens,
32 of 36 ring clues shown, 4 hidden (interactive): `L6`, `R5`, `R7`, `T2`
(`examples/hit-counts/gen_local.json`). Every path is a full-length bent L —
`framebuild.make_paths` always spans the whole side-to-side distance (`a`
cells in, `n - a` across, `a + (n - a) = n`), so "path length" is not a free
knob at fixed `n`; only the bend point `a` (drawn uniformly from `range(2, n)`
per line, per seed) varies, and it is not separately controllable —
`examples/_shared/framebuild.py:104-129`.

## Knobs the generator actually exposes

Reading `build_size.py` (`examples/hit-counts/build_size.py:104-115`) and
`framebuild.run`/`generate` (`examples/_shared/framebuild.py:204-265,
485-527`):

| Knob | CLI surface | What it does | Controllable today? |
| --- | --- | --- | --- |
| Grid size `n`, box `bh × bw` | positional args | Total lines = `4n`; unknown count scales with `n²` | Yes, but out of scope — the local board is pinned at 9x9 to match the fixed given-only board (#116) |
| Seed count | 4th positional arg | How many random seeds `generate()` scans before picking the one with fewest interior givens | Yes, cheap to raise, but see below — it does not target hidden-clue count |
| `--paths` | flag | Bent paths vs. straight frame lines | Already on for the local board; not a further dial |
| Interior givens | none directly | `generate()` carves to the CP-SAT-minimal count automatically; no argument sets a floor above the minimum | No — would need a small code change to stop the carve-back loop early |
| Shown/hidden ring clues | none directly | `generate()`'s discard loop (`framebuild.py:247-252`) uses an unused `hide_key` parameter (`None` in every current caller, confirmed by `grep -rn hide_key examples/`) and otherwise runs to the CP-SAT-uniqueness-maximal-hidden extreme in a random order | No — same gap as interior givens |

**The two knobs the ticket asked about by name — shown-clue fraction and
interior givens — are not actually exposed as parameters.** `generate()`
always drives both to their CP-SAT-minimal extreme (fewest givens it can
carve, then most clues it can hide on top of that). `build_size.py` never
passes `hide_key`, and there is no argument to cap how many lines get hidden
or to keep extra interior givens on purpose. Turning either knob today means
either hand-editing the recorded `gen_local.json` and rebuilding the doc
directly (see "Cheapest lever," below), or adding a few lines to
`framebuild.generate()` to accept a stop condition.

## How constrained is the shipped board, by CP-SAT's own proof

Reran `generate()`'s exact carve/discard steps against the shipped board's
recorded state (`gen_local.json`, seed 103) and asked: does uniqueness survive
if I show back some of the 4 hidden clues, without touching anything else?

```
baseline: givens 2 active(shown) 32 hidden 4
reveal 1 of 4 hidden -> unique=True, shown=33, still-hidden=3
reveal 2 of 4 hidden -> unique=True, shown=34, still-hidden=2
reveal 3 of 4 hidden -> unique=True, shown=35, still-hidden=1
reveal 4 of 4 hidden -> unique=True, shown=36, still-hidden=0
```

(Full run in the branch history; not committed as a script — it is a
one-off `unique()` call per row, using `framebuild.load_gen` +
`framebuild.unique` against the shipped `gen_local.json`.)

Every reveal stays unique. This is not a coincidence of this board — it is
guaranteed by construction: showing a clue only *adds* a CP-SAT constraint
that the model's one known solution already satisfies, so it can only shrink
or leave unchanged the solution set of an already-unique model, never grow it
back to two. **Revealing any subset of the current 4 hidden clues is safe for
uniqueness with zero regeneration cost and zero CP-SAT re-proof needed** — it
is a pure edit to which clues are marked `active` before `build_doc` runs.

That also means CP-SAT's uniqueness proof is not the thing that is fighting
regeneration here: the model is already at its *most* interactive (fewest
things it needs shown) that CP-SAT-level reasoning allows. The gap the map is
chasing is between CP-SAT's global search (which proves uniqueness in
seconds against a 10 s worker budget, `framebuild.py:183-186`) and whatever
the app's own logical pass can close on bent (non-house) lines — a gap this
ticket's generator-only scope cannot measure directly (see caveat below).

**Seed variance, for scale.** Ran the full givens-carve + hide-discard
pipeline (not just the interior-givens scan `generate()` does by default) on
five nearby seeds:

| seed | interior givens | ring clues hidden (of 36) |
| --- | --- | --- |
| 103 (shipped) | 2 | 4 |
| 104 | 1 | 5 |
| 105 | 4 | 8 |
| 106 | 2 | 7 |
| 107 | 4 | 8 |

Seed choice swings interior givens 1–4 and hidden count 4–8 (11–22% of
lines) — real spread, but no seed in this sample beats the shipped board on
*both* axes at once, and `generate()`'s selection rule (fewest interior
givens only) would have picked seed 104 over 103 had it been in the scanned
range (the shipped board's `gen_local.json` matches exactly what
`build_size.py 9 3 3 3 --paths` produces — a 3-seed scan, not the CLI's
40-seed default). Seed scanning is a real knob but an uncontrolled one: it
does not let you dial a specific hidden-clue target, only sample the
neighborhood and hope.

## Which knob buys search closure cheapest

**Showing back one or more of the 4 already-hidden ring clues is the
cheapest lever**, for three reasons:

1. **Zero regeneration cost.** No CP-SAT re-search is needed at all (the
   monotonicity argument above) — it's a metadata edit to `active` in
   `gen_local.json` followed by re-running `build_doc` + `check` (a variant
   of `rebuild_size.py` with its "frame must not change" assertion dropped,
   since the shown/hidden split is exactly what's changing).
2. **Fine grain.** Each ring clue occupies a small domain (0..9, further
   bounded by path length) — revealing one removes exactly one such unknown
   and hands every component a known fact from the first pass, one line at a
   time. Four steps (4→3→2→1→0 hidden) give four distinct difficulty points
   to probe against the triviality guard.
3. **Doesn't touch the sudoku baseline.** Interior givens are the other
   candidate knob, but they pin a cell across three houses at once (row + box
   + column) — a blunter, more trivializing move, and one that leans on
   ordinary sudoku singles rather than exercising the bent-line hit-count
   reasoning this board exists to test. There's also no code path to add one
   post-hoc today without a small script (same gap as the shown-clue knob).

Path count (fixed at `4n`, one per ring position) and bend shape (`a`, drawn
per line per seed with no controlling argument) are not exposed knobs at all
without editing `framebuild.make_paths` — not worth pursuing before the
cheaper clue-reveal lever has been tried.

## Where the triviality guard likely bites

No number here — this ticket is generator/CP-SAT reading only, no app timing.
Structurally: revealing all 4 hidden clues collapses the board to only 2
interior givens plus every hit-count fact known up front, which starts to
resemble the fixed given-only 9x9 (verified non-trivial at 6.2 s, #116) except
on weaker bent-path (non-house) lines instead of full rows/columns. Whether
that's still non-trivial, or whether the app's logical pass now closes it
outright, is exactly what `just time hit-counts --board PUZZLE_LINK_local.txt`
would need to answer — one reveal at a time, stopping at the first hidden
count that both finishes inside the rep and leaves the logical pass short of
the full board. That test is out of this ticket's scope (map #270 blocks
timing-dependent work on #264).

## Caveat

`examples/hit-counts/recovery-probe.mjs` (the mock search-node probe used for
every other difficulty decision in `OPTIMIZATION_LOG.md`) only supports the
straight-frame boards (`gen_6x6.json` / `gen_9x9.json`) — it has no
`--paths`/`gen_local.json` support (confirmed: no match for `local` or
`paths` in `recovery-probe.mjs` or `_shared/frame-geometry.mjs`). There is
currently no mock-level way to estimate search-node cost for the bent-path
local board at all; app timing is the only instrument that can answer
"does revealing N clues close the search," which is why this ticket can only
hand off a ranked lever, not a verdict.

## Answer, one line

`build_size.py --paths` cannot dial shown-clue fraction or interior givens
directly today — `generate()` always drives both to their CP-SAT-minimal
extreme, and no example ever set the unused `hide_key` hook. The cheapest
real lever is hand-revealing 1–4 of the current 4 hidden ring clues (proven
safe for uniqueness, zero regeneration cost) and timing each step against the
triviality guard; interior givens and path geometry are blunter or
unexposed, and there's no mock probe to test the bent-path board short of
real app timing.
