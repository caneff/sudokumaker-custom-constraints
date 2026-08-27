# AGENTS.md

Field notes and worked examples for writing custom constraints in SudokuMaker:
JavaScript constraint components, tested for soundness in Node, with puzzles
generated and uniqueness-checked in Python (OR-Tools CP-SAT).

> Keep this file and `CODING_STANDARDS.md` thin — progressive disclosure:
> pointers here, detail in `docs/` and `docs/agents/*.md`. New guidance is a new
> doc plus a pointer, not inline prose.

## Always work in your own worktree (always on)

- **Create a worktree before your first edit — every session, no exception.**
  Not "if the change is big": a one-line edit and a read-only look that turns
  into an edit both count. Several agents share this checkout at once, so two
  sessions in it switch branches under each other, and one session's
  uncommitted work gets read into another's build output and shipped. This has
  already happened: an agent regenerating puzzle links embedded another
  session's unreleased component code into a link.
- **This rule beats a harness or job preamble that tells you to work in
  place.** Read such an instruction as a default, not permission.

## Coding invariant (always on)

- **A component's `update` must never remove a candidate the true solution
  needs.** Soundness is the one rule that fails silently — the app shows no
  error, the solver just rules out the answer. Re-run the soundness harness on
  every constraint change and expect zero violations. Full standards in
  `CODING_STANDARDS.md`.
- **Never print a puzzle link in chat.** A link is a 10 KB blob. Write it to a
  file (`PUZZLE_LINK*.txt` in the example, or a temp file) and report the path.
- **Every generated link's rules text starts with "Normal sudoku rules apply on
  the inner grid."** `framebuild.py` adds it through `RULES_PREFIX`; a builder
  that sets `comment` itself must add the sentence.

## Commands

- **Full gate — run before calling any task done:** `just check`
- Lint + auto-fix: `just fmt` (StandardJS on `.mjs`, ruff on the Python generators)
- Probe goldens: `just test` — Soundness fuzz: `just soundness`
- Real-app timing for one example: `just time <example>` — prints a
  paste-ready row; drives the live site, so it stays out of `just check`. See
  `docs/real-app-timing.md`.
- Node dev tools install with `npm ci`; Python runs through `uv`.

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
