# Exploration: spec #303 (plain fillomino)

Read-only survey for #303 and its child tickets #304-#310. No product code
touched. Written so a later worker can find every piece without re-reading
the branches.

## The spec and its tickets

- **#303** — the build-ready spec. Parent map #277; folds decisions from
  #278-#284, #288.
- **#304** — land the baseline and research branches on main (no new code).
- **#305** — example scaffold plus ladder rung 1 (island scan, seal,
  overflow, per-island walk, force, `validate`).
- **#306** — the generator (`sample`, `unique`).
- **#307** — freeze the fixture set under the baseline.
- **#308** — rung 2, the growth test (the headline rule).
- **#309** — rung 3, cut starve with the dominator filter.
- **#310** — ship the instance, README, share checklist.

Each ticket after #304 is blocked on the one before it (#307 needs both #305
and #306). #304 is the only one with nothing to block on.

## Where each piece already lives

Everything below is **on a branch, not on main and not on this workspace
branch**. `git merge-base main HEAD` is `HEAD` itself — this workspace branch
carries zero commits ahead of main. #304's job is to move all of this onto
main.

| Piece | Branch | Path |
| --- | --- | --- |
| Vendored baseline (verbatim SudokuFan component) | `issue-281-fillomino-baseline` | `docs/research/fillomino-baseline/` |
| Region-vocabulary glossary commit | `issue-281-fillomino-baseline` (commit `5bdf6ea`) | `CONTEXT.md` §Glossary, + isofill rename |
| ISOFILL-transfer research doc | `research/isofill-transfer` | `docs/research/fillomino-isofill-transfer.md` |
| Fillomino prior-art survey | `research/fillomino-prior-art` | `docs/research/fillomino-prior-art.md` |
| CP-SAT research doc + prototype | `research/fillomino-cpsat` | `docs/research/fillomino-cpsat.md`, `docs/research/fillomino_cpsat.py` |

