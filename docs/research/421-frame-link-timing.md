# #421: real-app timing of the shared house-GAC filter on every shipped frame board

Measures what #408 left open: solve time on the real app, board by board,
against the two-row ship rule (`just time`, docs/real-app-timing.md). Every
shipped frame board (hit-counts, numbered-rooms, outside-sudoku,
running-start, skyscraper) is 9x9 today, so the filter's 9-cell house cap
(`HouseGacComponent.js`'s `MAX_CELLS`) excludes none of them.

## Method

For each example, `examples/_shared/house-gac.js` + `HouseGacComponent.js`
were spliced onto the committed `PUZZLE_LINK.txt` as one more constraint --
the exact shape `framebuild.house_gac_constraint()` now builds under
`Spec.house_gac=True` -- and written to a scratch
`PUZZLE_LINK_house_gac_candidate.txt` next to the board (not committed, and
not present in the shipped tree). Then, per board:

```
just time <example> [--ring-clues]                                    # baseline row
just time <example> [--ring-clues] --board PUZZLE_LINK_house_gac_candidate.txt   # candidate row
```

The example's own component code is untouched, so `time_example.py` finds it
byte-equal and prints baseline-only rows for both calls (`docs/real-app-timing.md`,
"Link vs link, when no component changed"). Both are 3-rep medians,
non-deterministic solve off (the tool's default). Ratios below are computed
by hand from the two baseline-only rows, per that same protocol.

One run at a time; `uptime`/`free -g` checked before starting (load average
0.35-0.68, 26G free).

## Results

| example | mode | before | after | ratio |
| --- | --- | --- | --- | --- |
| hit-counts | cold | 7600ms | 6300ms | 0.829x |
| hit-counts | after-logical | 6400ms | 3900ms | 0.609x |
| running-start | cold | 1400ms | 1000ms | 0.714x |
| running-start | after-logical | 300ms | 0ms | ~0x |
| skyscraper | cold | 7200ms | 7300ms | 1.014x |
| skyscraper | after-logical | 0ms | 0ms | n/a (both 0 -- places no constraint) |
| outside-sudoku | cold | 500ms | 500ms | 1.000x |
| outside-sudoku | after-logical | 300ms | 300ms | 1.000x |
| numbered-rooms | cold | 1700ms | 2000ms | 1.176x |
| numbered-rooms | after-logical | 1500ms | 1600ms | 1.067x |

## Verdicts (two-row rule: ship at <=0.9x on one row, <=1.1x on the other)

- **hit-counts: SHIP.** Both rows clear 0.9x on their own; hit-counts is in
  `check_layout.DIGITS_EXCEED_LINES` (minDigit 0, a look-and-say cage keeps 0
  out of the interior, so its 10-digit range exceeds its 9-cell lines) but the
  filter still runs as a per-house GAC over whatever candidates the app
  tracks, independent of the naming/digit-range degradation `frame-rowcol.js`
  documents for that mismatch -- and it pays off big here.
- **running-start: SHIP.** Cold clears 0.9x outright; after-logical drops a
  nonzero baseline (300ms) to 0ms, which is a win, not the "0ms baseline"
  case docs/real-app-timing.md warns sinks a change (that clause is about a
  candidate regressing a 0ms *baseline* into needing search -- the reverse of
  what happened here).
- **skyscraper: NO SHIP.** Cold is 1.014x -- inside the 1.1x band but short of
  0.9x -- and after-logical is 0/0, which "places no constraint," so cold
  alone decides and it does not clear the bar. Matches the ticket's own
  framing: GAC's benefit is in AutoStep/deduction reach, not necessarily
  search-solver wall clock, and the app's own search here already finishes
  the after-logical state instantly regardless.
- **outside-sudoku: NO SHIP.** Both rows read exactly 1.000x -- the board
  solves fast enough (500ms/300ms) that the added per-call cost neither helps
  nor hurts within measurement granularity, and neither row reaches 0.9x.
- **numbered-rooms: NO SHIP, and worse -- cold regresses past the 1.1x cap**
  (1.176x), so this is not just "no benefit" but a real slowdown; the smaller
  board (fewer search nodes) means the GAC filter's own per-call cost is a
  larger fraction of total solve time here than on the boards where it wins.

## Decision

Only **hit-counts** and **running-start** opt in (`Spec.house_gac=True`) in
this ticket. skyscraper, outside-sudoku and numbered-rooms keep `house_gac`
unset; re-measuring them is not worth doing again unless their board or the
filter's own cost changes.
