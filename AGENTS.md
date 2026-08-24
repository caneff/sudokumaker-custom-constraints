# AGENTS.md

Field notes and worked examples for writing custom constraints in SudokuMaker:
JavaScript constraint components, tested for soundness in Node, with puzzles
generated and uniqueness-checked in Python (OR-Tools CP-SAT).

> Keep this file and `CODING_STANDARDS.md` thin — progressive disclosure:
> pointers here, detail in `docs/` and `docs/agents/*.md`. New guidance is a new
> doc plus a pointer, not inline prose.

## Coding invariant (always on)

- **A component's `update` must never remove a candidate the true solution
  needs.** Soundness is the one rule that fails silently — the app shows no
  error, the solver just rules out the answer. Re-run the soundness harness on
  every constraint change and expect zero violations. Full standards in
  `CODING_STANDARDS.md`.

## Pointers

- Coding + testing standards → `CODING_STANDARDS.md`
- Component contract, gotchas, puzzle API → `docs/component-contract.md`, `docs/gotchas.md`, `docs/puzzle-api.md`
- Testing + generation → `docs/testing-and-generation.md`
- Design reasoning → `docs/agents/design-reasoning.md`

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default six canonical triage roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.
