# Coding standards

The rules a change to a constraint (or its tests and generators) must satisfy.
`just check-full` gates the mechanical part — StandardJS on the Node code, ruff
on the Python generators, the probe goldens, and the soundness fuzz; `just
check` is its fast subset for the build loop. The rules
below are the part a gate cannot judge: a human reviewer or an agent reads them
off the diff. StandardJS lints the `.js` constraint snippets too; the exclusions
are the vendored and frozen files named in `package.json`'s `standard.ignore`.
Thin on purpose: the load-bearing detail lives in `docs/`, and each rule points there.

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
- **Reuse the shared helper; never write a second copy.** A copy drifts the
  first time the original is fixed, and nothing flags the stale one. When
  `examples/_shared/` already does the job, call it; when it almost does,
  extend it.

## Fail loud, never silently no-op

- **A call that can silently do nothing is a trap — verify it or avoid it.** The
  SudokuMaker API fails without a word in the UI: a throw in main code or in
  `update` is caught and goes to `console.error` only, so a "fail loud" `throw`
  is loud in the Node harness and invisible in the app, and a throw inside a
  registration loop leaves the constraint half-registered. A sibling custom
  class spelled bare instead of `customComponents.Name` throws the same way
  (`docs/gotchas.md` #1). Prefer a design that cannot misbehave in silence:
  a build-time check, `puzzle.stop()` for a solve-time refusal, and where the
  API gives no signal, prove the behavior off the app before relying on it.
- **A script refuses bad input with a named reason; it never skips it in
  silence.** A skipped file or a swallowed exception turns into a result that
  looks complete and is not.

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
- **A test must go red when the bug it names is planted.** A witness that
  passes against the broken code proves nothing and reads as coverage. Plant
  the bug once before you trust the test. A test of a refusal or a subprocess
  checks both the exit status and the reason it printed, because a crash for
  an unrelated reason passes a status-only check.

## A solver's UNKNOWN is not an answer

- **A solver's UNKNOWN or timeout is never "no solution" and never a pass.**
  Only a proven INFEASIBLE rules a case out. See
  `docs/agents/grid-finder-lessons.md`.

## Comments describe the code, not its history

- Write what the code *does* and *why*, for the reader in front of the current
  code. Cut the diff-against-a-version-nobody-can-see: "used to," "no longer,"
  "replacing X," "same as before." Git holds that story. When you change code,
  delete the comment that described the old shape in the same diff.
- **A diff that makes a doc, docstring, header or README false fixes it in
  the same diff.** A stale claim does not fail any gate; the next reader acts
  on it. Grep the names and paths you changed before calling the diff done.
- **A comment, docstring or test name claims no more than the code
  delivers.** "Checks every link" over a top-level scan, or a test named for
  a case it never builds, tells the reviewer the gap is covered.
- A comment-kept annotated-link component keeps its commentary: that text is
  what the link's recipient reads (#732).

## Style

- Boring over clever. The reader at 3am wins.
- **Name things with `CONTEXT.md`'s terms.** A synonym splits one concept
  into two in the reader's head, and a name that shadows another misleads
  every grep.
- **No parameter, flag or function that nothing calls.** Most of the code
  holds to this; a few defaulted parameters still have no caller. An unused
  option is a promise nobody tests, and it rots the first time the code
  around it changes.

## Per-call cost patterns

- Writing or tightening an `update`? See `docs/agents/per-call-cost.md` for
  ISS's `enforceConsistency` cost patterns (bitmask state, scratch buffers,
  bit idioms) and where SudokuMaker's shipped Skyscraper DP departs from them.
