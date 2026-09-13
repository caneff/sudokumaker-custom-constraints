## Utility functions and graph classes

This appendix covers the two undirected/directed graph classes the solver uses
for lines and thermometers, the remaining members of `LineGraph`,
`SmallNumberSet` and `Vector2`, and the ~65 free functions that sit underneath
the utility namespaces. A custom component reaches almost none of these by
name. `getCustomConstraintGlobals` (`bundle.claude.js:9971`) injects exactly
`MathUtils`, `Vector2Funcs`, `CombinatoricUtils`, `ArrayUtils`, `SetUtils`,
`IterationUtils`, `SudokuDigitSet`, `SmallNumberSet`, `DigitSet`,
`DiagonalType` and `OuterPosition` — so the top-level functions below are
reachable only through the namespace member that aliases them, and most of this
section exists so you can read a namespace member's real behaviour. Neither
graph class is a global; you can still hold a `LineGraph` instance, because
`helpers.connectivity.getOrthogonallyConnectedGroups` yields them
(`bundle.claude.js:486`). `Vector2` is not reachable at all — use `Vector2Funcs`.

Points in both graph classes are interned through `internStructuredValue`, so
`{x, y}` coords and other plain objects compare structurally rather than by
identity. Cell ids are 0-based; in a digit mask, bit `d` is digit `d`.

### `DirectedLineGraph` (not a global; internal, used by the Thermometer handler)

A directed multi-source graph, at `bundle.claude.js:11095`. Fields: `points`, a
`Set` of every interned point; `pointsAfter`, a `Map` from point to its
successor `Set`; `pointsBefore`, the same for predecessors. The constructor
takes an array of lines (each an array of points in order) and chains their
consecutive pairs. Both maps prune an entry when its set empties, and `points`
drops a point with no edges either way, so an isolated point cannot exist here
— unlike `LineGraph`, there is no `addPoint`.

#### `addLine(line)`
Adds a directed edge for every consecutive pair in `line`, front to back.
- **Returns:** `this`. **Mutates:** the receiver. A line of one point adds
  nothing at all, since there is no lone-point storage. **[read]**

#### `addEdge(fromPoint, toPoint)`
Interns both endpoints, then records `toPoint` as a successor of `fromPoint`
and `fromPoint` as a predecessor of `toPoint`.
- **Returns:** `this`. **Mutates:** the receiver. Duplicate edges are absorbed
  by the underlying `Set`. **[read]**

#### `removeEdge(fromPoint, toPoint)`
Removes the one directed edge, then drops either endpoint from `points` if it
is left with no edges in either direction.
- **Returns:** `this`. **Mutates:** the receiver. A missing edge is a no-op.
  Pruning is unconditional here, with no opt-out flag — `LineGraph.removeEdge`
  has one. **[read]**

#### `removePoint(point)`
Removes every outgoing and then every incoming edge of `point`, which also
evicts the point itself.
- **Returns:** `this`. **Mutates:** the receiver. Returns early if the point is
  absent. **[read]**

#### `hasEdge(fromPoint, toPoint)`
Whether the directed edge exists in that direction.
- **Returns:** boolean. Both arguments are interned first, so structural
  points work. **[read]**

#### `hasPoint(point)`
Whether the interned point is in the graph. **Returns:** boolean. **[read]**

#### `getPoints()`
Every point, in insertion order.
- **Returns:** a new array; mutating it does not touch the graph. **[read]**

#### `getPointsBefore(point)`
The predecessor set of `point`.
- **Returns:** the graph's own live `Set`, or a fresh empty `Set` when the
  point has no predecessors. Do not mutate the returned set.
- **Notes:** this does **not** intern its argument, unlike `hasEdge` and
  `hasPoint`. Pass a structural point that is not already the interned instance
  and you get the empty set. **[read]**

#### `getPointsAfter(point)`
The successor set, with the same live-set and no-interning caveats.
- **Returns:** the graph's own `Set`, or a fresh empty `Set`. **[read]**

#### `getPointCount()`
Size of `points`. **Returns:** number. **[read]**

#### `isEmpty()`
Whether the graph holds no points. **Returns:** boolean. **[read]**

#### `getEdges()`
Walks `pointsAfter` and yields each directed edge once.
- **Returns:** generator of `[fromPoint, toPoint]` pairs. **Mutates:** nothing.
  Unlike `LineGraph.getEdges` there is no comparator dedup — direction already
  makes each edge appear once. **[read]**

