# Standalone House GAC: the shipped filter, alone, on a plain 9x9

One shareable link (`PUZZLE_LINK.txt`): a plain 9x9 with **no clue ring and no
frame constraint**. Beyond the board's own rows-and-columns and region
declarations, the only constraint is the shipped
`examples/_shared/HouseGacComponent.js`, registered on every row, column and
box. #421 only ever adds this filter on top of a frame board; #406's demo pair
carries the research `AllDiffGacComponent`, not the shipped form. This link is
the shipped component, standing alone, on the simplest board there is.

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
register this board. It reads a frame board's ring the way
`frame-rowcol.js` does: the first and last row/column are the ring, and the
first and last cell of every line between is a ring cell, all sliced off
before the interior is read. A plain 9x9 has no ring, so that slicing would
drop two whole houses (row/column 1 and 9) and clip one cell off each end of
the seven it kept — `house-gac.test.mjs` proves the file only against boards
that carry a ring.

`tools/house-gac9-main.js` is this link's own backend: it reads
`helpers.geometry.getAllRows()`/`getAllColumns()` whole (no slicing) for the
rows and columns, the same way
`docs/research/406-gac-demo/tools/gac9-main.js` reads them for
`AllDiffGacComponent`, and `puzzle.getRegions()` for the boxes, the way
`examples/_shared/house-gac.js` itself does. It registers the one shipped
component, `HouseGacComponent`, unmodified, and refuses loudly if it ever
sees fewer than 9 rows, columns or boxes rather than silently registering a
weaker filter.

## Rebuilding

`tools/build_link.py` reuses the board and 25 givens from
`docs/research/406-gac-demo/PUZZLE_LINK_without_gac.txt` (regions, the Rows &
Columns backend, no GAC filter yet), re-proves uniqueness with CP-SAT, and
splices in the House GAC constraint via
`docs/research/408-house-gac/house_gac_links.with_filter`, passing
`tools/house-gac9-main.js` as the backend and the shipped
`HouseGacComponent.js` as the one component:

```
uv run docs/research/425-standalone-house-gac/tools/build_link.py
```

`docs/research/406-gac-demo/tools/logic9.mjs <link>` runs AutoStep in the
recorded app and prints the grid it reached, for both rows of the table above:

```
$ node docs/research/406-gac-demo/tools/logic9.mjs docs/research/425-standalone-house-gac/PUZZLE_LINK.txt
{"file":"PUZZLE_LINK.txt","before":25,"after":81,"grid":["265783149","387149562","941562783","594627831","726831495","138495627","413956278","872314956","659278314"]}

$ node docs/research/406-gac-demo/tools/logic9.mjs docs/research/406-gac-demo/PUZZLE_LINK_without_gac.txt
{"file":"PUZZLE_LINK_without_gac.txt","before":25,"after":53,"grid":[...]}
```

The pre-share decode check (`sm-link` skill, gridfind's `inspect_link.py`)
reports `entered: 0` and `types {0,1,1000}` for `PUZZLE_LINK.txt` -- no
non-given cell holds a value or mark.
