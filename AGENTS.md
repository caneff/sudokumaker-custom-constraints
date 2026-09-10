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

## Renbanana chocolate facts are precalculated (always on)

- **Never re-derive a chocolate rectangle fact the catalogue already holds.**
  `docs/research/renbanana/rectangle-catalogue.json` enumerates, per shape and
  per box offset, which placements can be filled at all, the per-cell digit
  domains, and which cells can carry a circle. Every generator question about
  a chocolate rectangle is answered from it, in stage 1 and stage 3 alike —
  not left for the solver to search out on each shading.
- It is layer B (the rectangle plus the boxes, nothing outside), so a real grid
  only narrows its answers. That is what makes reading it sound.
- `docs/research/renbanana/tools/test_catalogue_is_used.py` fails if a call
  site drops it. Run it after touching `renbanana_cpsat.py`.

## Solver runs stay off the machine's back (always on)

- **One hunt at a time, and `--workers 1` unless told otherwise.** This box is
  a WSL2 VM other agents share; oversubscribing it has hung the desktop. Check
  `uptime` before launching anything, and never let the total worker count
  approach the core count — leave most of the cores for everyone else.
- Long runs go under `job-run --name <n>` and append to a progress file, so a
  kill does not lose the result.

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
  that sets `comment` itself must add the sentence. Exception: isofill is not
  sudoku and skips the line.

## Commands

- **Full gate — run before calling any task done:** `just check`
- Lint + auto-fix: `just fmt` (StandardJS on `.mjs`, ruff on the Python generators)
- Probe goldens: `just test` — Soundness fuzz: `just soundness`
- Real-app timing for one example: `just time <example>` — prints a
  paste-ready row; drives the live site, so it stays out of `just check`. See
  `docs/real-app-timing.md`.
- **A browser-driving probe runs in the local session, never a sandboxed
  delegate.** `just time`, `app-solve.mjs`, `app-strip.mjs` and any Playwright
  probe need Chromium and a writable profile. The Codex rescue companion pins
  `sandbox: read-only` unless the call passes `--write`, and even
  `workspace-write` has no network by default, so such a run dies before the
  puzzle loads. Delegate the reading and the reasoning; drive the browser here.
- Node dev tools install with `npm ci`; Python runs through `uv`.

## Pointers

- Coding + testing standards → `CODING_STANDARDS.md`
- Component contract, gotchas, puzzle API → `docs/component-contract.md`, `docs/gotchas.md`, `docs/puzzle-api.md`
- Testing + generation → `docs/testing-and-generation.md`
- Example layout: required files, link grammar, board naming, the shared
  frame reader and its `#include` → `docs/example-layout.md`
- Sharing a puzzle link: the pre-share criteria → `docs/share-checklist.md`
- What the live app says about every frame link → `docs/frame-link-verdicts.md`
- Design reasoning → `docs/agents/design-reasoning.md`
- Reading ISS (the closest public solver) → `docs/agents/iss.md`

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default six canonical triage roles, each label string equal to its name. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## SudokuMaker links (always on)

Load the global `sm-link` skill before generating, editing, or sharing a SudokuMaker link. It holds the givens/ring/pencilmark rules, the pre-share decode check, and the sudokumaker.app wire-format pointers (single home, moved from vault memory in second-brain-v2 #140).
