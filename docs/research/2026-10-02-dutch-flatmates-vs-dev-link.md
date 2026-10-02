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
