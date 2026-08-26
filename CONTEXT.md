# CONTEXT

The ubiquitous language of this repo. Read this before exploring; it defines the
terms the docs and examples use, and points at the doc that holds each detail.
The rule for this file is the repo rule: load-bearing terms and invariants
inline, full detail in the `docs/` file named beside each term.

This repo is **field notes**, not a library. It records how to write a custom
constraint for [SudokuMaker](https://sudokumaker.app/) — an observed, pre-release
API — and ships one worked example end to end. Every claim is tagged
**[verified]** (we ran it), **[docs]** (community-documented), or **[unsure]**.

## Glossary

Use these terms exactly. Do not drift to synonyms.

- **puzzle doc** — the whole puzzle as one JSON object: grid, solution, and
  constraint code. It lives entirely in the `?puzzle=` URL; there is no server.
  Encoded with lz-string. See `docs/gotchas.md` (7, 8), `docs/patterns.md`.
- **custom constraint** — an author-supplied rule the solver enforces. It is
  written as **code segments** pasted into SudokuMaker's constraint editor.
- **main code** (also **backend code segment**) — runs once at setup. It reads
  the author's groups and registers components. See `docs/component-contract.md`.
- **component code** (also **component code segment**) — a set of free functions
  that define the solving logic for one kind of component. SudokuMaker turns the
  segment into a constructor named after it. You do not write a class.
- **component** — one instance of a component code segment, registered with
  `puzzle.addConstraintComponent(...)`. The solver runs its functions during the
  solve. A rule may register one component or many.
- **the five lifecycle functions** — `getAffectedCells`, `setParams`,
  `initialize`, `update`, `validate`. Define the ones you need. Full signatures
  and call order in `docs/component-contract.md`.
- **update** — the propagation loop. A generator that `yield`s **Changes**; the
  solver applies each and re-runs until nothing more changes. The working half of
  a component.
- **validate** — the leaf check. Returns `false` when a full assignment already
  breaks the rule. It is the correctness backstop, not the pruner.
- **Change** — an object a component `yield`s from `update` to alter the puzzle
  (`removeCandidateFromCell`, `replaceComponent`, `stop`, …). A component never
  mutates the puzzle directly. See `docs/puzzle-api.md`.
- **local constraint** — the author draws **groups**; the main code reads
  `input.groups` (`{ value, cells }[]`) and builds one component per group. The
  worked example is local. See `docs/patterns.md`.
- **global constraint** — no groups; the main code builds components over the
  whole grid from `helpers.cellIds.getAllCellIds()`. See the "Local vs global"
  section of `docs/component-contract.md`.
- **group** — one author-drawn selection: `{ value: string, cells: CellId[] }`.
  The cells arrive in the reading order the rule needs; trust it (gotcha 3).
- **helpers** — the API's utility namespaces: `naming`, `digits`, `cellIds`,
  `geometry`, `lines`. Reached as `helpers.*` or `puzzle.helpers.*`. See
  `docs/puzzle-api.md`.
- **DigitSet** — the candidate-set type. Iterable but **not** an array; wrap with
  `Array.from`, build with `SudokuDigitSet.from([...])` (gotcha 4).
- **soundness harness** — a Node mock of the solver API that proves a component
  removes no true candidate. Ships beside the worked example. See
  `docs/testing-and-generation.md`.
- **generation** — building a fresh grid, deriving clues, and proving a unique
  solution with OR-Tools CP-SAT (`generate.py`). See
  `docs/testing-and-generation.md`.
- **real-app timing** — the solve time SudokuMaker's own solver reports for a
  link, read by a browser driver. The only clock that decides whether a
  deduction pays for itself. See `docs/real-app-timing.md`.
- **mock probe** — our Node GAC + DFS mock run over a component. It measures
  deduction strength (candidates recovered, search nodes cut), not seconds. Its
  verdict does not transfer to the app. See `docs/real-app-timing.md`.
- **same-board pair** — two links on one identical board that differ only in
  constraint code: the **baseline** (the code shipped today) and the
  **candidate** (the change under test). The unit a real-app timing compares.
  SudokuMaker's original wrapper was the baseline only for the first rewrite.
- **searchable link** — a link whose interior is emptied so the solver must
  search from the givens and the outside-clue ring. A finished link only verifies
  a filled grid and times the same for every code variant.

## Invariants

These shape every constraint; breaking one costs an afternoon. Detail in
`docs/gotchas.md`.

- **A `validate`-only component is inert.** The solver neither prunes nor rejects
  through a component with no `update`. Always pair `validate` with an `update`
  that removes at least some candidates. (gotcha 2)
- **`replaceComponent` targets built-ins only.** Swapping in another custom
  component silently does nothing. Write one self-contained component instead.
  (gotcha 1)
- **The whole puzzle is in the URL.** Long component code can truncate the
  puzzle — silent data loss. Keep component code lean. (gotcha 7)

## Where to look

- `docs/component-contract.md` — the five functions, arguments, call order.
- `docs/gotchas.md` — the expensive lessons. Read before your first component.
- `docs/puzzle-api.md` — `puzzle`/`sudoku`, `helpers`, `DigitSet`.
- `docs/builtin-components.md` — ready-made components to reuse.
- `docs/patterns.md` — local groups, global grids, the outside frame, encoding.
- `docs/advanced-techniques.md` — stronger deductions, built-in hijacking.
- `docs/testing-and-generation.md` — soundness harness and OR-Tools generation.
- `docs/catalog.md` — the community spreadsheet of 200+ constraints.
- `examples/running-start/` — one full, working local constraint, shipped.