#### `hasMergePoints()`
Whether any point has more than one predecessor.
- **Returns:** boolean. This is the "two lines join here" test. **[read]**

#### `hasBranchPoints()`
Whether any point has more than one successor.
- **Returns:** boolean. **[read]**

#### `hasCycles()`
Depth-first search following successors, with a visited set and an on-stack
set; true when it re-enters a point still on the stack.
- **Returns:** boolean. **Mutates:** nothing.
- **Notes:** recursive, so a pathological graph could overflow the stack; at
  thermometer scale that never happens. **[read]**

#### `getComponentsContainingPoints(points)`
Builds a new graph holding the weakly connected components that the given
points belong to.
- **Params:** `points` – iterable of points, interned on the way in.
- **Returns:** a new `DirectedLineGraph` containing every outgoing edge of
  every point in those components. **Mutates:** nothing.
- **Notes:** a component point with no outgoing edges and no incoming edge from
  within the component is silently dropped, because the sub-graph is rebuilt
  from edges only. **[read]**

#### `getPointsConnectedTo(startPoint)`
Weak connectivity: walks predecessors to exhaustion, then successors, from
`startPoint`.
- **Returns:** a new `Set` of points including `startPoint` itself, empty only
  if you count that the start is always added. **Mutates:** nothing.
- **Notes:** the backward walk runs first and marks points visited, so the
  forward walk stops at anything already reached; the result is the weakly
  connected set, not a directed reachable set. **[read]**

#### `toArrays()`
Decomposes the graph into paths by repeatedly tracing from a start point and
deleting each edge as it is consumed.
- **Returns:** array of arrays of points. **Mutates:** nothing — it works on
  `clone()`.
- **Notes:** the start-point picker is written `!before || before`, which is
  always true, so it simply takes the first key of `pointsAfter` rather than
  preferring a source; paths can therefore start mid-line. Throws
  `Error("This should never happen")` after 1000 total steps. **[read]**

#### `clone()`
Rebuilds a graph from `getEdges()`.
- **Returns:** a new `DirectedLineGraph`. **Mutates:** nothing. Points are
  shared, not deep-copied, which is safe because they are interned. **[read]**

### `LineGraph` (additional members)

Members of the undirected graph at `bundle.claude.js:250` not covered earlier.
Its one field is `pointsConnected`, a `Map` from interned point to a `Set` of
neighbours; the constructor's second argument is an `isGreaterThan(a, b)`
comparator (default `a > b`) used only to emit each undirected edge once.

#### `addLine(line)`
Adds an undirected edge for each consecutive pair in `line`.
- **Returns:** `this`. **Mutates:** the receiver. A one-point line adds
  nothing; use `addPoint` for that. **[read]**

#### `addPoint(point)`
Ensures the point exists with an empty neighbour set.
- **Returns:** `undefined`. **Mutates:** the receiver.
- **Notes:** this is the one entry point that does **not** intern its argument,
  so an object point added here and then queried via `hasPoint` may miss. Pass
  cell ids, or intern yourself. **[read]**

#### `addPoints(points)`
`addPoint` over an iterable. **Returns:** `undefined`. **Mutates:** the
receiver. Same no-interning caveat. **[read]**

#### `addEdge(pointA, pointB)`
Interns both points, creates their neighbour sets if needed, and links them
both ways.
- **Returns:** `this`. **Mutates:** the receiver. **[read]**

#### `removeEdge(pointA, pointB, pruneIsolated = true)`
Removes the link in both directions, and by default deletes either endpoint
that is left with no neighbours.
- **Returns:** `this`. **Mutates:** the receiver. Pass `false` as the third
  argument to keep now-isolated points in the graph. A no-op when either point
  is absent. **[read]**

#### `removePoint(point)`
Removes every edge at `point`, which with default pruning also removes the
point.
- **Returns:** `this`. **Mutates:** the receiver.
- **Notes:** it iterates the point's live neighbour set while `removeEdge`
  deletes from it. Sets tolerate this in JS, but a point whose last edge is
  removed disappears mid-loop. **[read]**

#### `hasPoint(point)`
Whether the interned point is present. **Returns:** boolean. **[read]**

