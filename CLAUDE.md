@AGENTS.md

## Coding invariants (always on)

- **A component's `update` must never remove a candidate the true solution
  needs.** Soundness is the one rule that fails silently — the app shows no
  error, the solver just rules out the answer. Re-run the soundness harness on
  every constraint change and expect zero violations.
- **A deduction must pay for itself in solve time.** Sound and tighter is not
  enough. Time it end-to-end in the real app (`docs/real-app-timing.md`), on a
  grid stripped to its givens — no entered values, no pencil marks — so the
  solver searches. A verdict "based on already entered values" is not a timing. A stronger
  `update` that costs more per call than the search it saves gets removed — as
  `NumberedRoomsPairComponent` was, for tripling the real solve time.

Touching code? Read `CODING_STANDARDS.md` for the full standards.
