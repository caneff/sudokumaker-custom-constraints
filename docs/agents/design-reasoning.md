# Design reasoning

How to argue a design call in this repo.

- **Argue design calls on merits, never on "no puzzle uses it."** The supported
  constraint set is small and grows on demand, so "no existing puzzle needs X"
  is circular — unsupported is not the same as unneeded. Justify a scope,
  deferral, or modeling call by soundness, model coherence, code cost, or the
  domain semantics of the constraint instead.

- **A deduction earns its place by making the solver faster, not by being
  stronger.** Sound and strictly tighter is necessary but not sufficient. A
  deduction runs on every propagation, so its per-call cost is real; it pays for
  itself only when the search it saves outweighs the time it spends. Measure that
  the way a solver is judged: **end-to-end solve time on real puzzles, not
  deduction strength or nodes cut.** A tighter bound that prunes nothing the
  cheaper checks miss is dead weight — it slows the solver down. `Hit Counts`
  carries a worked example: a sound Régin-style matching clue bound, ~78x the
  cost of the naive tally, cut under 1% of search nodes and made solving slower,
  so it was measured and dropped. `examples/hit-counts/recovery-probe.mjs` is the
  measuring tool; reach for it before adding a deduction, not after.