#### `getAllComponents()`
Splits the whole graph into connected components.
- **Returns:** generator of new `LineGraph` objects, each carrying the original
  comparator. **Mutates:** nothing.
- **Notes:** this is what `helpers.connectivity.getOrthogonallyConnectedGroups`
  hands you — a generator, so spread it if you need two passes. **[read]**

#### `getConnectedPointSets(points)`
Groups the given points by which component they fall in, without building
graphs.
- **Params:** `points` – iterable, interned; omit it to use every point in the
  graph.
- **Returns:** generator of arrays of points. **Mutates:** nothing.
- **Notes:** each yielded array is the *full* connected set reachable from a
  seed, so it can include points that were not in your input. **[read]**

#### `getPointsConnectedTo(startPoint)`
Breadth-style flood fill from `startPoint` over neighbour sets.
- **Returns:** a new `Set` of reachable points. **Mutates:** nothing.
- **Notes:** a `startPoint` not in the graph yields an empty set, since the
  loop skips points with no entry. **[read]**

#### `getComponentContainingPoint(startPoint)`
The single component containing `startPoint`, as a graph.
- **Returns:** a new `LineGraph` with the same comparator, holding those points
  and the edges among them. **Mutates:** nothing. An unknown start point gives
  an empty graph. **[read]**

#### `getComponentsContainingPoints(points)`
The union of the components containing any of `points`, as one graph.
- **Returns:** a new `LineGraph`; the requested points are added explicitly, so
  isolated ones survive here (unlike the `DirectedLineGraph` twin).
  **Mutates:** nothing. **[read]**

#### `clone()`
Rebuilds from `getEdges()` with the same comparator.
- **Returns:** a new `LineGraph`. **Mutates:** nothing.
- **Notes:** edges only — a point with no edges is lost by the clone, and so
  by `toArrays()`, which clones first. **[read]**

### `SmallNumberSet` (additional members)

Static constructors on the bitmask set at `bundle.claude.js:596`. Called on
`SudokuDigitSet`/`DigitSet` they return that subclass, because they use `new
this(...)`.

#### `SmallNumberSet.from(numbers)`
Builds a set from an iterable of numbers via `buildDigitMask`.
- **Returns:** a new instance of the class it was called on. **Mutates:**
  nothing. Numbers outside 0..30 corrupt the mask; see `buildDigitMask`.
  **[read]**

#### `SmallNumberSet.getUnion(sets)`
ORs an iterable of sets together.
- **Returns:** a new instance. **Mutates:** nothing — it accumulates into a
  fresh set, not into the first argument. Empty input gives an empty set.
  **[read]**

#### `SmallNumberSet.getIntersection(sets)`
ANDs an iterable of sets together, starting from the all-ones mask
`2147483647`.
- **Returns:** a new instance. **Mutates:** nothing.
- **Notes:** empty input gives a set holding every number 0..30, not an empty
  set. Guard that case. **[read]**

### `Vector2` (additional members)

The mutable vector class at `bundle.claude.js:775`. Not exported to custom
code; you will meet it only inside the bundle. Every instance method returns
`this`, so calls chain and each one mutates the receiver.

#### `get magnitude`
`Math.hypot(x, y)`. **Returns:** number. **Mutates:** nothing. **[read]**

#### `get magnitudeSqr`
`x*x + y*y`, avoiding the square root when you only compare lengths.
**Returns:** number. **Mutates:** nothing. **[read]**

#### `addScaled(otherVector, scaleFactor)`
Adds `otherVector * scaleFactor` component-wise.
- **Returns:** `this`. **Mutates:** the receiver. **[read]**

#### `rotate(angle)`
Rotates in place by `angle` radians, reading both components before writing
either.
- **Returns:** `this`. **Mutates:** the receiver. **[read]**

#### `normalize()`
Divides both components by the magnitude.
- **Returns:** `this`. **Mutates:** the receiver. A zero vector becomes
  `{x: NaN, y: NaN}`. **[read]**

#### `copy(otherVector)`
Overwrites this vector's components from another.
- **Returns:** `this`. **Mutates:** the receiver, not the argument. **[read]**

#### `Vector2.from(source)`
Builds a `Vector2` from anything with `x` and `y`.
- **Returns:** a new `Vector2`. **Mutates:** nothing. **[read]**

### Top-level functions (sets, iteration, arrays, numbers, vectors, cloning)

