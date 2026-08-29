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
  For an outside-clue rule the group is the **clue** cell first, then the
  **line**.
- **clue** — the first cell of an outside-clue group. It holds the clue value
  and never counts as part of the line.
- **line** — the ordered cells of a group after the clue. A line promises
  nothing about its digits: any length, repeats allowed, digits may be absent.
  `n` in a README or comment is the line length; the group has `n + 1` cells.
- **house** — a line whose digits are all different. A component learns this
  from the app (`puzzle.getCellsCanHaveRepeats`), never from a comment or an
  author flag.
- **full house** — a house that holds every puzzle digit exactly once: a house
  whose length equals the digit count.
- **line kind** — what a line's digits may do: **bare**, **house**, or **full
  house**, in that order. A rule that needs one kind also holds on every kind
  above it. A component learns the kind from the app once and keeps it for
  its own lifetime. See `docs/line-contract.md`.
- **line component** — the component for one group: one clue, one line. Both
  variants of an example use the same one.
- **pair component** — a component that sees both clues of one line. Global
  only.
- **side component** — a component that sees every clue on one side of the
  frame. Global only.
- **frame component** — a component that sees every clue and every line at
  once. Global only; a named slot, filled per example only with a measured
  win.
- **ties flag** — the one constant per component file that decides whether
  equal digits count along a line. Strict by default.
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

### Region-building terms (from `examples/isofill/`)

- **region** — the ten orthogonally connected cells that hold one digit. The
  thing a region-building constraint discovers.
- **placed cell** — a cell whose only candidate is the digit. **open cell** — a
  cell with more than one candidate. A region is placed cells plus the open
  cells it will take.
- **blob** — a maximal connected set of placed cells of one digit. A region has
  one blob when finished; several before.
- **walk** — the **seed walk**: a 0-1 breadth-first search from a digit's seed
  cell, where a placed cell costs nothing to enter and an open cell that allows
  the digit costs one step, with a budget of the open cells the region can
  still take. The over-approximation of the region that every other rule reads.
  It drops the digit from every cell it never meets; a walk under ten cells, or
  one that misses a placed cell, kills the branch.
- **cut** — the rule that places the digit in an open cell the region cannot do
  without. Two tests: **starve** (without the cell the walk holds fewer than
  ten) and **strand** (without the cell a placed cell is unreachable).
- **door** — an open cell next to a blob that still allows the digit. One door
  is the cheap case of cut.
- **seed** — the digit's lowest-index placed cell, where its walk starts.
- **silent digit** — a digit with no placed cell. Gets no walk; handled by
  the connected components of the cells that allow it.
- **budget** — the rule that matches open cells to digits' remaining slots and
  kills the branch when no full matching exists.
- **tour** — a lower bound on region size from the distances between three
  placed cells.

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
