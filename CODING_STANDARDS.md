# Coding standards

The rules a change to a constraint (or its tests and generators) must satisfy.
`just check` gates the mechanical part — StandardJS on the Node code, ruff on
the Python generators, the probe goldens, and the soundness fuzz. The rules
below are the part a gate cannot judge: a human reviewer or an agent reads them
off the diff. StandardJS lints the `.js` constraint snippets too; the only
exclusions are the verbatim `ORIGINAL_*`/`original/` files kept for comparison,
which must stay byte-for-byte as their author wrote them. Thin on purpose: the
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

- **A stronger deduction is worth adding only when it makes the solver faster.**
  Sound and tighter is not enough — a deduction runs every propagation, so it
  must save more search than it costs. Judge it the way a solver is judged:
  end-to-end solve time on real puzzles, not strength or nodes cut. See
  `docs/agents/design-reasoning.md` and the worked measurement in
  `examples/hit-counts/recovery-probe.mjs`. That probe times our mock, which
  counts pruning; to time the app's own solver, see `docs/real-app-timing.md`.
  The two can disagree — a deduction that cuts nodes in the mock can still be
  slower in the app.
- **Time only against a grid stripped to its givens.** A shipped link stores
  the full solution as entered values. The app solves from whatever is in the
  cells, so a run with entered values or pencil marks present is not a timing —
  the app says so in its readout: "based on already entered values and pencil
  marks". Strip the link first (`probe_link.py strip`, or `empty` for a puzzle
  whose clues sit in the outer ring as non-given values). The tools enforce
  it: `app-solve.mjs` refuses a board with entered digits unless
  `--ring-clues` is passed, and `probe_link.py` refuses to write an unstripped
  probe. Verified the hard way: ISOFILL read
  "unique in 2 s" with 36 ring values still entered, and "no verdict" without.
- **Do not benchmark an outside-clue component on a board whose ring is mostly
  specified.** A component that reads clues from the border (Numbered Rooms,
  Skyscraper, any edge-interactable) must be timed on a puzzle that leaves the
  majority of the ring cells empty, so the solver actually searches the clue
  cells. When most of the ring is already filled, a wrapper that waits for the
  clue to collapse hands off to a built-in component on the first pass, and the
  fixture measures that hand-off, not the search. Such a board flatters the lazy
  wrapper and hides where a stronger component pays off. Pick the board first;
  reject any where the ring is more than half specified.

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
