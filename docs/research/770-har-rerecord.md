# Re-recording the HAR for app v2026.10.05-a3aef4c (#770)

`examples/_shared/sudokumaker.har` now holds the app build
`v2026.10.05-a3aef4c`, recorded live on 2026-10-13 (was `v2026.08.14-d47fc4b`).

| Chunk | Was | Now |
|-|-|-|
| main | `main-D44ZZMA9.js` | `main-IgwNn95P.js` |
| solver | `solver-Bv75x3BJ.js` | `solver-PA_paHYG.js` |
| puzzleQueries | `puzzleQueries-DKblPzGJ.js` | `puzzleQueries-BDI34ZpQ.js` |

## Timing baselines, old recording vs new

`just time <example>` (baseline-only rows: no component edited), same box, same
hour, the old recording replayed from a worktree at the parent commit. Medians
of 3 reps, non-deterministic solve off.

| Example | Old, cold | New, cold | Old, after-logical | New, after-logical |
|-|-|-|-|-|
| house-gac | 0ms | 0ms | 0ms | 0ms |
| up-to-n | 900ms | 900ms | 0ms | 0ms |
| isofill | 500ms | 500ms | 0ms | 0ms |
| running-start | 700ms | 700ms | 0ms | 0ms |
| outside-sudoku | 400ms | 400ms | 300ms | 300ms |
| dutch-flatmates | 0ms | 0ms | 0ms | 0ms |
| hit-counts | 7900ms | 7600ms | 4700ms | 4600ms |
| numbered-rooms (`--ring-clues`) | 2200ms | 2200ms | 1900ms | 1900ms |
| skyscraper (`--ring-clues`) | 8900ms | 8800ms | 0ms | 0ms |
| fillomino | 5100ms | 5200ms | 0ms | 0ms |

No row moved past the run-to-run noise on these boards. count-digits-gac ships
no board (`just time` refuses it); its rows live in `docs/research/`.

### Other boards with recorded README rows

The same command with `--board`, old recording against new, baseline-only rows.

| Board | Old, cold | New, cold | Old, after-logical | New, after-logical |
|-|-|-|-|-|
| skyscraper `PUZZLE_LINK_6x6_local.txt` (`--component SkyscraperOneSidedComponent`) | 0ms | 0ms | 0ms | 0ms |
| skyscraper `PUZZLE_LINK_local.txt` (`--component SkyscraperOneSidedComponent`) | 6300ms | 6400ms | 2100ms | 2000ms |
| numbered-rooms `PUZZLE_LINK_6x6_local.txt` | 100ms | 100ms | 0ms | 0ms |
| outside-sudoku `PUZZLE_LINK_local.txt` | 600ms | 600ms | 300ms | 300ms |
| running-start `PUZZLE_LINK_local.txt` | 12900ms | 11000ms | 1000ms | 900ms |
| hit-counts `PUZZLE_LINK_6x6_local.txt` | 200ms | 200ms | 200ms | 200ms |
| dutch-flatmates `PUZZLE_LINK_0g.txt` | 16000ms | 13100ms | 12900ms | 13200ms |

Two boards read faster under the new recording (running-start local, 15%;
dutch-flatmates 0g cold, 18%), none slower, and each was one run of 3 reps, so
those two are not claimed as a speedup. They are the only moves past noise.

Not re-timed: the fillomino `timing-fixture-*` boards. `just time fillomino
--board timing-fixture-9x9-cap12-seed10-rung25.txt` is refused by the driver
on the old and the new recording alike, so there is no number to compare:

    ValueError: fillomino: no backend file (main.js, main-global.js, house-gac.js) matches the committed 'Fillomino' backend; the likeliest cause is an uncommitted fillomino/PUZZLE_LINK*.txt rebuild

## Solver chunk: three changes

Diffing the old and new solver chunk (both in the two HARs) finds exactly three
changes, patched into `vendor/bundle.claude.js` line for line (the line count is
unchanged, so every `bundle.claude.js:<line>` citation still holds) and proved
against the new chunk (`bundle.min.js`).
`humanify-pedagogy/tools/verify.mjs` compares the two modulo identifier names
(AST equal, 3744 bindings, 0 reference-count mismatches), so it proves patches 2
and 3 and is blind to patch 1, whose only change is a property name. Patch 1 is
proved by a statement-by-statement diff of the old and new minified chunks and
by `bundle-behaviour.test.mjs`.

1. `getCoordsPointedAtByOuterClue`: the `BottomRight` and `BottomLeft` straight
   rays no longer start at each other's corner.
2. `groupsArePolarityPair`: the high mask is `digit > midpoint`.
3. `DifferentGroups.getIsDone`: compares the groups each cell touches, not a
   cell with itself.

`examples/_shared/bundle-behaviour.test.mjs` witnesses all three.

## Link format

New links carry `D` + base64url(deflate-raw(JSON)), no padding; old `N`
lz-string links still open. Checked on 2026-10-13:

- The app opens and solves a `D` link built from an existing document, in the
  new recording (offline replay).
- `formatVersion` was already `1.6.0` in this repo's links.
- `sudoku_kit.link_codec.decode_puzzle` rejects a `D` payload, and every link
  reader here (`board_checks.py`, `bareboard.py`, `link_codec_cli.py` and so
  `bundle-solve-lib.mjs`, `probe_link.py`, `check_layout.py`, `framebuild.py`'s
  checks) goes through it. The fix is the codec's: caneff/sudoku-kit#2. Tools
  that only emit `N` links are unaffected.
