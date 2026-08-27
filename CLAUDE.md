@AGENTS.md

## Coding invariants (always on)

- **A component's `update` must never remove a candidate the true solution
  needs.** Soundness is the one rule that fails silently — the app shows no
  error, the solver just rules out the answer. Re-run the soundness harness on
  every constraint change and expect zero violations.
- **A deduction must pay for itself in solve time.** On a deduction added or
  removed, run `just time <example>`; it passes at candidate ≤ 0.9× baseline,
  3 reps, non-deterministic solve off. See `docs/real-app-timing.md`.

Touching code? Read `CODING_STANDARDS.md` for the full standards.
