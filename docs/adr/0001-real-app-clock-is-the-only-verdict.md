# 0001: The real-app clock is the only verdict

## Context

A component's `update` can be sound and still not worth adding: it can cut
search nodes in our mock solver and cost more time per call than it saves.
Each example ships a mock probe (`recovery-probe.mjs`) that times a GAC + DFS
solver we wrote and counts nodes cut. SudokuMaker runs its own solver, and a
custom component's `update` runs inside that solver, not inside our mock. The
two have disagreed in practice: Numbered Rooms' `NumberedRoomsPairComponent`
cut nodes in the mock, then tripled the real solve time in the app.

## Decision

The real app's own solve-time readout is the only verdict on whether a
deduction pays for itself. The mock probe measures deduction strength —
candidates recovered, nodes cut — never speed. A change that looks faster in
the mock still needs a `just time <example>` run against the real app before
it counts as a win. See `docs/real-app-timing.md` for the protocol.

## Consequences

- A stronger deduction can still be rejected after a real-app timing shows no
  gain or a regression, even with a clean mock result.
- Every solve-time claim in an example README or issue must cite a
  `just time` row, not a mock node count.
- The mock probe stays useful for soundness and strength, not for a
  keep-or-drop call on speed.