Source-order groups. Where a function is the implementation behind a namespace
member already documented, the entry says so and still describes the body.

**Sets** — the implementations behind `SetUtils`. An `options.comparator` path,
where present, decides membership by calling `comparator(a, b)` pairwise, at
O(n·m).

#### `takeOneFromSet(sourceSet)` — `bundle.claude.js:46`
Behind `SetUtils.takeOne`. Returns the first element in iteration order and
deletes it. **Returns:** the element, or `undefined` when empty. **Mutates:**
`sourceSet`. **[read]**

#### `deleteAllFromSet(targetSet, itemsToDelete, options)` — `bundle.claude.js:50`
Behind `SetUtils.deleteAll`. In-place set difference.
- **Returns:** `targetSet`. **Mutates:** `targetSet`. With a comparator it
  scans the whole target per removal and deletes while iterating. **[read]**

#### `differenceOfSets(sourceSet, itemsToRemove, options)` — `bundle.claude.js:60`
Behind `SetUtils.difference`. Copies `sourceSet` first, then removes.
- **Returns:** a new `Set`. **Mutates:** nothing.
- **Notes:** the comparator is called `(existingItem, itemToRemove)` here but
  `(itemToDelete, existingItem)` in `deleteAllFromSet` — argument order is
  reversed between the twins, which matters for an asymmetric comparator.
  **[read]**

#### `symmetricDifferenceOfCollections(leftCollection, rightCollection)` — `bundle.claude.js:70`
Behind `SetUtils.symmetricDifference`. Dispatches to the set-only fast path
when both arguments have a `has` method, otherwise unions two differences.
**Returns:** a new `Set`. **Mutates:** nothing. **[read]**

#### `symmetricDifferenceOfSets(leftSet, rightSet)` — `bundle.claude.js:78`
The fast path: elements present in exactly one side, by two `has` scans.
**Returns:** a new `Set`. **Mutates:** nothing. No comparator support. **[read]**

#### `retainIntersectionInSet(targetSet, otherSet)` — `bundle.claude.js:86`
Behind `SetUtils.filter`. Deletes from `targetSet` anything `otherSet` lacks.
**Returns:** `targetSet`. **Mutates:** `targetSet`. Takes a set, never a
predicate, despite the namespace name. **[read]**

#### `intersectionOfSets(sourceSet, otherSet)` — `bundle.claude.js:90`
Behind `SetUtils.intersection`. Same test, applied to a copy.
**Returns:** a new `Set`. **Mutates:** nothing. **[read]**

#### `addAllToSet(targetSet, itemsToAdd)` — `bundle.claude.js:95`
Behind `SetUtils.addAll`. Adds every item of an iterable.
**Returns:** `targetSet`. **Mutates:** `targetSet`. **[read]**

#### `unionOfSets(leftSet, rightSet)` — `bundle.claude.js:99`
Behind `SetUtils.union`. Copies the left set and adds the right.
**Returns:** a new `Set`. **Mutates:** nothing. **[read]**

#### `setsAreEqual(leftSet, rightSet, options)` — `bundle.claude.js:104`
Behind `SetUtils.isEqual`. Raw `size` comparison, then `setHasAllOf`.
**Returns:** boolean. **Mutates:** nothing. The size gate applies even on the
comparator path. **[read]**

#### `setHasAllOf(containerSet, items, options)` — `bundle.claude.js:109`
Behind `SetUtils.hasAll`. Whether every item of the iterable is in the set.
**Returns:** boolean; true for empty `items`. **Mutates:** nothing.
Comparator order is `(candidateFromSet, item)`. **[read]**

#### `setHasSomeOf(containerSet, items, options)` — `bundle.claude.js:126`
Behind `SetUtils.hasSome`. Whether at least one item is present.
**Returns:** boolean; false for empty `items`. **Mutates:** nothing. **[read]**

#### `setHasSomeWhere(sourceSet, predicate)` — `bundle.claude.js:137`
Behind `SetUtils.hasSomeWhere`. Whether any element satisfies `predicate`.
**Returns:** boolean. **Mutates:** nothing. **[read]**

**Iteration** — the implementations behind `IterationUtils`.

#### `getFirstOfIterable(iterable)` — `bundle.claude.js:155`
Behind `IterationUtils.getOne`. Opens the iterator and takes one step.
**Returns:** the first value, or `undefined` when empty. **Mutates:** nothing,
though it does advance a generator by one. **[read]**

