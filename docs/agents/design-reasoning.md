# Design reasoning

How to argue a design call in this repo.

- **Argue design calls on merits, never on "no puzzle uses it."** The supported
  constraint set is small and grows on demand, so "no existing puzzle needs X"
  is circular — unsupported is not the same as unneeded. Justify a scope,
  deferral, or modeling call by soundness, model coherence, code cost, or the
  domain semantics of the constraint instead. When a stronger deduction costs a
  few lines and stays sound, that is the argument for adding it — not whether a
  current puzzle happens to exercise it.
