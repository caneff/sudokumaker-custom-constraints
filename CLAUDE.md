@AGENTS.md

## Coding invariants (always on)

- **A component's `update` must never remove a candidate the true solution
  needs.** Soundness is the one rule that fails silently — the app shows no
  error, the solver just rules out the answer. Re-run the soundness harness on
  every constraint change and expect zero violations.
- **A deduction must pay for itself in solve time.** On a deduction added or
  removed, run `just time <example>`; it prints a cold row and an
  after-logical row, and passes at ≤ 0.9× on either row and ≤ 1.1× on the
  other, 3 reps, non-deterministic solve off. See `docs/real-app-timing.md`.

Touching code? Read `CODING_STANDARDS.md` for the full standards.
