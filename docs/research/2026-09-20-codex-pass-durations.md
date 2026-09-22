# Codex adversarial pass: durations and outcomes

One row per run of the controller's Codex pass (implement/SKILL.md § The merge, step 3), collected or refused. `early` launches at the worker's "Round 1 out"; `gate-retry` reruns at the merge gate when the early verdict was refused (errored, raced, or stale against the PR head); `second` is #888's conditional second pass. Outcome is `collected`, `collected-after-retry`, or the refusal that discarded the run. The number this file exists to produce: how often the early launch pays.

| Ticket | PR | Phase | Launched | Completed | Minutes | Outcome |
|---|---|---|---|---|---|---|
| #598 | #599 | early | 2026-09-22T06:23:14-04:00 | 2026-09-22T06:24:07-04:00 | 0.9 | refused: stale — head moved from 4fb3c5e to d73c4aa (C1 fix commit) before the gate |
| #598 | #599 | gate-retry | 2026-09-22T06:31:23-04:00 | 2026-09-22T06:32:15-04:00 | 0.9 | collected-after-retry |
| #593 | #600 | gate-retry | 2026-09-22T06:48:46-04:00 | 2026-09-22T06:50:52-04:00 | 2.1 | collected (no early phase existed; the worker never sent "Round 1 out") |
