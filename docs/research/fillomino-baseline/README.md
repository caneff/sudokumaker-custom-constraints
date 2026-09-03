# The fillomino baseline

The thing a better fillomino constraint has to beat. Ticket #281, on map #277.

The community catalog (`docs/catalog.md`, row 55) ships one fillomino
constraint, by SudokuFan, at <https://tinyurl.com/2cckzhow>. `main.js` and
`FillominoComponent.js` here are that constraint's code, decoded from the link
and vendored **verbatim** — including its `console.log`, its `==` comparisons,
and its `Array.includes` scans. Both files are in StandardJS's `ignore` list in
`package.json`, the way the `numbered-rooms/original/` and
`skyscraper/original/` snippets are. Do not tidy them: a baseline that has been
edited is no longer a baseline.

## Why this is not under `examples/`

`examples/_shared/check_layout.py` requires eight files of every directory
under `examples/`. A half-populated `examples/fillomino/` fails `just check`
before the real example exists, so the baseline waits here until there is an
example to sit beside.

`time_example.py` resolves its argument relative to `examples/`, so a relative
path reaches this directory with no change to the harness:

```
just time ../docs/research/fillomino-baseline
```

## Files

- `main.js`, `FillominoComponent.js` — the catalog constraint, verbatim.
- `FillominoComponentNoLog.js` — the same code minus its one
  `console.log(islands)` line (the log-free timing variant, #283/#307 —
  see "The baseline's `console.log`" below). Also in `package.json`'s
  StandardJS `ignore` list, kept in the vendor's own style.
- `gen.json` — the sample board: 6x6, 12 givens. Read out of the decoded link
  by script, not transcribed, with an assert that every non-given cell is
  empty, so the board ships no entered digits.
