# Coding standards

The rules a change to a constraint (or its tests and generators) must satisfy.
`just check` gates the mechanical part — StandardJS on the Node code, ruff on
the Python generators, the probe goldens, and the soundness fuzz. The rules
below are the part a gate cannot judge: a human reviewer or an agent reads them
off the diff. StandardJS lints the `.js` constraint snippets too; the
exclusions are the vendored files kept for comparison — the `original/`
snippets and `docs/research/fillomino-baseline/` — which must stay
byte-for-byte as their author wrote them, plus that baseline's
`FillominoComponentNoLog.js`, the same vendored code minus its one
`console.log`, kept in the vendor's style so the timing comparison stays
apples-to-apples. `package.json`'s `standard.ignore` is the list.
Thin on purpose: the
load-bearing detail lives in `docs/`, and each rule points there.

## Soundness is the invariant

- **A component's `update` must never remove a candidate the true solution
  needs.** This is the one rule that, when broken, silently corrupts a puzzle:
  the app shows no error, the solver just rules out the answer. Every change to a
  component re-runs the soundness harness and expects **zero** violations across
  a large random sample. See `docs/testing-and-generation.md` and
  `examples/running-start/soundness-harness.mjs`.
- **A weak deduction is fine; an unsound one is a bug.** If the component cannot
  prove a candidate is impossible, it leaves it. Removing a candidate you cannot
  justify from the filled cells is the failure mode — not leaving one you could
  have removed.

## The rule has one home

- **State the constraint once, and make every copy agree.** The rule lives in
  the JS component, in the CP-SAT model that proves uniqueness, and in the
  soundness harness. These cannot share code — one runs in the browser, one in
  Python — so they drift silently: a fix in the component, an old rule in the
  model, and the uniqueness proof now describes a different puzzle than the app
  enforces. When you change the rule, change all three in the same diff. See the
  modeling note at the end of `docs/testing-and-generation.md`.

## Fail loud, never silently no-op

- **A call that can silently do nothing is a trap — verify it or avoid it.** The
  SudokuMaker API has calls that fail without a word: `replaceComponent` with a
  *custom* target silently does nothing (see `docs/gotchas.md`). Prefer a design
  that cannot misbehave in silence; where the API gives no signal, prove the
  behavior off the app before relying on it.

## Argue design calls on merits, not "no puzzle uses it"

- See `docs/agents/design-reasoning.md`. The supported constraint set is small
  and grows on demand, so "nothing needs this yet" is circular.

## A deduction must pay for itself in solve time

- **Trigger:** a deduction added to or removed from a component's `update`.
- **Tool:** `just time <example>` (`--ring-clues` for an example whose clues
  sit in the ring: Numbered Rooms, Skyscraper).
- **Bar:** the two-row rule — every fixture gets a cold row and an
  after-logical row, and a change ships at ≤ 0.9× on either row and ≤ 1.1× on
  the other, 3 reps, non-deterministic solve off.
- **Record:** paste both printed rows into the example's README, `## Timing`.
- Full method, stripping rules, and caveats: `docs/real-app-timing.md`.

## Tests assert an observable outcome

- **No test that only proves the code ran.** A soundness harness asserts zero
  removed true candidates; a generator asserts a *unique* solution (no second
  solution exists), not merely that one solution was found. A run with no
  assertion is worse than no test. See `docs/testing-and-generation.md`.

## Comments describe the code, not its history

- Write what the code *does* and *why*, for the reader in front of the current
  code. Cut the diff-against-a-version-nobody-can-see: "used to," "no longer,"
  "replacing X," "same as before." Git holds that story. When you change code,
  delete the comment that described the old shape in the same diff.

## Style

- Boring over clever. The reader at 3am wins.

## Per-call cost patterns

- Writing or tightening an `update`? See `docs/agents/per-call-cost.md` for
  ISS's `enforceConsistency` cost patterns (bitmask state, scratch buffers,
  bit idioms) and where SudokuMaker's shipped Skyscraper DP departs from them.