#### `iterateRangeExclusive(startValue, endValue)` — `bundle.claude.js:158`
Behind `IterationUtils.getRange`. Ascending integers, `end` excluded.
**Returns:** generator of numbers; empty when `start >= end`. **[read]**

#### `iterateRangeInclusive(startValue, endValue)` — `bundle.claude.js:161`
Behind `IterationUtils.getRangeInclusive`. Same with `end` included — the one
to use for `spec.minDigit`..`spec.maxDigit`. **Returns:** generator of numbers.
**[read]**

#### `iterateCombinationsOfSize(items, size)` — `bundle.claude.js:164`
Behind `IterationUtils.getCombinations`. Materializes `items` to an array, then
walks index combinations in lexicographic order.
- **Returns:** generator of fresh arrays, each of length `size`. **Mutates:**
  nothing (the shared index array is mapped, not yielded).
- **Notes:** yields nothing when `size` exceeds the count; `size` 0 yields one
  empty array then stops. It combines by position, so repeated values give
  repeated combinations. Cost is C(n, k). **[read]**

#### `countOccurrencesByValue(items)` — `bundle.claude.js:183`
Behind `IterationUtils.getCounts`. Tallies an iterable.
**Returns:** a new `Map` from value to count, using `Map` identity semantics.
**Mutates:** nothing. **[read]**

#### `getBestByScore(items, scoreFn, fallback)` — `bundle.claude.js:188`
Behind `IterationUtils.getBest`. Highest `scoreFn` wins, strictly, starting
from `-Infinity`.
**Returns:** the winning element, or `fallback` for empty input. **Mutates:**
nothing. First of tied maxima is kept; an element scoring `-Infinity` never
beats the fallback. **[read]**

**Cloning and interning** — not exposed to custom code, but both graph classes
depend on `internStructuredValue` and `deepClone` backs component state copies.

#### `deepClone(value)` — `bundle.claude.js:205`
Recursively copies arrays, `Set`s, `Map`s and plain objects; delegates to
`value.clone()` when the object has one; returns primitives as-is.
- **Returns:** a fresh structure. **Mutates:** nothing.
- **Notes:** it walks `for...in`, so inherited enumerable properties are copied
  and a class instance without a `clone` method degrades to a plain object.
  Cycles recurse forever. **[read]**

#### `serializeForInternKey(value)` — `bundle.claude.js:225`
Builds a `key:(value);` string recursively for use as an intern key.
**Returns:** string. **Mutates:** nothing. Property order decides the key, so
`{x, y}` and `{y, x}` intern separately; `null` and `undefined` inside an
object throw on `Object.entries`. **[read]**

#### `internStructuredValue(value)` — `bundle.claude.js:233`
Canonicalizes an object to one shared deep clone, so structurally equal values
become identity-equal. It checks a `WeakMap` by object first, then a `Map` by
serialized key, cloning on a miss.
- **Returns:** the canonical instance; primitives, `null` and `undefined` pass
  straight through. **Mutates:** nothing visible, but it caches.
- **Notes:** the string-keyed `Map` is never pruned, so interning many distinct
  coords leaks for the page's lifetime. This is why graph points can be
  `{x, y}` objects at all. **[read]**

**Digit masks** — bit `d` of a mask is digit `d`, so a 1..9 grid uses bits 1..9
and bit 0 stays clear.

#### `buildDigitMask(digits)` — `bundle.claude.js:512`
Aliased as `toDigitMask` (`bundle.claude.js:1288`) and used by
`SmallNumberSet.from`. ORs `1 << digit` for each digit.
**Returns:** number. **Mutates:** nothing. A digit above 30 wraps under JS
shift semantics and silently sets the wrong bit. **[read]**

#### `listDigitsInMask(mask)` — `bundle.claude.js:517`
Aliased as `digitsInMask`. Pops the lowest set bit repeatedly.
**Returns:** a new array of digits, ascending. **Mutates:** nothing. **[read]**

#### `isSingleCandidateMask(mask)` — `bundle.claude.js:532`
Whether exactly one bit is set — the "this cell is solved" test.
**Returns:** the truthy mask value or boolean `false`, not a strict boolean, so
compare with `!!` if you care. **Mutates:** nothing. Mask 0 gives `0`. **[read]**

