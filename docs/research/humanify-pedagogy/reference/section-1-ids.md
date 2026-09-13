## Cell, corner, edge and outer-cell ids, connectivity, lines, misc

Everything in this section is pure coordinate arithmetic over the board's
dimensions — no puzzle state is read, so these calls are cheap and safe to make
anywhere in `update`. A component reaches them as `helpers.cellIds`,
`helpers.cornerIds`, `helpers.edgeIds`, `helpers.outerCellIds`,
`helpers.connectivity`, `helpers.lines` and `helpers.misc`. The first five come
from the base factory `createHelpers(spec)` (`bundle.claude.js:1614`);
`lines` and `misc` exist **only** on the object built by
`createExtendedHelpers(spec, sudokuState)` (`bundle.claude.js:9201`), which
spreads the base helpers and adds `lines`, `misc`, and a region-aware
`geometry`. Built-in components use `helpers.lines` and `helpers.misc` freely,
so the extended object is what a solving component receives; a bare
`createHelpers` result would not have them.

The four id schemes are all row-major integers, but over four different
lattices: cells over `width`, corners over `width + 1`, edges over
`2 * width` per row, outer cells over `width + 2`. Never mix an id from one
scheme into a call belonging to another — they are all plain numbers, so
nothing will throw.

### helpers.cellIds (class CellIds)

`bundle.claude.js:3`. Cell ids are row-major over the grid:
`cellId = x + y * width`, so id 0 is the top-left cell and x, y are 0-based
with y growing downward. A cell occupies the unit square `[x, x+1] x [y, y+1]`
in board coordinates. Fields: `spec`, `width`, `height`.

#### `getX(cellId)`
Column of the cell, `cellId % width`. No range check; a negative or
out-of-range id yields garbage rather than `undefined`.

#### `getY(cellId)`
Row of the cell, `Math.floor(cellId / width)`.

#### `getCoordsFromId(cellId)`
- **Returns:** a plain object `{x, y}` (not a `Vector2`).

#### `getIdFromCoords(coords)`
Unchecked inverse: `coords.x + coords.y * width`.
- **Notes:** off-grid coords silently produce a wrong in-range id (e.g.
  `{x: -1, y: 3}` gives the last cell of row 2). Use the Safe variant when the
  coords come from an offset walk.

#### `getIdFromCoordsSafe(coords)`
Same, but bounds-checked.
- **Returns:** the cell id, or `undefined` when `x` or `y` is outside
  `[0, width)` / `[0, height)`.

#### `areValidCoords({x, y})`
True when the coords lie on the board. The bounds test behind
`getIdFromCoordsSafe`.

#### `getAllCellIds()`
- **Returns:** a fresh `Array` `[0, 1, …, width*height - 1]`, in reading order.
  An array, not a generator, so it can be reused and indexed.

#### `getCellCenterFromId(cellId)`
Geometric centre of the cell as `{x: getX(cellId) + 0.5, y: getY(cellId) + 0.5}`.
Board units, not pixels. This half-offset is the convention every other id
scheme in this section is defined against.

### helpers.cornerIds (class CornerIds)

`bundle.claude.js:497`. Corners are the lattice points of the grid: integer
`(x, y)` with `x` in `[0, width]` and `y` in `[0, height]`, numbered row-major
over a lattice one wider than the cell grid — `cornerId = x + y * (width + 1)`.
Corner `(x, y)` is the **top-left** corner of cell `(x, y)`, so corner id 0 is
the board's top-left point and the corner ids are *not* interchangeable with
cell ids past the first row. Fields: `spec` (and `cellIdHelper`).

#### `getIdFromCornerCoords(cornerCoords)`
`cornerCoords.x + cornerCoords.y * (width + 1)`. Note the method name differs
from the `getIdFromCoords` used by the other three helpers.
- **Notes:** unchecked; no Safe variant exists.

#### `getCoordsFromId(cornerId)`
- **Returns:** `{x: cornerId % (width + 1), y: Math.floor(cornerId / (width + 1))}`,
  a plain object.
- **Notes:** the consumer that fixes this convention is
  `helpers.geometry.getCellsTouchingCorner` (`bundle.claude.js:1088`), which
  yields the cells at the four offsets `(-1,-1), (0,-1), (-1,0), (0,0)` from
  the corner coords, dropping those off-board.

### helpers.edgeIds (class EdgeIds)

`bundle.claude.js:659`. An edge is the border between two orthogonally adjacent
cells, identified by its **midpoint** in board coordinates: a vertical edge has
integer `x` and half-integer `y`, a horizontal edge half-integer `x` and
integer `y`. Ids are laid out in blocks of `2 * width` per grid row: within the
block for row `r`, the first `width` ids are the vertical edges at
`(x, r + 0.5)` for `x = 0 … width-1`, and the next `width` are the horizontal
edges at `(c + 0.5, r + 1)` for `c = 0 … width-1`. So the id space is
`2 * width * height` slots, addressing each cell's left border and bottom
border. Fields: `spec` (and `cellIdHelper`).