**Trap:** the task brief says "find the glossary commit already on this
workspace branch." It is not there — `git merge-base --is-ancestor 5bdf6ea
HEAD` fails. The glossary commit lives only on `issue-281-fillomino-baseline`
(its third commit). Whoever does #304 must cherry-pick or merge it from that
branch, not assume it is already present.

**Trap:** the four branches diverged from an old point on `main` and each
carries ~100 files of unrelated diff noise (StandardJS/backend refactors that
already landed on `main` a different way — `global-backends.test.mjs`
deletions, `gen.json` → `gen_9x9.json` renames, etc.). Landing #304 by merge
would reintroduce reverted work; the real payload on each branch is small —
see the "Path" column above. Diff each branch against its own merge-base with
main, not against tip-of-main, to see the true payload:
`git diff $(git merge-base main <branch>)..<branch> -- <path>`.

## The region-vocabulary glossary (commit `5bdf6ea`)

Renames `blob` → **island** repo-wide (GitHub `/blob/` URLs untouched), makes
the region-building terms size-generic (`CONTEXT.md` §Glossary), and adds the
fillomino-only terms the design tickets already use: **island**'s `k - p`
remainder, **walk** indexed per island, **silent region**, **growth test**.
Rebuilds all ten isofill links (one `//!` comment ships inside the link
blob). Later fillomino code and docs must use these exact names — `region`,
`island`, `walk`, `cut`/**starve** (strand does not survive to fillomino —
see the transfer doc §4), **door**, **silent region**, **growth test**,
**budget** (per-island demand half only — see transfer doc §8).

## The ISOFILL-transfer doc (`fillomino-isofill-transfer.md`, 501 lines)

Per-rule verdict on which ISOFILL deduction survives when region size is
digit-dependent instead of fixed at 10. Ten numbered sections (§1-§9) plus a
summary (§10) and open questions. What #284's ladder cites section-by-section:

- §1 Cap, §2 Force — survive, restated per island (rung 1).
- §3 Seed walk — survives restated; of its three readings only one survives
  (rung 1's walk).
- §4 Cut — **starve survives, strand dies** (two islands of one digit need
  not share a region under fillomino's separation rule — rung 3).
- §5 Tour — dies, vacuous. Confirms #303's "not built" list.
- §6 Silent — survives and **generalizes into the growth test**, the biggest
  single win (rung 2, the headline rule, "the demo of the silent-region win"
  in #308's acceptance criteria).
- §7 Perimeter — topology survives, digit-indexed rule dies, island-indexed
  rule survives (but #303 defers it: "no known firing board at digit cap ≤
  9").
- §8 Budget — covering half dies, demand half survives heavily restated (also
  deferred per #303, "gated on the residual prune's saturation guard").
- §9 `validate` — simpler in fillomino than ISOFILL.

## The prior-art survey (`fillomino-prior-art.md`, 284 lines)

Five named rules from published solvers (a LIACS thesis, puzzle-magazine.com),
each with a section: Single-Exit Group, Structurally Forced Cells,
Reachability-Based Number Deduction, same-size adjacency as active pruning,
forced extension among same-digit givens. §"What ISOFILL has that does not
transfer" and §"Answer to the ticket's four call-outs" cross-check against
the transfer doc. #303's "not built" list names two of these directly
(structurally forced cells: "parked, hard cap on `k`"; the walk's outside/
missed-placed readings: "dead under fillomino's two-fold indexing").

## The CP-SAT prototype (`fillomino-cpsat.md` + `fillomino_cpsat.py`, research-only)

Model: `x[p]` = digit in cell `p`; `rid[p]` = region id (root's cell index,
`rid[p] <= idx(p)` kills root-choice symmetry); `root[p]`; one flow variable
per cell, conserved only across same-digit edges. Separation (two same-size
regions may not touch) is what lets the model skip an explicit region count —
a same-digit connected component *is* a region, so "cell count == digit" is
the whole rule. Checked against a solver-free flood fill on small boards, not
against itself (the standing rule in `docs/testing-and-generation.md`).
Measured runtimes section: 9x9 digits 1-9, worst proof **69 s**, not the
"18 s" an earlier commit on the same branch reported before six more seeds
were run (`research/fillomino-cpsat` has two commits: `ae2e225` builds the
model, `34e4e86` widens the seed sample and corrects the number). §"What this
does not answer" flags gaps a shipped generator must close.

**Trap:** the file header says explicitly "Research, not shipped." #306's
generator is *grown from* this prototype per #280/#288, not a copy — it needs
the `{grid, clues}` output shape ISOFILL's checker already prints (see below),
independent board-side/digit-cap arguments, and a raised `TimeoutError` that
is never treated as a verdict. The prototype's own CP-SAT greedy strip stays
here, unshipped — #306/#307 strip in the app instead (`app-strip.mjs`), per
spec.

## The vendored baseline (`docs/research/fillomino-baseline/`)

The catalog's SudokuFan component, decoded **verbatim** from
`docs/catalog.md` row 55 and never tidied — `console.log`, `==`, `.includes`
scans and all, StandardJS-`ignore`d in `package.json` the same way
`numbered-rooms/original/` and `skyscraper/original/` are.

- Lives **outside `examples/`** on purpose: `check_layout.py` requires the
  full eight-file example set, and a half-built `examples/fillomino/` would
  fail `just check` before the real component exists. It moves nowhere —
  #303/#304 keep it at `docs/research/fillomino-baseline/` permanently as the
  strength gate's reference side and the published record.
- `time_example.py` resolves relative to `examples/`, so it is driven with a
  relative path: `just time ../docs/research/fillomino-baseline`.
- Files: `main.js`, `FillominoComponent.js` (verbatim, ~91 lines),
  `gen.json` (6x6, 12 givens, read out of the decoded link by script — not
  transcribed), `build_link.py` (rebuilds the link; `--component` swaps a
  candidate in, `--board` swaps a component into a committed link), one
  `README.md`.
- **Trap already recorded in its own README:** the component
  `console.log(islands)`s on every `update` call. On a board slow enough to
  time, that log dominates the measurement — the README flags deciding
  whether a **log-free variant** is the fairer comparison, and #307's
  acceptance criteria already commit to it ("Baseline `just time` rows
  ...(log-free variant, named as such)"). Whoever builds the fixture-set
  baseline rows in #307 must strip or silence that log first, and say in the
  record which variant produced the numbers.
- The current baseline board (6x6, 12 givens) "cannot rank anything" — 100 ms
  cold, 0 ms after-logical, a smoke test only. A board that actually ranks a
  fillomino component does not exist yet; that is #306 (generator) and #307
  (frozen fixtures) — not a decision to make from this baseline board.
- What it deduces, per its own README: floods each placed island; stops on
  overflow; seals a finished island's border; floods reachable cells and
  stops if that set is smaller than the digit; assigns the reachable set when
  it equals the digit exactly; forces growth with one frontier cell left;
  drops a frontier candidate that would overflow. Nothing runs on a region
  with no placed cell — the gap the growth test (rung 2) exists to close.

## `compareStrength`, the strength-gate harness

Lives in `examples/_shared/harness-lib.mjs` (`compareStrength`, exported
alongside `installGlobals`, `makeIo`, `makeRng`, `fixpoint`,
`randomCandidates`). ISOFILL's own use is the prior art:
`examples/isofill/update-strength.test.mjs` imports it and calls
`compareStrength(cur, ref, apply, start)` inside a `just check`-run test.
`ref` is the baseline side. #305's acceptance criteria call for gate "half
one" (never fewer candidates than baseline) from rung 1; #308 adds "half
two" (more somewhere) once the growth test lands — matching #303's binding
note that rung 1 alone never ships as the finished component.

## `app-strip`, the greedy-clue-removal tool

`examples/_shared/app-strip.mjs` (documented in `docs/real-app-timing.md`).
Drives the live app's own puzzle editor (not a fresh browser per trial):
click a given cell, delete, click "Find all solutions and valid candidates",
read the verdict; `unique` keeps the removal, anything else restores the
digit as a given. Writes `{"grid": [...], "clues": [[r,c], ...]}` after every
successful removal — the exact shape the CP-SAT prototype and #306's
generator use. A `timeout` rung's clue set also lands in
`<out>.timeout-<n>.json` for a follow-up CP-SAT check. Verified against
`examples/isofill/PUZZLE_LINK.txt` (35 givens, three seeds, ~8 s/trial).
#307 runs this **under the vendored baseline component** (our component must
not exist in the app during that strip); #310 runs it again under the
finished, shipped component.

## Layout-checker exemption lists

`examples/_shared/check_layout.py` (constants near the top):

- `NO_LOCAL_GLOBAL_SPLIT = {"isofill"}` — no `main-global.js` /
  `PUZZLE_LINK_local.txt` / `gen_local.json` required.
- `NO_RULES_PREFIX = {"isofill"}` — link comment must *not* say "Normal
  sudoku rules apply on the inner grid."
- `MERGED_AWAY = {"numbered-rooms-lines": "numbered-rooms"}` — a folded-away
  directory name that must never come back.

#303/#305 add `"fillomino"` to **both** `NO_LOCAL_GLOBAL_SPLIT` and
`NO_RULES_PREFIX` — fillomino is global-only (no drawn groups, so no local
lane at all — unlike isofill it will not even get a `PUZZLE_LINK_local.txt`)
and not sudoku. `examples/_shared/check_layout.test.py` is the test that
must gain coverage for these two new entries, per #303's testing decisions.

## The eight-file example layout fillomino must satisfy

Per `docs/example-layout.md`, joined with the two exemptions above (so no
`main-global.js`, no `*_local.txt`, no `gen_local.json` — the isofill
pattern, not the split-example pattern):

`README.md`, `main.js`, `<Name>Component.js` (at least one),
`build_link.py`, `build_link.test.py`, `soundness-harness.mjs`,
`update-strength.test.mjs`, `OPTIMIZATION_LOG.md`, `PUZZLE_LINK.txt`.
Optional, used by isofill and likely wanted here: `.golden/`,
`recovery-probe.mjs`, `build_size.py`, `rebuild_size.py`, `verify.py` (manual
`just verify-isofill`-style recipe, not in `just check`).

`just check` runs `check_layout.py` last inside its `test` recipe, after
every `*.test.mjs`/`*.test.py` in every example dir and the shared harness
tests — a missing required file or a bad link name fails the gate there.

## `just` recipes relevant to this work

- `just check` = `lint test soundness` — the full gate.
- `just test` — discovers `*.test.mjs`/`*.test.py` by file name per example
  dir, plus the shared-lib tests and `check_layout.py`/`.test.py`.
  `verify.py` is deliberately excluded (slow CP-SAT) — run by hand.
- `just soundness` — discovers `soundness-harness.mjs` per example dir by
  file name; no justfile edit needed once `examples/fillomino/` exists.
- `just verify-isofill` — the manual-recipe pattern fillomino's own `verify`
  step (if any, per-fixture) should probably follow, but is not itself
  wired for fillomino; a fillomino equivalent (if built) needs its own
  recipe or hand invocation, per #307/#310's "one CP-SAT proof" language.
- `just time <example>` — not yet demonstrated against `examples/fillomino`
  (doesn't exist); against the baseline it is invoked with the relative path
  `../docs/research/fillomino-baseline`, as noted above.

## Prior art: the isofill example, structurally

`examples/isofill/` is the closest sibling (global constraint, no groups,
region-building). Its file set: `main.js` (registers one component over
every cell, no `input.groups`), `IsofillComponent.js` (whole-grid `update`:
count-prune, seed walk, cut, tour, silent, perimeter, budget; a `validate`
leaf check), `soundness-harness.mjs`, `update-strength.test.mjs`
(`compareStrength` against nothing — isofill has no baseline reference other
than itself; **fillomino's version has a real reference: the vendored
baseline**), `cut-profile.mjs` + `.test.mjs` (per-rule wall-time profiling —
worth reusing for ranking fillomino's rungs per #303's testing decisions:
"a rung that moves nothing on the frozen set earns one purpose-built fixture
or stays unmerged"), `cut-filter.test.mjs` (the dominator-tree filter #309
transfers "verbatim"), `verify.py` (manual CP-SAT uniqueness, run via `just
verify-isofill`), `build_hard_links.py`, `OPTIMIZATION_LOG.md` (56 KB
README — the shape #310 wants fillomino's README to land in: "ISOFILL's
shape... rung by rung, timing tables, generator knobs, how to paste in").

**Trap:** isofill's `update-strength.test.mjs` and README both still say
"blob" in older prose before the glossary rename lands — but the rename
commit already exists (see above) and rewrites `IsofillComponent.js`,
`OPTIMIZATION_LOG.md`, `PUZZLE_LINK*.txt` (ten links rebuilt), README, and
`soundness-harness.mjs` to say "island." Building fillomino before #304
lands that commit means writing against soon-to-be-stale isofill vocabulary;
land #304 first.

## Other traps for later workers

- **No worktree is a rule, not a suggestion.** `AGENTS.md`: every session
  works in its own worktree, always, even for read-only exploration that
  "turns into" an edit. This exploration ran in this task's own workspace
  worktree.
- **Never print a puzzle link in chat** — write to `PUZZLE_LINK*.txt` or a
  temp file, report the path (`AGENTS.md`).
- **Non-given cells must ship `{}`.** Verified by `check_layout.py` decoding
  every `PUZZLE_LINK*.txt`; also the second bullet of `docs/share-checklist.md`.
- **The ring-not-fully-filled gate** exists but fillomino's board has no ring
  concept the way outside-clue puzzles do — the gate still runs, harmlessly.
- **Soundness and pay-for-itself timing bind every rung**, per `CLAUDE.md`
  and `AGENTS.md` — not just the finished component. Each of #305/#308/#309
  re-runs `just soundness` and (once there's a component to time) `just time`.
- **The strength gate's two halves split across rungs**: rung 1 needs "never
  fewer than baseline" only; rung 2 must additionally show "more somewhere."
  A `compareStrength` test written for rung 1 that already asserts strict
  improvement will fail before rung 2 exists — write it to match the rung,
  not the finished spec.
- **CP-SAT timeout must never read as "unique."** Both the generator (#306)
  and the fixture-freeze (#307) and the ship step (#310) repeat this
  independently — it is a recurring requirement, not stated once.
- **The rule has one home, but three copies that must agree**: the JS
  component, the CP-SAT model, and the soundness harness restate the same
  rule independently (`CODING_STANDARDS.md` "The rule has one home") — change
  one, change all three in the same diff.
