## Geometry

Everything here is reached as `helpers.geometry` inside a component. It turns
one cell/corner/edge/outer-clue id into the cells around it, and enumerates
whole-board patterns (rows, dominoes, knight pairs, 2x2 quadruples). It knows
only the board rectangle and — in the subclass — the region layout; it never
reads candidates, so nothing here is affected by solve state except
`getSubsetsPerRegion`.

Two conventions run through the whole section. **Cell ids are
`y * width + x`**, 0-based, and coordinates are plain `{x, y}` objects with
`x` a column and `y` a row, both 0-based. **Almost every member is a
generator**: it yields lazily, is consumed by one walk, and must be re-called
rather than re-iterated. The two exceptions are `getCellsTouchingEdge`,
`getManhattanDistanceBetweenCells` and `getCellsAreKingsMoveApart`, which
return values, plus `getSubsetsPerRegion` on the subclass.

### `helpers.geometry` (class `RegionAwareGeometryHelper extends GeometryHelper`)

`GeometryHelper` is `bundle.claude.js:913`; `RegionAwareGeometryHelper` is
`bundle.claude.js:9114`. What a component actually receives is the subclass:
`createExtendedHelpers` (`bundle.claude.js:9201`) builds
`geometry: new RegionAwareGeometryHelper(sudokuState, …)` and puts it on the
helpers object, so every base method below plus `getSubsetsPerRegion` is
available. Fields: `spec` (the puzzle spec), `width` and `height` (copied from
`spec.size` at construction, so a component can read `geometry.width` directly),
and the four id helpers `cellIdHelper`, `edgeIdHelper`, `cornerIdHelper`,
`outerCellIdHelper`; the subclass adds `sudoku` (the solver's sudoku state).

> Discrepancy: `docs/research/bundle-api-index.md:70` indexes
> `helpers.geometry` as the base class `gs` and lists only the base members, so
> `getSubsetsPerRegion` is missing from it. The instance is the region-aware
> subclass (`bundle.claude.js:9203`).

> Discrepancy: `createExtendedHelpers` hands `MiscHelper` the *base*
> `baseHelpers.geometry`, not the region-aware one it just built
> (`bundle.claude.js:9216`). `helpers.misc`'s internal geometry therefore has
> no `getSubsetsPerRegion`. Only matters if you reach into `helpers.misc`.

#### `getAdjacentCells(cellId, includeDiagonals = false)`
Yields the cells touching `cellId`, orthogonals first, then diagonals if asked.
- **Returns:** generator of cell ids. Never includes `cellId` itself.
- **Notes:** pure delegation to the two methods below, so the order is
  left, up, right, down, then up-left, up-right, down-left, down-right.

#### `getOrthogonallyAdjacentCells(cellId)`
Yields the up-to-four edge-sharing neighbours.
- **Returns:** generator of cell ids, in the order left, up, right, down.
- **Notes:** silently drops neighbours off the board, so a corner cell yields
  two. Excludes `cellId`.

#### `getDiagonallyAdjacentCells(cellId)`
Yields the up-to-four corner-sharing neighbours.
- **Returns:** generator of cell ids, ordered up-left, up-right, down-left,
  down-right. Off-board neighbours are dropped; `cellId` is excluded.

#### `getCellsInRow(rowIndex)`
Yields the whole row left to right.
- **Params:** `rowIndex` – 0-based row (a `y`).
- **Returns:** generator of `width` cell ids.
- **Notes:** no range check — an out-of-range `rowIndex` yields ids that are
  arithmetically valid but off the board.

#### `getCellsInColumn(columnIndex)`
Yields the whole column top to bottom.
- **Params:** `columnIndex` – 0-based column (an `x`).
- **Returns:** generator of `height` cell ids. Same absence of range checking.

#### `getCellsInRowOfCell(cellId)`
Yields the full row containing `cellId`, left to right.
- **Returns:** generator of cell ids. **Includes `cellId` itself** — filter it
  out yourself when building a "sees" relation.

#### `getCellsInColumnOfCell(cellId)`
Yields the full column containing `cellId`, top to bottom, `cellId` included.

#### `getCellsKnightsMoveAwayFromCell(cellId)`
Yields the up-to-eight cells a chess knight's move from `cellId`.
- **Returns:** generator of cell ids, in offset order `(-1,-2) (+1,-2)
  (-2,-1) (+2,-1) (-2,+1) (+2,+1) (-1,+2) (+1,+2)` as `(dx, dy)`.
- **Notes:** off-board moves dropped; `cellId` excluded.

#### `getCoordsInDiagonal(diagonalType, startX)`
Walks one diagonal downward from row 0, yielding coordinates.
- **Params:** `diagonalType` – a `DiagonalType` member. `startX` – optional
  column on row 0 to start from; defaults to `0` for `NegativeDiagonal` and
  `width - 1` for `PositiveDiagonal`.
- **Returns:** generator of `{x, y}` objects, one per row, `y` ascending from
  0. `NegativeDiagonal` steps `x` by `+1` per row (down-right), so the default
  is the main top-left-to-bottom-right diagonal; `PositiveDiagonal` steps `-1`
  (down-left), default the top-right-to-bottom-left diagonal.
- **Notes:** breaks as soon as `x` leaves the board, so an off-centre `startX`
  yields a short diagonal. It always starts at `y = 0`; there is no way to
  start a diagonal partway down the board.

#### `getCellsInDiagonal(diagonalType, startX)`
Same walk as `getCoordsInDiagonal`, yielding cell ids instead of coords.

#### `getAllRows()`
Yields each row of the board as an array.
- **Returns:** generator of arrays of cell ids, top row first, each array
  `width` long and in left-to-right order.
- **Notes:** the arrays are materialised (`[...getCellsInRow(i)]`), the outer
  sequence is not. Rows span the board edge to edge, including any frame/ring
  cells. Matches `docs/puzzle-api.md:71` (verified there by live probe), which
  also warns to coerce the yielded ids with `| 0` before heavy use.

#### `getAllColumns()`
Yields each column as an array of cell ids, leftmost first, top-to-bottom
within each.

#### `getAllPairsWithOffset(offsetX, offsetY)`
Yields every cell paired with the cell at a fixed offset from it.
- **Params:** `offsetX`, `offsetY` – the displacement in columns and rows; may
  be negative.
- **Returns:** generator of 2-element arrays `[baseCellId, offsetCellId]`,
  scanned in reading order (rows top to bottom, columns left to right by the
  base cell). Pairs whose offset cell falls off the board are skipped.
- **Notes:** one direction only — it never also yields the reversed pair, which
  is why the wrappers below pick a half-set of offsets to get each unordered
  pair exactly once.

#### `getAllDominoes()`
Every orthogonally adjacent pair, each unordered pair once: all horizontal
pairs (offset `1,0`) first, then all vertical pairs (offset `0,1`). Generator
of `[cellId, cellId]`.

#### `getAllDiagonallyAdjacentPairs()`
Every diagonally adjacent pair once: offset `1,-1` (up-right) then `1,1`
(down-right). Generator of `[cellId, cellId]`.

#### `getAllKingsMovePairs()`
Every king-move pair once: offsets `1,0`, `0,1`, `1,-1`, `1,1`, in that order.
Generator of `[cellId, cellId]`.

#### `getAllKnightMovePairs()`
Every knight-move pair once: offsets `1,-2`, `1,2`, `2,-1`, `2,1`, in that
order. Generator of `[cellId, cellId]`.

#### `getAllQuadruples()`
Yields every 2x2 block of cells on the board.
- **Returns:** generator of 4-element arrays ordered top-left, top-right,
  bottom-left, bottom-right — reading order within the block, *not* clockwise.
- **Notes:** iterates `rowIndex < height - 1` and `columnIndex < width - 1`, so
  there are `(width-1) * (height-1)` of them, indexed by their top-left cell.

#### `getCellsTouchingCorner(cornerId)`
Yields the up-to-four cells meeting at a corner point.
- **Params:** `cornerId` – a corner id (corner `(x, y)` is the top-left corner
  of cell `(x, y)`).
- **Returns:** generator of cell ids, ordered top-left, top-right, bottom-left,
  bottom-right. Cells off the board are dropped, so a board-corner yields one.
- **Notes:** it builds a local `touchingCells` array, never pushes to it, and
  `return`s it as the generator's (normally discarded) return value — dead
  code, ignore it.

#### `getCellsTouchingEdge(edgeId)`
Returns the two cells sharing an edge.
- **Params:** `edgeId` – an edge id; edge coords have one half-integer
  component (`{x: 2, y: 1.5}` is vertical, `{x: 1.5, y: 2}` horizontal).
- **Returns:** a plain **array** of exactly two cell ids — not a generator.
  Left then right for a vertical edge, top then bottom for a horizontal one.
- **Notes:** uses the unchecked `getIdFromCoords`, so a border edge produces a
  bogus id rather than `undefined`. Validate the edge before calling.

#### `getCoordsPointedAtByOuterClue(outerCellId, diagonalType)`
Walks the board from an outer clue in the direction that clue points, yielding
coordinates.
- **Params:** `outerCellId` – an outer-cell id (the ring one step outside the
  grid). `diagonalType` – optional `DiagonalType`; omit for the straight
  row/column ray.
- **Returns:** generator of `{x, y}` coords. The outer clue's own position is
  never yielded.
- **Notes (straight, `diagonalType` omitted)** — the ray runs inward from the
  clue and crosses the whole board: `Top` walks down its column, `y` 0 →
  `height-1`; `Bottom` walks up its column, `y` `height-1` → 0; `Left` walks
  right along its row, `x` 0 → `width-1`; `Right` walks left along its row,
  `x` `width-1` → 0. The four corner positions ignore the clue's own `x`/`y`
  and walk a main diagonal of length `min(width, height)`.
- **Notes (diagonal):** the step comes from the table `OuterClueDiagonalSteps`
  (`bundle.claude.js:1221`) keyed `` `${side}_${diagonalType}` ``; the walk
  starts by *adding* the step to the clue's coords, then continues until it
  leaves the board. Several combinations are deliberately `undefined` — a
  corner clue only has one sensible diagonal — and for those the generator
  **yields nothing at all** (early `return`), it does not throw. The live
  combinations: `Top`/`Left` + `NegativeDiagonal` step `(1,1)`; `Top` +
  `PositiveDiagonal` `(-1,1)`; `Bottom`/`Right` + `NegativeDiagonal` `(-1,-1)`;
  `Bottom`/`Left` + `PositiveDiagonal` `(1,-1)`; `Right` + `PositiveDiagonal`
  `(-1,1)`; `TopLeft`+`Negative` `(1,1)`; `TopRight`+`Positive` `(-1,1)`;
  `BottomLeft`+`Positive` `(1,-1)`; `BottomRight`+`Negative` `(-1,-1)`.

> Discrepancy (bundle bug, not a doc one): in the straight-ray branch the
> `BottomRight` case yields `{x: i, y: height-1-i}` — starting at the
> *bottom-left* corner and walking up-right — and `BottomLeft` yields
> `{x: width-1-i, y: height-1-i}`, starting at the bottom-right
> (`bundle.claude.js:1179` and `bundle.claude.js:1192`). The two corners are
> swapped relative to `TopLeft`/`TopRight`, which are correct. Don't trust a
> bottom-corner outer clue's straight ray. Also, all four corner cases assume
> a square board: they run `min(width, height)` steps along the true diagonal,
> which is not the visual diagonal of a non-square grid.

#### `getCellsPointedAtByOuterClue(outerCellId, diagonalType)`
Same walk as `getCoordsPointedAtByOuterClue`, yielding cell ids. Inherits every
note above, including the swapped bottom corners.

#### `getManhattanDistanceBetweenCells(cellA, cellB)`
Returns `|dx| + |dy|` between two cells as a number. Zero for a cell against
itself.

#### `getCellsAreKingsMoveApart(cellA, cellB)`
Returns `true` when the two cells are within one king's move.
- **Notes:** explicitly `false` when `cellA` and `cellB` are the same cell, so
  it means "adjacent including diagonally", not "within a king's move" in the
  reflexive sense.

#### `getSubsetsPerRegion(cellIds)`
Buckets a set of cells by which region each lives in. Subclass-only
(`bundle.claude.js:9124`).
- **Params:** `cellIds` – any iterable of cell ids; duplicates are removed
  first via `new Set(...)`.
- **Returns:** a `Map` from region id to an array of the cell ids in that
  region. Not a generator. Map insertion order follows first appearance in the
  deduped input; each array is in that same order.
- **Notes:** region id comes from the sudoku state's `getRegionIdAt`, which
  returns **`-1` for a cell in no region** (`bundle.claude.js:8802`) — so a
  frame/ring cell buckets under key `-1` rather than being dropped. On a
  puzzle with no regions at all, everything lands in one `-1` bucket.

### `DiagonalType` (enum, `bundle.claude.js:697`)

Numeric enum with two members, and the values are the `x`-step used when
walking down a diagonal, which is why they are signed rather than 0/1.

| Member | Value | Direction walking downward |
|-|-|-|
| `PositiveDiagonal` | `1` | `x` decreases per row (down-left) |
| `NegativeDiagonal` | `-1` | `x` increases per row (down-right) |

> Note the inversion: `getCoordsInDiagonal` computes
> `xStep = diagonalType === NegativeDiagonal ? 1 : -1`, so the *step it uses*
> is the negation of the enum's own numeric value. Pass the named member;
> never pass a raw `1` or `-1` expecting it to be the step.

"Positive" and "negative" name the diagonal's slope in ordinary maths axes
(`y` up), not in the board's `y`-down coordinates. `PositiveDiagonal` is the
bottom-left-to-top-right diagonal; `NegativeDiagonal` is the classic
top-left-to-bottom-right one. The same words appear in `HouseType` as
`DiagonalPlus` / `DiagonalMinus` (`bundle.claude.js:686`), which are string
values, not these numbers.

### `OuterPosition` (enum, `bundle.claude.js:677`)

Numeric enum naming which side of the board an outer-clue cell sits on. It is
what `helpers.outerCellIds.getSide(id)` and the `side` field of
`getAllAttributes(id)` return, and the thing `getCoordsPointedAtByOuterClue`
switches on.

| Member | Value |
|-|-|
| `Top` | `0` |
| `Right` | `1` |
| `Bottom` | `2` |
| `Left` | `3` |
| `TopLeft` | `4` |
| `TopRight` | `5` |
| `BottomRight` | `6` |
| `BottomLeft` | `7` |

- **Notes:** the sides run clockwise from `Top`, but the corners do **not**
  continue that rotation — `BottomRight` (6) precedes `BottomLeft` (7). Never
  derive a corner from arithmetic on a side value. Reverse lookup works
  (`OuterPosition[0] === "Top"`) because the enum is the usual TypeScript
  double-mapped object. The side is derived purely from coordinates by
  `getSideFromCoords` (`bundle.claude.js:1437`): `y < 0` gives the `Top` band,
  `y >= height` the `Bottom` band, and within each band an `x` outside
  `[0, width)` promotes it to the corresponding corner; a clue with in-range
  `y` is `Right` if `x >= width` and otherwise `Left`, so an outer id with
  fully in-range coords reports `Left`.
