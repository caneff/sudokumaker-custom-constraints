# Codex adversarial pass: durations and outcomes

One row per run of the controller's Codex pass (implement/SKILL.md § The merge, step 3), collected or refused. `early` launches at the worker's "Round 1 out"; `gate-retry` reruns at the merge gate when the early verdict was refused (errored, raced, or stale against the PR head); `second` is #888's conditional second pass. Outcome is `collected`, `collected-after-retry`, or the refusal that discarded the run. The number this file exists to produce: how often the early launch pays.

| Ticket | PR | Phase | Launched | Completed | Minutes | Outcome |
|---|---|---|---|---|---|---|
| #598 | #599 | early | 2026-09-22T06:23:14-04:00 | 2026-09-22T06:24:07-04:00 | 0.9 | refused: stale — head moved from 4fb3c5e to d73c4aa (C1 fix commit) before the gate |
| #598 | #599 | gate-retry | 2026-09-22T06:31:23-04:00 | 2026-09-22T06:32:15-04:00 | 0.9 | collected-after-retry |
| #593 | #600 | gate-retry | 2026-09-22T06:48:46-04:00 | 2026-09-22T06:50:52-04:00 | 2.1 | collected (no early phase existed; the worker never sent "Round 1 out") |
| #601 | #602 | early | 2026-09-22T09:01:09-04:00 | 2026-09-22T09:02:30-04:00 | 1.4 | refused: stale — head moved from b8bd6ce to 743df15 (review fixes and the verdict note) before the gate |
| #601 | #602 | gate-retry | 2026-09-22T09:15:59-04:00 | 2026-09-22T09:17:10-04:00 | 1.2 | collected-after-retry |
| #603 | #604 | gate | 2026-09-24T08:52:19-04:00 | 2026-09-24T08:53:35-04:00 | 1.3 | collected |
| #605 | #607 | gate | 2026-09-26T09:30:24-04:00 | 2026-09-26T09:31:23-04:00 | 1.0 | collected |
| #605 | #607 | second | 2026-09-26T09:33:09-04:00 | 2026-09-26T09:34:09-04:00 | 1.0 | collected |
| #457 | #609 | gate | 2026-09-26T09:49:23-04:00 | 2026-09-26T09:51:18-04:00 | 1.9 | collected |
| #586 | #610 | gate | 2026-09-26T09:52:17-04:00 | 2026-09-26T09:53:01-04:00 | 0.7 | collected |
| #452 | #612 | gate | 2026-09-26T09:53:55-04:00 | 2026-09-26T09:55:08-04:00 | 1.2 | collected |
