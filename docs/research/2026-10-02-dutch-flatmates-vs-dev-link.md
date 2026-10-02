# Dutch Flatmates: our component vs an outside dev-app link (2026-10-02)

**Question.** Is our shipped Dutch Flatmates code (#675, `examples/dutch-flatmates/`) faster in the real app than an implementation another SudokuMaker user wrote, which Chris shared as a `dev.sudokumaker.app` link?

**Answer.** On the boards we have, the two cannot be told apart: every run read **0 ms**, cold and after-logical, on all four boards (24 runs). Both implementations finish these puzzles before the app has to search. To separate them, a board where at least one of them still searches is needed. #678 (partner pointing) already found that carves down to 18 givens still read 0 ms for our code.

## The outside link

- **Format.** The dev app writes a newer link format: `D` + base64url(raw deflate(JSON)). It is read in the dev bundle `main-CV-5DLee.js`: the payload prefix `Uf="D"` goes to `DecompressionStream("deflate-raw")`, and the prefix `N` goes to the old lz-string path. gridfind's `link_file.py` decodes only the `N` form and returns nothing for `D`.
- **Rule text.** "Every 5 in the grid must have a '1' directly above it or a '9' directly below it." This is the same rule as ours.
- **Shape.**
  - Theirs registers one `DutchFlatComponent` per cell: 81 components, each with (cell, above, below).
  - Ours registers one `DutchFlatmatesComponent` over the whole grid.
- **Board.** Theirs is a 9x9 with 20 givens, no entered cells, and built-in rows/columns plus regions.

## Method

Only the flatmate constraint was swapped. Every other constraint on each board was left alone, giving four same-board links:

| link | board | flatmate code |
|---|---|---|
| theirboard_theircode | theirs, 20 givens | theirs |
| theirboard_ourcode | theirs | ours |
| ourboard_ourcode | ours, 23 givens (doc byte-equal to the shipped `PUZZLE_LINK.txt`) | ours |
| ourboard_theircode | ours | theirs |

- Each link was re-encoded in the `N` format and run in production sudokumaker.app, `v2026.08.14-d47fc4b`.
- Each run was `examples/_shared/app-solve.mjs <link> 1`, cold and with `--after-logical`, with non-deterministic solve off.
- The comparison was interleaved: 3 rounds, one rep per variant per round, with the lead rotating each round.

## Result

| link | cold (3 reps) | after-logical (3 reps) |
|---|---|---|
| theirboard_theircode | 0, 0, 0 ms | 0, 0, 0 ms |
| theirboard_ourcode | 0, 0, 0 ms | 0, 0, 0 ms |
| ourboard_ourcode | 0, 0, 0 ms | 0, 0, 0 ms |
| ourboard_theircode | 0, 0, 0 ms | 0, 0, 0 ms |

Under `docs/real-app-timing.md`'s two-row rule, a row where both sides read 0 ms places no constraint, so this is **NO TIME** in both directions. It is not a tie in speed: the boards are too easy to measure.

For scale, our validate-only component (#676) read about 200 ms on our board. Both pruning implementations remove that search.

## Not covered

- Harder boards. None exists yet where either implementation searches.
- Deduction strength, measured as how many cells the app's AutoStep fills from the givens. That separates two zero-time implementations without a clock, but it was not run.

## Rebuild

The scratch files live in the primary checkout's git-ignored `.scratch/dfm-compare/`.

1. Decode both links to JSON. For the `D` form: strip the leading `D`, base64url-decode, then `zlib.decompress(b, -15)`.
2. Replace the constraint whose `definition.components` is non-empty with the other document's.
3. Encode with gridfind's `scripts/link_file.py encode`.
4. Loop `node examples/_shared/app-solve.mjs <link> 1 [--after-logical]` over the four links, 3 rounds, rotating the start.

## Two SudokuPad puzzles, rebuilt with SudokuMaker built-ins

Chris asked how fast two published Dutch Flatmates puzzles solve. Neither has givens. Each was rebuilt on our 9x9 base board with every cell empty, using the app's own built-in constraint types, read from the production bundle `main-D44ZZMA9.js`:

- `NumberedRooms` = 504: `clues: [{outerCell, value}]`, where `outerCell = (x+1) + (y+1)*11`.
- `CountingCircles` = 306: `cells: [...]`.
- `DiagonalMinus` = 10 and `DiagonalPlus` = 11.

Only the flatmate constraint differs between "ours" and "theirs".

| puzzle | source | extra rules |
|---|---|---|
| P1 | sudokupad.app/2z307pcbx5, GoodCity, "Dutch Flat Mates (Numbered Rooms)" | 19 Numbered Rooms clues |
| P2 | sudokupad.app/pdhr2gqlhe, Flinty, "Dutch Flat Mates (Counting Circles)", made in Sudoku Maker v2024.03.28 | 28 counting circles, both diagonals unique |

Every clue was checked against the solution SudokuPad records:
- P1: 19 of 19 Numbered Rooms clues hold.
- P2: 0 circle-count violations, and the diagonals hold.
- Both: 0 flatmate violations.

P2's rule text also says "5s ... don't live in Circles". That rule was **not** added, because no built-in expresses it. The recorded solution has no 5 in a circle.

Timing: sudokumaker.app `v2026.08.14-d47fc4b`, `app-solve.mjs`, 3 interleaved rounds, rotating lead, non-deterministic solve off. The driver's limit is 300 s.

| link | cold: first / unique (3 reps) | after-logical: first / unique (3 reps) |
|---|---|---|
| P1, our code | 0/0, 0/0, 0/0 ms | 0/0, 0/0, 100/0 ms |
| P1, their code | 100/0, 100/0, 100/0 ms | 0/0, 0/0, 0/0 ms |
| P2, our code | timeout x3 (no first solve) | timeout x3 |
| P2, their code | timeout x3 (no first solve) | timeout x3 |

- **P1.** Both prove uniqueness in 0 ms. Cold, their code reads 100 ms to the first solution against our 0 ms, 3 reps of 3. The readout's resolution is 100 ms, so that is one tick.
- **P2.** DNF with both codes, so the flatmate code is not what decides it. The cause has not been checked. Candidates: the built-in CountingCircles search, the omitted "no 5 in circles" rule, or a board mismatch the solution check cannot see, such as a built-in reading its input differently from SudokuPad.

Rebuild: `build_sp.py` (in this folder's history at `bbad8a6`; deleted in #689 because `check_layout.py` refuses a `.py` under `docs/research/`) wrote the docs from the unzipped SudokuPad JSON (`sudokupad-art/tools/unzip_scl.py <id> sp.json`). `run2.sh` times them, with `VARIANTS="..." OUT=<file>`.

### P2 with "no 5 in a circle" added

The DNF above was caused by the rule left out. `add_no5.py` (in the same history, deleted in #689; `examples/dutch-flatmates/NoFiveComponent.js` is its component and `build_link.py --puzzle gen_0g.json` its board) added it as one small custom constraint. Its `initialize` removes 5 from the 28 circle cells, and its `validate` rejects a 5 on a circle. One cold rep each:

| link | first solve | uniqueness proof | verdict |
|---|---|---|---|
| P2 + no-5, our code | 9.7 s | 2.4 s (12.1 s total) | unique |
| P2 + no-5, their code | 43.6 s | none within 300 s | timeout |

This is the first board where the two flatmate codes separate in the real app. It is one rep, cold only. The full interleaved 3-rep, two-row run follows when it lands.

#### Full run: 3 interleaved rounds, rotating lead, both rows

| link | cold total (first + unique), 3 reps | median | after-logical total (first + unique), 3 reps | median |
|---|---|---|---|---|
| P2 + no-5, our code | 11.7 (9.3+2.4), 11.6, 11.5 s | **11.6 s** | 11.0 (8.6+2.4), 11.2, 11.1 s | **11.1 s** |
| P2 + no-5, their code | timeout x3 (first solve at 43.5–43.8 s, no uniqueness verdict in 300 s) | **DNF** | 13.7 (1.2+12.5), 14.0, 13.8 s | **13.8 s** |

Results:
- **Cold:** ours finishes, theirs does not.
- **After-logical:** ours/theirs = 11.1 / 13.8 = **0.80x**.

Read as a two-row comparison with theirs as the baseline, ours wins both rows.

The time splits differently between the two codes:
- After the logic pass, theirs finds its first solution in 1.2 s, against our 8.6–8.8 s.
- The uniqueness proof is where theirs loses: 12.5–12.8 s against our 2.3–2.4 s.

The column pruning is the likely cause of the faster proof, but that is not tested here. Cell-by-cell, their per-cell rule cannot remove a 1 or 9 that no 5 in the column can use, so the search for a second solution explores branches that ours removes.