#### `getIdFromCoords(coords)`
Encodes an edge midpoint: `Math.floor(coords.x) + (coords.y - 0.5) * width * 2`.
- **Params:** `coords` – edge midpoint, e.g. `{x: 3, y: 1.5}` for the border
  between cells (2,1) and (3,1), or `{x: 2.5, y: 4}` for the border between
  (2,3) and (2,4).
- **Notes:** unchecked, and the right-hand board border is **not**
  representable — `{x: width, y: r + 0.5}` encodes to the same id as the
  horizontal edge `{x: 0.5, y: r + 1}`. Stay inside `x < width`;
  `helpers.misc.getEdgesForNegativeConstraint` only ever emits interior edges
  (`x` from 1 to `width-1`, `y` from 1 to `height-1`), which is the safe range.

#### `getCoordsFromId(edgeId)`
Inverse of the above, branching on whether `edgeId % (width * 2) < width`.
- **Returns:** `{x: edgeId % width, y: floor(edgeId / (2*width)) + 0.5}` for a
  vertical edge, else `{x: 0.5 + (edgeId % width), y: floor(edgeId / (2*width)) + 1}`
  for a horizontal one. Plain object.
- **Notes:** which of the two cells an edge separates is read from
  `helpers.geometry.getCellsTouchingEdge` (`bundle.claude.js:1101`), which
  floors and ceils `(x - 0.5, y - 0.5)`.

### helpers.outerCellIds (class OuterCellIds)

`bundle.claude.js:1404`. Outer cells are the clue positions in the one-cell
ring around the board, addressed in a coordinate system where the grid itself
is `0 … width-1` / `0 … height-1` and the ring is `x = -1` or `x = width`,
`y = -1` or `y = height`, including the four diagonal corner slots. Ids are
row-major over that padded `(width + 2) x (height + 2)` lattice:
`id = (x + 1) + (y + 1) * (width + 2)`, so id 0 is the top-left corner clue
slot. Fields: `width`, `height`. A side is an `OuterPosition` enum value
(`bundle.claude.js:676`): `Top 0, Right 1, Bottom 2, Left 3, TopLeft 4,
TopRight 5, BottomRight 6, BottomLeft 7`.

#### `getX(outerCellId)`
`(outerCellId % (width + 2)) - 1`. Returns `-1` for the left ring column.

#### `getY(outerCellId)`
`Math.floor(outerCellId / (width + 2)) - 1`. Returns `-1` for the top ring row.

#### `getIdFromCoords(coords)`
`coords.x + 1 + (coords.y + 1) * (width + 2)`. Unchecked; no Safe variant.

#### `getCoordsFromId(outerCellId)`
- **Returns:** a **`Vector2` instance**, not a plain object — unlike
  `cellIds.getCoordsFromId`. It still reads as `{x, y}` but carries the
  `Vector2` mutating methods (`add`, `scale`, …), so cloning it before
  arithmetic matters.

#### `getCellCenterFromId(outerCellId)`
- **Returns:** `Vector2(x + 0.5, y + 0.5)`, the centre of the outer slot in the
  same board units as `cellIds.getCellCenterFromId`.

#### `getSide(outerCellId)`
Which side of the board the clue sits on.
- **Returns:** an `OuterPosition` value, via `getSideFromCoords`.

#### `getAllAttributes(outerCellId)`
One-call decode.
- **Returns:** `{x, y, side}` — the ring coords plus the `OuterPosition`. This
  is what `helpers.geometry.getCoordsPointedAtByOuterClue` consumes to walk the
  row, column or diagonal a clue points down.

#### `getSideFromCoords(coords)`
Classifies ring coords: `y < 0` gives `TopLeft` / `Top` / `TopRight` by `x`;
`y >= height` gives the Bottom trio; otherwise `x >= width` gives `Right`.
- **Notes:** the final fallback is `Left`, with no check that `x < 0`. Any
  **interior** cell's coords therefore classify as `Left`. Only pass coords you
  know are on the ring.

### helpers.connectivity (class ConnectivityHelper)

`bundle.claude.js:478`. One method, wrapping the internal `LineGraph`
(`bundle.claude.js:205`) — an undirected adjacency-map graph. Fields: `spec`,
`geometryHelper`.

#### `getOrthogonallyConnectedGroups(cells)`
Splits a set of cells into its orthogonally connected components. It builds a
`LineGraph` with one point per cell and an edge for each orthogonally adjacent
pair that is *also* in the input set, then returns the components.
- **Params:** `cells` – any iterable of cell ids. It is iterated more than
  once, so pass an array or `Set`, never a generator.