#### `lowestSetBitIndex(mask)` — `bundle.claude.js:535`
Aliased as `smallestDigitInMask`, behind `DigitSet.getSmallestNumber`.
**Returns:** the index of the lowest set bit, or `undefined` for mask 0.
**Mutates:** nothing. **[read]**

#### `highestSetBitIndex(mask)` — `bundle.claude.js:538`
Aliased as `largestDigitInMask`, behind `DigitSet.getLargestNumber`.
**Returns:** the index of the highest set bit, or `undefined` for mask 0.
**Mutates:** nothing. **[read]**

**Numbers** — the implementations behind `MathUtils`.

#### `sumOfNumbers(numbers)` — `bundle.claude.js:704`
Behind `MathUtils.sum`. Accumulates an iterable from 0. **Returns:** number.
**Mutates:** nothing. **[read]**

#### `productOfNumbers(numbers)` — `bundle.claude.js:709`
Behind `MathUtils.product`. Accumulates from 1. **Returns:** number.
**Mutates:** nothing. **[read]**

#### `modulo(dividend, divisor)` — `bundle.claude.js:714`
Behind `MathUtils.mod`. `((a % b) + b) % b`, so the result is non-negative for
a positive divisor unlike JS `%`. **Returns:** number. **Mutates:** nothing.
Also drives `sliceWrapped`. **[read]**

#### `getPrimeFactors(number)` — `bundle.claude.js:740`
Behind `MathUtils.getFactors`. Divides out the tabled primes up to 83, then
odd candidates upward checked with `isPrime`.
- **Returns:** a new array of primes with multiplicity, `[2, 2, 3]` for 12.
- **Notes:** throws `Error("Cannot factorize non-integers")` on a non-integer.
  It stops on `Math.abs(number) === 1`, so 0 never terminates and ±1 returns
  `[]` only after the small-prime loop; a negative input factors its magnitude
  with no sign factor. **[read]**

#### `radiansToDegrees(radians)` — `bundle.claude.js:761`
Behind `MathUtils.toDegrees`. **Returns:** number. **Mutates:** nothing. **[read]**

#### `degreesToRadians(degrees)` — `bundle.claude.js:764`
Behind `MathUtils.toRadians`. **Returns:** number. **Mutates:** nothing. **[read]**

**Vectors** — the implementations behind `Vector2Funcs`, all over plain
`{x, y}`. Every one returns a fresh object or a scalar and mutates no argument.

#### `getVectorMagnitude(vector)` — `bundle.claude.js:826`
Behind `Vector2Funcs.getMagnitude`. `Math.hypot`. **Returns:** number. **[read]**

#### `getNormalizedVector(vector)` — `bundle.claude.js:829`
Behind `Vector2Funcs.normalized`. Multiplies by the reciprocal magnitude.
**Returns:** a new `{x, y}`; a zero vector gives `NaN`s. **[read]**

#### `getScaledVector(vector, scaleFactor)` — `bundle.claude.js:833`
Behind `Vector2Funcs.scaled`. **Returns:** a new `{x, y}`. **[read]**

#### `addVectors(vectorA, vectorB)` — `bundle.claude.js:836`
Behind `Vector2Funcs.sum` — note the name clash with `MathUtils.sum`.
**Returns:** a new `{x, y}`. **[read]**

#### `subtractVectors(vectorA, vectorB)` — `bundle.claude.js:839`
Behind `Vector2Funcs.difference`. `a - b`. **Returns:** a new `{x, y}`. **[read]**

#### `addScaledVector(vectorA, vectorB, scaleFactor)` — `bundle.claude.js:842`
Behind `Vector2Funcs.scaledSum`. `a + b * scaleFactor`. **Returns:** a new
`{x, y}`. **[read]**

#### `getDistanceBetweenPoints(pointA, pointB)` — `bundle.claude.js:848`
Behind `Vector2Funcs.getDistance`. Euclidean. **Returns:** number. **[read]**

#### `getAngleBetweenVectors(vectorA, vectorB)` — `bundle.claude.js:854`
Behind `Vector2Funcs.getAngle`. `acos` of the dot product of two normalized
copies.
- **Returns:** number in radians, 0 to π. **Mutates:** nothing — it normalizes
  temporary `Vector2` copies, not your objects.
- **Notes:** rounding can push the `acos` argument past ±1 and give `NaN` for
  near-parallel or near-opposite inputs. **[read]**

