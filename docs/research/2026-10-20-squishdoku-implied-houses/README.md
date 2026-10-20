# Squishdoku: the 13 houses the geometry forces

An improved Squishdoku template for SudokuMaker. The catalog template
(`docs/catalog.md`; row "Squishdoku", 7x7, by ThePedallingPianist,
<https://tinyurl.com/25dwebue>) tells the solver about 5 extra houses. The
rules force 13. The new template, `template-link.txt`, registers all 13.

## Findings

Squishdoku: a 7x7 grid with digits 1-9. Nine 3x3 boxes overlap on rows and
columns 3 and 5, and each box holds 1-9 once. Rows and columns hold no
repeats.

- **128 cell pairs are forced to differ** beyond those sharing a row, column
  or box. No pair is forced equal. CP-SAT checked every one of the 1,176 cell
  pairs both ways (`implied_houses.py`), so these counts are exhaustive.
- **13 nine-cell houses cover all 128.** They are every maximal 9-clique of
  the "must differ" graph other than the boxes:
  - 4 **crosses**: the column and row through an inner box corner (r3c3,
    r3c5, r5c3, r5c5), two cells each way.
  - 1 **central cross**: row 4 and column 4, minus r4c3, r4c5, r3c4 and r5c4.
  - 8 **bowties**: an inner box corner plus the two 2x2 blocks diagonally on
    either side of it (two diagonals per corner).
- **The catalog template has the 4 crosses and the central cross**, all
  correct, but they cover only 16 of the 128 pairs. It lacks the 8 bowties.

## What the new template changes

- The backend (`backend.js`) builds all 13 houses from the geometry instead
  of reading a hard-coded group list. `check_backend.mjs` runs it against a
  stub and confirms it builds exactly the CP-SAT set.
- The inert "To rowcol" constraint is dropped. It held a `postprocessJSON`
  hook for a third-party user script and registered nothing for the solver.
- `minDigit: 1, maxDigit: 9` are declared. This is the app's default for a
  `custom` document anyway (`examples/_shared/bundle-solve-lib.mjs`,
  `buildStartMessage`), so the solve does not change.
- Unchanged: the boxes as `type 301` cages (a 9-cell cage upgrades itself to
  a `HouseComponent` in `initialize`), rows and columns as `type 2003`
  (`SudokuRules`, `DifferentDigitsComponent` on a 7-wide board), the dashed
  border lines, and the rules text.

## Effect on the solver

Thirty minimal unique puzzles (10-14 givens), each solved on three
templates: bare (boxes, rows and columns only), the catalog template ("old")
and the new one. "Logic steps" counts the app's own logical steps to its
fixpoint. "findAll" is the bundle's full search in Node, median of 3 reps
per board.

| template | total logic steps | boards solved by logic alone | median findAll | summed findAll |
| --- | --- | --- | --- | --- |
| bare | 1210 | 24 / 30 | 6.0 ms | 552 ms |
| old | 1223 | 24 / 30 | 7.0 ms | 671 ms |
| new | 1048 | 25 / 30 | 3.5 ms | 488 ms |

The new template takes about 14% fewer logic steps than the old one, finishes
one more board by logic alone, and halves the median search time. The old
template's five houses were no better than none on this set.

Limits of this measurement:

- The Node time is a ranking tool, not the number on record
  (`docs/research/429-headless-solver-calibration.md`).
- The real app cannot resolve the difference on boards this small.
  `just time-link` on one 12-given board read 0 ms for both old and new, cold
  and after-logical (app v2026.10.05-a3aef4c, HAR replay). The solve-time
  invariant's ≤ 0.9× bar therefore has no app reading behind it.
- The 30 boards come from greedy given-removal and are mostly easy. Hard
  hand-set squishdokus were not tested.

## Rebuild

From this directory. `original.json` is the catalog link decoded with
gridfind's `scripts/link_file.py decode` (see the `sm-link` skill).

```
uv run --with networkx python implied_houses.py houses.json
node check_backend.mjs backend.js houses.json
python build_template.py original.json backend.js template.json
uv run --directory ~/src/gridfind python scripts/link_file.py encode "$PWD/template.json" "$PWD/template-link.txt"

# the comparison table
uv run python make_boards.py original.json template.json boards 30
for f in boards/*.json; do uv run --directory ~/src/gridfind python scripts/link_file.py encode "$PWD/$f" "$PWD/${f%.json}.link.txt"; done
node score_boards.mjs boards/*.link.txt
```

These scripts are frozen research scripts. Nothing in the repo runs them.
