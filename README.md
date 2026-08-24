# sudokumaker-custom-constraints

Field notes for writing custom constraints in [SudokuMaker](https://sudokumaker.app/).

SudokuMaker lets an author attach JavaScript to a puzzle to define a new
constraint that its solver understands. The whole puzzle — grid, solution, and
code — lives in the `?puzzle=` URL. This repo records what that JavaScript API
is, how to use it, the traps that cost real time, and one complete worked
example.

The app is **pre-release and undocumented**. Its own constraint editor warns
the API may change at any time. Treat everything here as observed behavior, not
a promised contract. Each claim below is tagged:

- **[verified]** — we ran it and saw it work (or fail).
- **[docs]** — stated by the community docs (Chris-Tophski repo or kammer guide).
- **[unsure]** — inferred or incomplete; check before relying on it.

## Start here

- `docs/component-contract.md` — the five lifecycle functions of a component,
  what each receives and returns, and when the solver calls them.
- `docs/gotchas.md` — the expensive lessons. Read this before your first
  component; two of them will otherwise cost you an afternoon.
- `docs/puzzle-api.md` — the `puzzle`/`sudoku` object, `helpers`, `DigitSet`.
- `docs/builtin-components.md` — the ready-made components you can reuse
  through `replaceComponent`, with signatures.
- `docs/patterns.md` — local groups, the interactive-outside frame, encoding.
- `docs/catalog.md` — the community spreadsheet of 200+ constraints.
- `docs/testing-and-generation.md` — how to test a component for soundness off
  the app, and how to build and uniqueness-check a puzzle with OR-Tools.

## Worked example

`examples/running-start/` is a full, working edge-clue constraint (a Skyscrapers
variant) built and shipped end to end:

- `main.js`, `RunningStartComponent.js` — the two code segments to paste into
  the SudokuMaker constraint editor.
- `soundness-harness.mjs` — a Node mock of the solver API that proves the
  component never removes a true candidate.
- `generate.py` — generates a fresh grid, derives clues, and proves a unique
  solution with OR-Tools CP-SAT.

## Sources

- Community docs and snippets: <https://github.com/Chris-Tophski/SudokuMakerConstraints>
- Beginner guide: <https://kammer.xyz/blog/sudokumaker/>
- Constraint catalog (spreadsheet): see `docs/catalog.md` for the link.
- Author's intro videos: <https://www.youtube.com/@chameleon_yura/videos>