#### `getManhattanDistanceBetweenPoints(pointA, pointB)` — `bundle.claude.js:862`
Behind `Vector2Funcs.getManhattanDistance`. `|dx| + |dy|`. **Returns:** number;
on integer cell coords, the orthogonal step count. **[read]**

#### `getRotatedVector(vector, angle)` — `bundle.claude.js:865`
Behind `Vector2Funcs.getRotated`. Standard rotation by radians. **Returns:** a
new `{x, y}`. **[read]**

#### `getClampedVector(point, rect)` — `bundle.claude.js:873`
Behind `Vector2Funcs.getClamped`. Clamps into `{x, y, width, height}`.
**Returns:** a new `{x, y}`. **[read]**

#### `compareVectorsInReadingOrder(pointA, pointB)` — `bundle.claude.js:879`
Behind `Vector2Funcs.compareVectors`. Compares `y` first, then `Math.sign` of
the `x` difference.
**Returns:** -1, 0 or 1 — drop it straight into `Array.prototype.sort`. **[read]**

#### `isVectorAfterInReadingOrder(pointA, pointB)` — `bundle.claude.js:886`
Behind `Vector2Funcs.isVectorGreaterThan`. Whether `a` follows `b` in reading
order. **Returns:** boolean. **[read]**

#### `getAverageVector(points)` — `bundle.claude.js:889`
Behind `Vector2Funcs.getAverage`. Centroid of an iterable.
**Returns:** a new `{x, y}`; empty input gives `{x: NaN, y: NaN}` from 0/0.
**Mutates:** nothing — it accumulates into its own object. **[read]**

**Text and memoization** — neither is on a `*Utils` global; both are internal.

#### `joinWithConjunction(values, conjunction = "and")` — `bundle.claude.js:1292`
Joins values into an English list, `"a, b and c"`, stringifying each element.
- **Returns:** string. **Mutates:** nothing.
- **Notes:** no Oxford comma, and it indexes `values.length`, so it needs an
  array rather than any iterable. One element returns just that element; empty
  input returns `""`. Used for constraint names in solver explanations. **[read]**

#### `memoizeWithKey(computeValue, getKey, useWeakKeys = false)` — `bundle.claude.js:1453`
Wraps a function in a cache keyed by whatever `getKey(...args)` returns.
- **Params:** `computeValue` – the function to memoize. `getKey` – receives the
  same arguments and returns the cache key. `useWeakKeys` – use a `WeakMap`
  instead of a `Map`, for object keys you want collectable.
- **Returns:** a new function with the same arguments. **Mutates:** nothing
  outside its own cache, which never evicts on the `Map` path.
- **Notes:** this is what makes `SumsHelper.getCombinationsForSumWithoutRepeat`
  cheap to call repeatedly (`bundle.claude.js:1470`). It caches `undefined`
  results correctly, since it tests with `cache.has`. **[read]**

**Arrays** — the implementations behind `ArrayUtils`. The copy/in-place twins
are easy to confuse: `arrayWithoutAll` copies, `removeValuesInPlace` does not.

#### `removeFirstValue(array, value, options)` — `bundle.claude.js:1676`
Behind `ArrayUtils.removeFirst`. Splices out the first occurrence, by
`indexOf` or by comparator.
**Returns:** `array`. **Mutates:** `array`. A miss is a no-op. The comparator
is called `(value, candidate)`. **[read]**

#### `arrayWithoutAll(array, valuesToRemove, options)` — `bundle.claude.js:1688`
Behind `ArrayUtils.withoutAll`. Filters out everything in `valuesToRemove`,
using a `Set` on the fast path.
**Returns:** a new array. **Mutates:** nothing. The comparator path is O(n·m)
and dedups the removal list first. **[read]**

#### `removeValuesInPlace(array, valuesToRemove, options)` — `bundle.claude.js:1702`
Behind `ArrayUtils.remove`. Same filtering, done by copying the contents out,
truncating the array to length 0 and pushing the keepers back.
**Returns:** `array`. **Mutates:** `array`. Anyone holding the same array
reference sees the change. **[read]**

#### `removeWhereInPlace(array, predicate)` — `bundle.claude.js:1719`
Behind `ArrayUtils.removeWhere`. Drops every element satisfying `predicate`,
by the same empty-and-refill trick.
**Returns:** `array`. **Mutates:** `array`. **[read]**