- `build_link.py` — rebuilds the board as a link this repo generates, so the
  board and the component vary independently. `--component` swaps in a
  candidate; `--board` swaps a component into a committed link, which is what
  `just time --board` needs; `--cap` ships explicit `minDigit`/`maxDigit` on
  the puzzle doc so a fixture's digit range can run past the board side
  (#293) -- left at its default, the doc carries neither key and reproduces
  this directory's own 6x6 board byte-for-byte.
- `PUZZLE_LINK.txt` — the built link. Open it to play the baseline board.
- `fixtures/` — the frozen fixture set, #307. See below.

Rebuild with:

```
uv run --with lzstring docs/research/fillomino-baseline/build_link.py
```

## What the baseline deduces

One whole-grid `update`, about 90 lines. It floods each **placed island** (a
connected island of equal digits) and, per island:

- stops the branch when the island is larger than its digit;
- seals the island's border against its own digit once the island is complete
  (this is the separation rule, applied to a finished region);
- floods the cells that still allow the digit and stops the branch when that
  reachable set is smaller than the digit;
- assigns the whole reachable set when it is exactly the digit;
- forces growth when the island has exactly one frontier cell;
- drops the digit from a frontier cell whose own merge would overflow the
  region.

Every one of those starts from a **placed** cell. The baseline deduces nothing
at all about a region with no given in it, and nothing across regions.

## Timing (the smoke-test board)

Real-app timing, `docs/real-app-timing.md`. The board is `PUZZLE_LINK.txt`
above.

| Date | App version | Board | Cold | After logical |
| --- | --- | --- | --- | --- |
| 2026-08-31 | v2026.08.14-d47fc4b | fillomino-baseline (6x6, 12 givens) | 100 ms | 0 ms |

**This board cannot rank anything.** 100 ms cold and 0 ms after logical is the
app reporting that the puzzle falls over immediately; a change to the component
would move neither number. It is a smoke test that the baseline runs, and
nothing more. The boards that actually rank a fillomino component are the
frozen fixture set below.

- The board is 6x6, so its digits run 1-6 and its regions cap at 6. The catalog
  note says regions cap at 9 "due to SudokuMaker limitations", which is the
  digit palette, not the rule.

## The baseline's `console.log`

The component logs `console.log(islands)` on every `update` call. On a board
slow enough to time, that log runs on every search node and dominates the
measurement -- #283 resolved to time the **log-free variant**
(`FillominoComponentNoLog.js`, the same code minus that one line, kept in the
vendor's own unstyled otherwise) and to say which variant produced every
recorded number. Every row below is the log-free variant.

## Fixtures (#307)

The frozen fixture set every later speed and strength claim measures against,
per #283's resolved recipe, widened by an owner follow-up to #307 that
overrides the ticket's "four or five" with every board above a slowness
cutoff. **These boards never change.**

**Method.** 20 seeds per digit range (`examples/fillomino/generate.py
sample`), each grown to a full 9x9 grid, all 81 cells started as givens, then
stripped greedily under **this directory's baseline component
(`FillominoComponentNoLog.js`, the log-free variant) driving the live app**
via `examples/_shared/app-strip.mjs` -- our own component was not in the app
at any point during the strip. Each stripped board was timed one cold rep.
Full batch log: `examples/fillomino/PROGRESS.md` (40 boards, no strip
failures, no app-strip timeouts).

A 9x9-digits-1-12 board ships explicit `minDigit`/`maxDigit` on its puzzle
doc (`build_link.py --cap`, #293); stripping it needed the on-screen digit
pad for givens 10-12, since SudokuMaker has no keyboard hotkey past 9 --
see `docs/real-app-timing.md`'s `app-strip.mjs` section for the pad-paging
bug that turned up and was fixed doing this.

**The cutoff: cold >= 20000 ms.** Sorting all 40 boards' one-cold-rep times
finds one clear gap: the ninth-slowest 9x9-digits-1-9 board reads 11100 ms,
then the next board up reads 21000 ms -- a **9900 ms gap**, the widest gap
anywhere in the 40-board distribution by more than 3x (the next-widest gap,
between 6900 ms and 10000 ms, is 3100 ms). Every board on the far side of
that gap reads 21000-30200 ms; every board on the near side reads at most
11100 ms. 20000 ms sits in the gap, so the cutoff is not sensitive to its
exact placement -- 15000 or 25000 would keep the same 19 boards. Below the
gap, boards read anywhere from 100 ms to 11100 ms with no comparable
separation, so the cutoff does not extend further down.

19 of the 40 boards clear the cutoff (6 of 20 on 9x9-digits-1-9, 13 of 20 on
9x9-digits-1-12 -- the wider digit range produces disproportionately more
slow boards, matching #283's expectation that digit range is the axis that
makes the rules' walk budget grow). Every one was proved to have exactly one
solution by the CP-SAT model (`examples/fillomino/generate.py unique`) -- a
timeout would not have counted as a verdict and the board would have been
dropped, but none of the 19 timed out; each proved unique on the first
attempt, verified twice independently (once during the freeze, once again
against the committed files afterward).

**The fixtures.** `fixtures/<name>.json` is the frozen instance
(`{"grid": [...], "clues": [[r, c], ...], "cap": N}`); `fixtures/<name>.txt`
is the built link (log-free baseline component, same board). 19 fixtures,
both digit ranges represented (6 on 9x9-digits-1-9, 13 on
9x9-digits-1-12):

| Fixture | Board | Givens |
| --- | --- | --- |
| `fixture-9x9-cap9-seed18` | 9x9, digits 1-9 | 28 |
| `fixture-9x9-cap9-seed1` | 9x9, digits 1-9 | 29 |
| `fixture-9x9-cap9-seed3` | 9x9, digits 1-9 | 29 |
| `fixture-9x9-cap9-seed5` | 9x9, digits 1-9 | 30 |
| `fixture-9x9-cap9-seed20` | 9x9, digits 1-9 | 30 |
| `fixture-9x9-cap9-seed10` | 9x9, digits 1-9 | 32 |
| `fixture-9x9-cap12-seed16` | 9x9, digits 1-12 | 28 |
| `fixture-9x9-cap12-seed17` | 9x9, digits 1-12 | 28 |
| `fixture-9x9-cap12-seed18` | 9x9, digits 1-12 | 29 |
| `fixture-9x9-cap12-seed11` | 9x9, digits 1-12 | 30 |
| `fixture-9x9-cap12-seed13` | 9x9, digits 1-12 | 30 |
| `fixture-9x9-cap12-seed9` | 9x9, digits 1-12 | 30 |
| `fixture-9x9-cap12-seed14` | 9x9, digits 1-12 | 32 |
| `fixture-9x9-cap12-seed8` | 9x9, digits 1-12 | 32 |
| `fixture-9x9-cap12-seed4` | 9x9, digits 1-12 | 33 |
| `fixture-9x9-cap12-seed10` | 9x9, digits 1-12 | 34 |
| `fixture-9x9-cap12-seed20` | 9x9, digits 1-12 | 34 |
| `fixture-9x9-cap12-seed3` | 9x9, digits 1-12 | 35 |
| `fixture-9x9-cap12-seed5` | 9x9, digits 1-12 | 35 |

**Minimum-givens headline: 28** -- a three-way tie, `fixture-9x9-cap9-seed18`
(digits 1-9) and `fixture-9x9-cap12-seed16`/`fixture-9x9-cap12-seed17`
(digits 1-12) -- the fewest givens the baseline needs anywhere in the frozen
set to still reach a unique verdict. This is the baseline's own number, not
a claim about our component; #310 re-runs the same strip under the shipped
component and records its own minimum for the strength comparison. Widening
the set from 5 to 19 fixtures did not move this number -- the original
5-fixture set already contained the digits-1-9 half of the tie.

**Baseline timing, log-free variant, 3 reps each, non-deterministic solve
off:**

| Date | App version | Board | Cold | After logical |
| --- | --- | --- | --- | --- |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap9-seed10 (32 givens) | 24700 ms | 200 ms |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap9-seed5 (30 givens) | 25200 ms | 3500 ms |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap9-seed20 (30 givens) | 21300 ms | 0 ms |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap9-seed3 (29 givens) | 24400 ms | 31100 ms |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap9-seed1 (29 givens) | 23600 ms | 17000 ms |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap9-seed18 (28 givens) | 26400 ms | 15400 ms |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap12-seed5 (35 givens) | 29300 ms | 30200 ms |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap12-seed3 (35 givens) | 28100 ms | 0 ms |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap12-seed20 (34 givens) | 27500 ms | 0 ms |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap12-seed10 (34 givens) | 25400 ms | 0 ms |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap12-seed4 (33 givens) | 28000 ms | 0 ms |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap12-seed8 (32 givens) | 29400 ms | 0 ms |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap12-seed14 (32 givens) | 25900 ms | 0 ms |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap12-seed9 (30 givens) | 29100 ms | 28800 ms |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap12-seed11 (30 givens) | 24200 ms | 23200 ms |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap12-seed13 (30 givens) | 18700 ms | 800 ms |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap12-seed18 (29 givens) | 25500 ms | 25000 ms |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap12-seed17 (28 givens) | 24600 ms | 0 ms |
| 2026-09-02 | v2026.08.14-d47fc4b | fixture-9x9-cap12-seed16 (28 givens) | 22700 ms | 0 ms |

(`fixture-9x9-cap12-seed13`'s final cold row, 18700 ms, reads under the
20000 ms selection cutoff -- expected: the cutoff was applied to the earlier
one-cold-rep batch measurement, 21000 ms for this board, and a 3-rep median
against a fresh browser session naturally lands a little differently. It
stays in the set: the cutoff selects boards, it is not itself a per-fixture
pass bar.)

Time a fixture again with `just time`'s manual steps (`docs/real-app-timing.md`)
against `fixtures/<name>.txt` and `FillominoComponentNoLog.js` -- there is no
`build_link.py` per fixture, so this is driven by hand (`app-solve.mjs
fixtures/<name>.txt 3` for cold, `--after-logical` for the second row), not
through `just time`.
