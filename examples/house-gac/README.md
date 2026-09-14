# House GAC — the shipped filter, alone, on a plain 9x9

One shareable link (`PUZZLE_LINK.txt`): a plain 9x9 with **no clue ring and no
frame constraint**. Beyond the board's own rows-and-columns and region
declarations, the only constraint is the shipped
`examples/_shared/HouseGacComponent.js`, registered on every row, column and
box. #421 only ever adds this filter on top of a frame board; #406's demo pair
(`docs/research/406-gac-demo/`, kept in research — it carries the research
`AllDiffGacComponent`, not the shipped form) carries the matching-based
reference the shipped component is checked against. This link is the shipped
component, standing alone, on the simplest board there is.

Moved here from `docs/research/425-standalone-house-gac/` by #428, so the
standalone GAC demo lives with the other examples rather than under research
(#425, #426, #427).

| link | AutoStep (Icon AutoStep, run to fixpoint) |
| --- | --- |
| `docs/research/406-gac-demo/PUZZLE_LINK_without_gac.txt` (same board, no GAC) | 25 -> **53/81** |
| `PUZZLE_LINK.txt` | 25 -> **81/81** |

The 81/81 grid matches CP-SAT's unique solution cell for cell:

```
265783149
387149562
941562783
594627831
726831495
138495627
413956278
872314956
659278314
```

## Why its own backend

`examples/_shared/house-gac.js` (the backend #421 and #408 both use) cannot
register this board. It reads a frame board's ring the way `frame-rowcol.js`
does: the first and last row/column are the ring, and the first and last cell
of every line between is a ring cell, all sliced off before the interior is
read. A plain 9x9 has no ring, so that slicing would drop two whole houses
(row/column 1 and 9) and clip one cell off each end of the seven it kept —
`examples/_shared/house-gac.test.mjs` proves the file only against boards
that carry a ring.

`main.js` is this example's own backend: it reads
`helpers.geometry.getAllRows()`/`getAllColumns()` whole (no slicing) for the
rows and columns, the same way `docs/research/406-gac-demo/tools/gac9-main.js`
reads them for `AllDiffGacComponent`, and `puzzle.getRegions()` for the boxes,
the way `examples/_shared/house-gac.js` itself does. It registers the one
shipped component, `HouseGacComponent`, unmodified, and refuses loudly if it
ever sees fewer than 9 rows, columns or boxes rather than silently
registering a weaker filter.

## No local/global split, and a shared component

House GAC filters fixed board geometry — every row, column and box — not a
line an author draws, so there is no drawn group to split a local lane out
of: `examples/_shared/check_layout.py`'s `NO_LOCAL_GLOBAL_SPLIT` carries this
example alongside isofill and fillomino, for a different reason (no drawn
lines at all, not a whole-grid rule).

The one component this example needs, `HouseGacComponent.js`, is also the
component #421's frame-board examples will register through
`examples/_shared/house-gac.js` — it lives in `examples/_shared/` on purpose,
not copied into this directory, so there is exactly one file to keep sound
(`check_layout.py`'s `SHARED_COMPONENT`; `time_example.py`'s
`find_component_file` follows the same name into `_shared/` when no local
copy exists).

## Rebuilding

`build_link.py` reuses the board and 25 givens from
`docs/research/406-gac-demo/PUZZLE_LINK_without_gac.txt` (regions, the Rows &
Columns backend, no GAC filter yet), re-proves uniqueness with CP-SAT, and
splices in the House GAC constraint via
`docs/research/408-house-gac/house_gac_links.with_filter`, passing `main.js`
as the backend and the shipped `examples/_shared/HouseGacComponent.js` as the
one component:

```
uv run --with lzstring examples/house-gac/build_link.py
```

`docs/research/406-gac-demo/tools/logic9.mjs <link>` runs AutoStep in the
recorded app and prints the grid it reached, for both rows of the table above:

```
$ node docs/research/406-gac-demo/tools/logic9.mjs examples/house-gac/PUZZLE_LINK.txt
{"file":"PUZZLE_LINK.txt","before":25,"after":81,"grid":["265783149","387149562","941562783","594627831","726831495","138495627","413956278","872314956","659278314"]}

$ node docs/research/406-gac-demo/tools/logic9.mjs docs/research/406-gac-demo/PUZZLE_LINK_without_gac.txt
{"file":"PUZZLE_LINK_without_gac.txt","before":25,"after":53,"grid":[...]}
```

The pre-share decode check (`sm-link` skill, gridfind's `inspect_link.py`)
reports `entered: 0` and `types {0,1,1000}` for `PUZZLE_LINK.txt` -- no
non-given cell holds a value or mark.

A harder fixture is tracked separately (#427: a classic 9x9 that makes the
app's own solver search, so GAC alone can be timed on search cost, not just
AutoStep reach). Once it lands it becomes this example's main
`PUZZLE_LINK.txt`, with the current 25-given demo kept beside it under its
own name — the `--board` flag on `build_link.py` and `time_example.py`
already takes a second committed link with no code change needed here.

## Tests

- `build_link.test.py` — the committed link reproduces `build()` exactly, a
  candidate component's code round-trips through `--component`/`--out`, and
  `--board` swaps a candidate's code into another committed link.
- `soundness-harness.mjs` — this example's own use of the shared component:
  `main.js` registers exactly the 27 houses a plain 9x9 has (correctly
  numbered, in order), a short geometry throws rather than registering fewer
  houses silently, and running all 27 house instances together over a real
  solved grid never drops a true digit. `HouseGacComponent.js`'s own
  soundness (the bitmask GAC math, exact vs. a matching-based reference, the
  interleaved-yield and gate cases) is proven once, in
  `examples/_shared/house-gac.test.mjs`, and not repeated here.
- `update-strength.test.mjs` — the shared component's floor, pinned at the
  commit that shipped it (`3279a3d`, #422): on 6,000 fuzzed full-house states,
  the current code never prunes less than that commit did.

```
uv run --with lzstring examples/house-gac/build_link.test.py
node examples/house-gac/soundness-harness.mjs
node examples/house-gac/update-strength.test.mjs
node examples/_shared/house-gac.test.mjs
```

## Timing

`just time house-gac` drives the live app on `PUZZLE_LINK.txt`. The
component is unmodified from its shipped form, so the run times the baseline
against itself (`time_example.py`: byte-equal candidate code times the
baseline only).

| date | app version | fixture | time | ratio | vs baseline | verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-09-13 | v2026.08.14-d47fc4b | house-gac | 0ms | — | — | BASELINE |
| 2026-09-13 | v2026.08.14-d47fc4b | house-gac after-logical | 0ms | — | — | BASELINE |

The component's working-tree code is byte-equal to the committed link's, so
`time_example.py` times the baseline alone on both rows and prints
`BASELINE` rather than a ratio. Zero on both: the plain 9x9's own search
finishes instantly either way
(docs/research/all-different-gac.md — every classic 9x9 on record lands at or
near zero under "Find all solutions", GAC filter or not). The filter's real
payoff is AutoStep reach (the table above), not search cost; #427 is the
open search for a classic 9x9 where GAC alone moves the search-cost row.
