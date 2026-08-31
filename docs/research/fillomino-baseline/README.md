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
- `gen.json` — the sample board: 6x6, 12 givens. Read out of the decoded link
  by script, not transcribed, with an assert that every non-given cell is
  empty, so the board ships no entered digits.
- `build_link.py` — rebuilds the board as a link this repo generates, so the
  board and the component vary independently. `--component` swaps in a
  candidate; `--board` swaps a component into a committed link, which is what
  `just time --board` needs.
- `PUZZLE_LINK.txt` — the built link. Open it to play the baseline board.

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

## Timing

Real-app timing, `docs/real-app-timing.md`. The board is `PUZZLE_LINK.txt`
above.

| Date | App version | Board | Cold | After logical |
| --- | --- | --- | --- | --- |
| 2026-08-31 | v2026.08.14-d47fc4b | fillomino-baseline (6x6, 12 givens) | 100 ms | 0 ms |

**This board cannot rank anything.** 100 ms cold and 0 ms after logical is the
app reporting that the puzzle falls over immediately; a change to the component
would move neither number. It is a smoke test that the baseline runs, and
nothing more.

A board that ranks a fillomino component does not exist yet. Getting one is
the shipped generator's job (#288), and how many of them and how hard is
#283's. Two things already known that will bite there:

- The component logs `console.log(islands)` on every `update` call. On a board
  slow enough to time, that log runs on every search node and will dominate the
  measurement. Time the baseline as published first, then decide whether a
  log-free variant is the fairer comparison — and say which one any recorded
  number came from.
- The board is 6x6, so its digits run 1-6 and its regions cap at 6. The catalog
  note says regions cap at 9 "due to SudokuMaker limitations", which is the
  digit palette, not the rule.