#### `arrayIncludesSome(array, values, options)` — `bundle.claude.js:1725`
Behind `ArrayUtils.includesSome`. Whether any of `values` appears.
**Returns:** boolean; false for empty `values`. **Mutates:** nothing. **[read]**

#### `arrayIncludesEvery(array, values, options)` — `bundle.claude.js:1735`
Behind `ArrayUtils.includesEvery`. Whether all of `values` appear.
**Returns:** boolean; true for empty `values`. **Mutates:** nothing. **[read]**

#### `shuffledCopy(array)` — `bundle.claude.js:1745`
Behind `ArrayUtils.shuffled`. Fisher-Yates over a `slice()` copy using
`Math.random`.
**Returns:** a new array. **Mutates:** nothing. Non-deterministic — keep it out
of `update` if you want reproducible solves. **[read]**

#### `mapIterableToArray(iterable, mapFn)` — `bundle.claude.js:1753`
Behind `ArrayUtils.mapIterable`. Maps any iterable into an array.
**Returns:** a new array. **Mutates:** nothing. `mapFn` gets the element only,
no index. **[read]**

#### `chunkArray(array, chunkSize)` — `bundle.claude.js:1765`
Behind `ArrayUtils.chunk`. Splits into consecutive runs, the last possibly
short.
**Returns:** a new array of new arrays. **Mutates:** nothing. A `chunkSize` of
0 or less produces one chunk holding everything, because the `index % size`
guard only fires at index 0. **[read]**

#### `arraysAreSameLength(...arrays)` — `bundle.claude.js:1774`
Behind `ArrayUtils.areSameLength`. Whether every argument matches the first
one's length.
**Returns:** boolean; true for no arguments. **Mutates:** nothing. **[read]**

#### `hasDuplicatesByComparator(array, comparator)` — `bundle.claude.js:1789`
The O(n²) comparator path of `ArrayUtils.hasDuplicates`; the wrapper
`hasDuplicates` uses a `Set` when no comparator is given.
**Returns:** boolean. **Mutates:** nothing. **[read]**

#### `withoutDuplicatesByComparator(array, comparator)` — `bundle.claude.js:1800`
The O(n²) comparator path of `ArrayUtils.withoutDuplicates`, keeping first
occurrences.
**Returns:** a new array. **Mutates:** nothing. It uses `Array.prototype.find`
as the membership test, so a stored `undefined` would be treated as absent.
**[read]**

#### `toArrayMaybeUnique(value, { unique = false })` — `bundle.claude.js:1814`
Normalizes an array or any iterable to an array, optionally deduplicated.
- **Returns:** an array. **Mutates:** nothing.
- **Notes:** with `unique` false and an array input it returns *that same
  array*, not a copy — the result can alias the caller's. Used internally by
  the comparator paths of `arrayWithoutAll` and `removeValuesInPlace`. **[read]**

**Cells and graphs** — the last three, sudoku-specific or graph-specific.

#### `cellsShareColumn(cellA, cellB)` — `bundle.claude.js:1893`
Whether two 0-based cell ids have the same x, via
`sharedHelpers.cellIds.getX`, which is `cellId % width`.
**Returns:** boolean. **Mutates:** nothing. It reads the module-level
`sharedHelpers`, so it is bound to the loaded puzzle's width, not to a spec you
pass. **[read]**

#### `cellsShareRow(cellA, cellB)` — `bundle.claude.js:1898`
The same for y, `Math.floor(cellId / width)`.
**Returns:** boolean. **Mutates:** nothing. **[read]**

#### `getAllPathsThroughDirectedGraph(graph)` — `bundle.claude.js:11336`
Enumerates every source-to-sink path of a `DirectedLineGraph` by depth-first
walk from each point with no predecessors.
- **Params:** `graph` – a `DirectedLineGraph`.
- **Returns:** a new array of arrays of points; `[]` when the graph has a
  cycle, checked up front with `hasCycles()`. **Mutates:** nothing — it pushes
  and pops a scratch path and slices each result.
- **Notes:** this is how the Thermometer handler turns branching or merging
  thermometers into the individual strictly-increasing runs
  (`bundle.claude.js:11324`). Path count is exponential in the branching, which
  is fine for thermometers and would not be for a dense graph. **[read]**