- **Returns:** a **generator of `LineGraph` objects**, not of cell arrays. Call
  `.getPoints()` on each to get its cell ids: `for (const g of
  helpers.connectivity.getOrthogonallyConnectedGroups(cells)) { const ids =
  g.getPoints(); … }`. A single cell with no neighbours still yields its own
  one-point graph.
- **Notes:** diagonal adjacency is never considered. Cost is linear in the
  input; the graph is rebuilt on every call, so hoist it out of a per-candidate
  loop.

The `LineGraph` instances that come back are worth knowing a little about:
`getPoints()` (array of points), `getPointsAdjacentTo(p)` (a `Set`),
`getPointCount()`, `isEmpty()`, `hasEdge(a, b)`, `getEdges()` (generator, each
undirected edge once), `hasCycles()`, `isSimpleLines()` (true when no point has
three or more neighbours), and `toArrays()` (traces the graph into arrays of
points, starting from degree-1 endpoints; it throws
`"This should never happen"` after 1000 steps). Non-number points are interned
by structural key, so `{x, y}` objects compare by value.

### helpers.lines (class LinesHelper)

`bundle.claude.js:9135`. **Extended helpers only** (`createExtendedHelpers`,
`bundle.claude.js:9201`); absent from the base `createHelpers` result and from
`docs/research/bundle-api-index.md`. Stateless — no constructor, no fields. A
"line" here is just an ordered `Array` of cell ids; nothing validates that the
cells are actually adjacent.

#### `getLineEnds(lineCells)`
- **Returns:** `[lineCells[0], lineCells.at(-1)]`. On a one-cell line both
  entries are that same cell; on an empty array both are `undefined`.

#### `getCellsBetweenLineEnds(lineCells)`
- **Returns:** `lineCells.slice(1, -1)` — a new array of the interior cells,
  empty for lines of length 2 or less.

#### `*getAllPairsAlongLines(lines)`
Every consecutive pair along every line.
- **Params:** `lines` – iterable of cell-id arrays.
- **Returns:** generator yielding `[cellA, cellB]` two-element arrays. Order is
  line by line, then along each line; no de-duplication if two lines share a
  pair.

### helpers.misc (class MiscHelper)

`bundle.claude.js:9148`. **Extended helpers only**, same as `lines`. Holds
`cellIdHelper`, `edgeIdHelper`, `outerCellIdHelper`, `cornerIdHelper`,
`geometryHelper` and `spec`; note the constructor is handed the *base*
`geometry`, not the region-aware one the extended object exposes.

#### `*getEdgesForNegativeConstraint(existingClues)`
Yields every interior edge of the board that does **not** already carry a clue —
the enumeration a negative-constraint rule ("every unmarked border is not a
domino") needs.
- **Params:** `existingClues` – iterable of clue objects, each with an `.edge`
  property holding an edge id. Only that property is read.
- **Returns:** generator of edge ids, in row-major order, vertical edge before
  horizontal edge per cell.
- **Notes:** it walks each cell and emits the edge to its right
  (`x = column + 1`, when `column < width - 1`) and the edge below it
  (`y = row + 1`, when `row < height - 1`), so board-boundary edges are never
  yielded. That is also the canonical demonstration of the safe edge-coordinate
  range.

#### `getCellGroupsFromLines(lines)`
Merges lines that share cells into connected groups — the "all lines touching
each other form one shape" step.
- **Params:** `lines` – array of cell-id arrays; each becomes a path in a
  `LineGraph`.
- **Returns:** an `Array` of arrays of cell ids, one per connected component.
  Unlike `connectivity.getOrthogonallyConnectedGroups`, this returns plain cell
  arrays, and connectivity comes from line membership, not board adjacency.
- **Notes:** a cell appearing in two lines fuses those lines into one group.
  Cells not on any line never appear.

> Discrepancy: `docs/puzzle-api.md:64` files `helpers.lines` alongside
> `helpers.geometry` without saying it is conditional. `LinesHelper` and
> `MiscHelper` are attached only by `createExtendedHelpers`
> (`bundle.claude.js:9201`); the base `createHelpers` (`bundle.claude.js:1614`)
> returns neither, which is why `docs/research/bundle-api-index.md` — generated
> from the base factory — has sections for `cellIds`, `cornerIds`, `edgeIds`,
> `outerCellIds`, `geometry` and `connectivity` but none for `lines` or `misc`.

> Discrepancy: `docs/research/bundle-api-index.md:158` lists
> `getOrthogonallyConnectedGroups(arg0)` as a plain "method". It is a
> pass-through to `LineGraph.getAllComponents`, a **generator** yielding
> `LineGraph` objects (`bundle.claude.js:478`, `bundle.claude.js:205`), so
> treating the result as an array of cell arrays fails silently.
