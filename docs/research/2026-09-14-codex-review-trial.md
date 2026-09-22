# Codex adversarial-review trial (#812): rows for this repo

The controller runs a Codex adversarial pass on every heavy Claude-lane PR at merge time (implement/SKILL.md § The merge, step 3) and records one row per PR here: counts per class of what Codex found against Claude's own round-1 findings, and one line per codex-only confirmed finding. The trial's other repos keep their own copies of this table.

| Ticket | PR | codex-only confirmed | also found by Claude | disputed | Notes |
|---|---|---|---|---|---|
| #598 | #599 | 0 | 0 | 0 | Verdict approve, no findings, at both phases (early at 4fb3c5e refused as stale after the C1 fix commit; gate-retry at d73c4aa collected). Claude round 1: 5 findings, 4 fixed, 1 disputed. |
| #593 | #600 | 0 | 0 | 0 | Verdict approve, no findings. No early phase: "Round 1 out" never reached the controller, so the one run launched at the gate (phase recorded as gate-retry, 2f3838c, collected). Codex independently re-verified all ten grids against sudoku, rank tables and clues. Claude: round 1 (pre-#598) 15 findings all fixed then superseded; round 2 10 findings all fixed. |
