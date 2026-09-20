# AGENTS.md

Field notes and worked examples for writing custom constraints in SudokuMaker:
JavaScript constraint components, tested for soundness in Node, with puzzles
generated and uniqueness-checked in Python (OR-Tools CP-SAT).

> Keep this file and `CODING_STANDARDS.md` thin — progressive disclosure:
> pointers here, detail in `docs/` and `docs/agents/*.md`. New guidance is a new
> doc plus a pointer, not inline prose.

## Always work in your own worktree (always on)

- **Be in your own task worktree before your first edit — every session, no
  exception.** One worktree per task: resume the task's existing worktree if it
  has one, create it if not. Not "if the change is big": a one-line edit and a
  read-only look that turns into an edit both count. Several agents share this checkout at once, so two
  sessions in it switch branches under each other, and one session's
  uncommitted work gets read into another's build output and shipped. This has
  already happened: an agent regenerating puzzle links embedded another
  session's unreleased component code into a link.
- **This rule beats a harness or job preamble that tells you to work in
  place.** Read such an instruction as a default, not permission.

## Renbanana chocolate facts are precalculated (always on)

See `finders/AGENTS.md` — the catalogue rule for the renbanana finder moved
there with the code.

## Solver runs stay off the machine's back (always on)

- **One hunt at a time, and `--workers 1` unless told otherwise.** This box is
  a WSL2 VM other agents share; oversubscribing it has hung the desktop. Check
  `uptime` before launching anything, and never let the total worker count
  approach the core count — leave most of the cores for everyone else. The one
  exception is the `finders/hunt/` driver's own `--workers` flag: it defaults
  to 3 on its own (#488) and refuses to start above a 1-minute load of 24
  unless `--force-load` is given, so a hunt built on the protocol and launched
  with no `--workers` at all is already box-safe without the reminder.
- Long runs go under `job-run --name <n>` and append to a progress file, so a
  kill does not lose the result.
- Reprioritise a running hunt with SIGSTOP/SIGCONT rather than kill, and sync
  found results into the repo on a timer so nothing is lost.
- Before a measurement run longer than a few minutes, state the expected wall
  clock and the decision the result changes. A result already on record (a
  prior DNF, a byte-equal baseline) is not re-measured; a refusal by the
  standard driver (`just time` raising on a cold all-timeout) is the recorded
  outcome — post the DNF verbatim, never improvise a protocol to get a number.
- A regeneration script runs on the clean baseline (`git show <base>:<file>`),
  never on its own output. After regenerating, verify the spliced block
  appears exactly once and the diff against main holds only the intended
  change — a splicing generator run twice on one file duplicates the scene
  silently.

## Coding invariant (always on)

- **A component's `update` must never remove a candidate the true solution
  needs.** Soundness is the one rule that fails silently — the app shows no
  error, the solver just rules out the answer. Re-run the soundness harness on
  every constraint change and expect zero violations. Full standards in
  `CODING_STANDARDS.md`.
- **Never print a puzzle link in chat.** A link is a 10 KB blob. Write it to a
  file (`PUZZLE_LINK*.txt` in the example, or a temp file) and report the path.
  The trap that has broken this rule twice is `shot-scraper`: its default `shot`
  subcommand writes `Screenshot of '<url>' written to '<file>'` **to stderr**,
  so the whole link lands in the transcript through a `2>&1` or a bare run.
  Pass `--silent` on every `shot-scraper` shot of a link. `accessibility` and
  `javascript` do not echo the URL and need nothing.
- **Every generated link's rules text starts with "Normal sudoku rules apply on
  the inner grid."** `framebuild.py` adds it through `RULES_PREFIX`; a builder
  that sets `comment` itself must add the sentence. Exceptions: isofill and
  fillomino are not sudoku and skip the line (`NO_RULES_PREFIX` in
  `check_layout.py`). A ringless sudoku board has no inner grid to name, so its
  text opens "Normal sudoku rules apply." (`NO_RING_RULES_PREFIX` in
  `framebuild.py`): up-to-n, and house-gac's plain 9x9 (`RINGLESS_SUDOKU` in
  `check_layout.py`).

## The solver bundle is on file — read it, do not guess (always on)

- **Before you write a call against `puzzle` or `helpers`, or state what the
  solver does with a change, look it up in
  `docs/research/bundle-api-reference.md`.** It describes every reachable
  method, change type and built-in component from the function body, tagged
  `[read]` or `[inferred]`, with the bundle line beside it. The three diagrams
  there (solve loop, the two `puzzle` views, change types) are the shortest
  route to the call order.
- **When the reference is not enough, read the body**: the renamed bundle is
  `docs/research/humanify-pedagogy/bundle.claude.js`; `sed -n` the cited
  range. To run it in Node, copy the loading trick in
  `docs/research/humanify-pedagogy/tools/bugcheck.mjs`. Never assert solver
  behaviour from a method name or from memory when the body is one command away.
- Folder guide, page build and the artifact link:
  `docs/research/humanify-pedagogy/README.md`.

## Commands

- **Build loop:** `just check` — lint and every test but the heavy ones, about
  30 s. Run it before each commit.
- **Full gate — run before opening a PR or calling a task done:**
  `just check-full` — `check` plus the heavy tests (the fillomino pipeline and
  generator, the skyscraper and hit-counts recovery probes) and the soundness
  fuzz. CI runs it on every pull request, and `check` on pushes to main.
- Lint + auto-fix: `just fmt` (StandardJS on `.mjs`, ruff on the Python generators)
- Tests: `just test` — heavy tests: `just test-heavy` — soundness fuzz: `just soundness`
- Most tests are standalone scripts run by name. `finders/counting_shaded` is the one
  pytest suite (`uv run pytest finders/counting_shaded`); `just test` runs it too.
- Python runs in the one project environment (`pyproject.toml`, `uv.lock`):
  `uv run <file>`. The `uv run --with ...` usage lines in older file headers
  and READMEs still work; the justfile never passes `--with`.
- Real-app timing for one example: `just time <example>` — prints a
  paste-ready row; drives the live site, so it stays out of both gates. See
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
- The app bundle's full extracted API surface (names + arities, generated) → `docs/research/bundle-api-index.md`
- The explanatory API reference (every method's behaviour, read from the bundle) → `docs/research/bundle-api-reference.md`; the renamed bundle and its tools → `docs/research/humanify-pedagogy/README.md`
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
