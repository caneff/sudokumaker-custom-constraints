## Digit sets and utility globals

Every name in this section is a bare global inside custom component code and
inside a `backend.code` block — no import, no `helpers.` prefix. They come from
`getCustomConstraintGlobals` (`bundle.claude.js:9972`), which returns exactly
`MathUtils`, `Vector2Funcs`, `CombinatoricUtils`, `ArrayUtils`, `SetUtils`,
`IterationUtils`, `SudokuDigitSet`, `SmallNumberSet`, `DigitSet` (an alias for
the same `SudokuDigitSet` class), `DiagonalType` and `OuterPosition`.
`runCustomCodeWithGlobals` (`bundle.claude.js:9987`) compiles your source as
`new Function(...Object.keys(globals), code)` and applies it with the matching
values, so the globals are ordinary function parameters: shadowing one with a
local `const` of the same name is legal and silently hides it.
`compileCustomComponentClass` (`bundle.claude.js:9990`) spreads the same object
and adds `env`, `helpers`, `customComponents`, every built-in component
constructor by name, and the `__`-prefixed internals; the constraint-level call
site (`bundle.claude.js:10119`) adds `puzzle`, `sudoku` (the same object) and
`input` on top. Because the code runs through `new Function`, it is evaluated in
global scope: `window`, `Math`, `Set` and friends are reachable, but nothing
module-local from the bundle is.

### `SmallNumberSet` (global `SmallNumberSet`)

A set of small non-negative integers stored as a single 32-bit bitmask, at
`bundle.claude.js:541`. Bit `d` is member `d`, so digit 1 is bit 1 and bit 0 is
unused in sudoku puzzles. One public field, `mask`, the raw bitmask; it is
readable and writable. The constructor takes `initialMask` and coerces it with
unary `+`, so `new SmallNumberSet(otherSet)` works and copies, since `valueOf`
returns the mask. Iteration is ascending: `[...set]` yields members lowest
first. The class is the base for `SudokuDigitSet`; the mutating operators return
`this` for chaining, but `add`, `delete` and `clear` return `undefined`.

#### `get size()`
Number of members, via a `popCount` of the mask.
- **Returns:** number.

#### `add(numberToAdd)`
Sets bit `numberToAdd`.
- **Mutates:** the receiver. **Returns:** `undefined`, not `this`.

#### `delete(numberToDelete)`
Clears bit `numberToDelete`.
- **Mutates:** the receiver. **Returns:** `undefined`.
- **Notes:** no report of whether the member was present, unlike `Set.delete`.

#### `clear()`
Sets the mask to 0.
- **Mutates:** the receiver. **Returns:** `undefined`.

#### `union(otherSet)`
In-place OR of `otherSet` into the receiver.
- **Params:** `otherSet` – anything whose `valueOf()` is a bitmask, so another
  set or a plain number both work.
- **Returns:** `this`. **Mutates:** the receiver.
- **Notes:** this is the one that trips people up — it is not `a ∪ b` as a new
  set. `a.union(b)` changes `a`. Copy first: `new DigitSet(a).union(b)`.

#### `intersect(otherSet)`
In-place AND.
- **Returns:** `this`. **Mutates:** the receiver.

#### `xor(otherSet)`
In-place XOR: members in exactly one of the two.
- **Returns:** `this`. **Mutates:** the receiver.

#### `subtract(otherSet)`
In-place AND-NOT: removes every member of `otherSet`.
- **Returns:** `this`. **Mutates:** the receiver.

#### `has(number)`
Whether bit `number` is set.
- **Returns:** boolean. Does not mutate.

#### `equals(otherSet)`
Mask equality, using `+otherSet`.
- **Returns:** boolean.

#### `isSubsetOf(otherSet)`
True when every member of the receiver is in `otherSet`.
- **Returns:** boolean. Equal sets count as subsets.

#### `isSupersetOf(otherSet)`
True when the receiver contains every member of `otherSet`.
- **Returns:** boolean. Equal sets count as supersets.

#### `isDisjointFrom(otherSet)`
True when the masks share no bit.
- **Returns:** boolean.

#### `intersects(otherSet)`
True when the masks share at least one bit — the negation of `isDisjointFrom`.
- **Returns:** boolean.

#### `valueOf()`
The raw bitmask.
- **Returns:** number. This is what makes `+set`, `set | other`, `set & other`
  and `` `${+set}` `` work, and what every method above calls on its argument.
- **Notes:** there is no `toString` override, so `` `${set}` `` prints the
  number too (string coercion falls back to `valueOf` for a plain object). Use
  `+set` when you want the mask explicitly.

#### `getSmallestNumber()`
The lowest member.
- **Returns:** number, or `undefined` when the set is empty.

#### `getLargestNumber()`
The highest member.
- **Returns:** number, or `undefined` when the set is empty.

#### `[Symbol.iterator]()`
Yields members in ascending order, clearing the lowest set bit each step.
- **Returns:** generator of numbers. Works with `for…of`, spread and
  `Array.from`. It reads `this.mask` once at the start, so mutating the set
  mid-loop does not affect the remaining iteration.

#### `static from(numbers)`
Builds a set from any iterable of numbers.
- **Returns:** a new instance of the class it is called on — `new this(...)` —
  so `SudokuDigitSet.from([1,2,3])` gives a `SudokuDigitSet`.

#### `static getUnion(sets)`
Union of an iterable of sets.
- **Returns:** a new set. Does not mutate the inputs.

#### `static getIntersection(sets)`
Intersection of an iterable of sets.
- **Returns:** a new set.
- **Notes:** it starts from `2147483647` (all 31 low bits), so the intersection
  of an empty list is that full mask, not the empty set. Its size is 31.

### `SudokuDigitSet` (globals `SudokuDigitSet` and `DigitSet`)

`bundle.claude.js:619`. A `SmallNumberSet` with two renamed accessors and
nothing else added — no digit-range awareness of its own, so a `SudokuDigitSet`
can hold bit 0 or bit 12 if you put them there. The puzzle's actual digit range
lives on `helpers.digits`, whose `createFullDigitSet`, `createEvensDigitSet`,
`createOddsDigitSet`, `createModuloDigitSet(divisor, remainder)` and
`createFilteredDigitSet(predicate)` all return fresh `SudokuDigitSet`s built
inside the puzzle's min/max. The candidate masks on solver state are plain
numbers in the same bit convention, so `new DigitSet(cell.candidates)` is the
standard bridge.

#### `getSmallestDigit()`
Alias for `getSmallestNumber()`.
- **Returns:** number, or `undefined` when empty.

#### `getLargestDigit()`
Alias for `getLargestNumber()`.
- **Returns:** number, or `undefined` when empty.

### `MathUtils` (global `MathUtils`)

Scalar helpers, defined at `bundle.claude.js:766` as a plain object of free
functions. Nothing here is sudoku-specific.

#### `sum(numbers)`
Adds an iterable of numbers, starting at 0. **Returns:** number.

#### `product(numbers)`
Multiplies an iterable of numbers, starting at 1. **Returns:** number.

#### `mod(dividend, divisor)`
Euclidean remainder, `((a % b) + b) % b`. **Returns:** number, non-negative for
a positive divisor — unlike JavaScript's `%`, which keeps the sign of the
dividend.

#### `clamp(value, minValue, maxValue)`
`Math.min(Math.max(min, value), max)`. **Returns:** number. With `min > max` the
maximum wins.

#### `lerp(startValue, endValue, fraction)`
Linear interpolation, `start + (end - start) * fraction`. **Returns:** number.
The fraction is not clamped.

#### `triangularNumber(count)`
`count * (count + 1) / 2` — the sum 1..count, which is the standard minimum for
a killer cage of that many distinct digits starting at 1. **Returns:** number.

#### `isPrime(number)`
Primality by trial division over odd divisors, with a lookup table below 87 and
a memo `Map` above it. **Returns:** boolean.
- **Notes:** 0, 1 and negatives return false via the small-primes set. The cache
  grows without bound, which is fine at sudoku scale.

#### `getFactors(number)`
Full prime factorization, small primes first then odd candidates upward.
**Returns:** array of primes with multiplicity, e.g. 12 gives `[2, 2, 3]`.
- **Notes:** throws `Error("Cannot factorize non-integers")` on a non-integer.
  Called with 0 it never terminates — 0 is divisible by every prime and the
  magnitude never reaches 1. Guard the zero case yourself.

#### `toDegrees(radians)` / `toRadians(degrees)`
Angle conversion. **Returns:** number.

### `Vector2Funcs` (global `Vector2Funcs`)

Free functions over plain `{x, y}` points, at `bundle.claude.js:896`. Every one
of them takes and returns plain objects and mutates nothing — the mutating
`Vector2` class next to them is not exported to custom code. Cell coords from
`helpers.geometry` are exactly this shape, so these compose with it directly.

#### `getMagnitude(vector)`
`Math.hypot(x, y)`. **Returns:** number.

#### `normalized(vector)`
Unit vector in the same direction. **Returns:** a new `{x, y}`. A zero vector
gives `{x: NaN, y: NaN}`.

#### `scaled(vector, scaleFactor)`
Component-wise multiply by a scalar. **Returns:** a new `{x, y}`.

#### `sum(vectorA, vectorB)`
Component-wise addition. **Returns:** a new `{x, y}`. Note the name collision
with `MathUtils.sum`, which is a different thing entirely.

#### `difference(vectorA, vectorB)`
`a - b`, component-wise. **Returns:** a new `{x, y}`.

#### `scaledSum(vectorA, vectorB, scaleFactor)`
`a + b * scaleFactor`. **Returns:** a new `{x, y}`.

#### `getDistance(pointA, pointB)`
Euclidean distance. **Returns:** number.

#### `getDotProduct(vectorA, vectorB)`
`ax*bx + ay*by`. **Returns:** number.

#### `getAngle(vectorA, vectorB)`
Unsigned angle between two vectors, as `acos` of the dot product of their
normalizations. **Returns:** number in radians, 0 to π. Floating-point error can
push the argument just past ±1 and yield `NaN` for near-parallel inputs.

#### `getManhattanDistance(pointA, pointB)`
`|dx| + |dy|`. **Returns:** number. On integer cell coords this is the
king-free taxicab step count.

#### `getRotated(vector, angle)`
Rotation by `angle` radians. **Returns:** a new `{x, y}`.

#### `getClamped(point, rect)`
Clamps a point into a rect given as `{x, y, width, height}`. **Returns:** a new
`{x, y}`.

#### `compareVectors(pointA, pointB)`
Reading-order comparator: row first, then column. **Returns:** -1, 0 or 1, so it
drops straight into `Array.prototype.sort` for cell coords.

#### `isVectorGreaterThan(pointA, pointB)`
True when `a` comes after `b` in reading order. **Returns:** boolean.

#### `getAverage(points)`
Centroid of an iterable of points. **Returns:** a new `{x, y}`; an empty input
gives `{x: NaN, y: NaN}` (0/0).

### `SetUtils` (global `SetUtils`)

Helpers over native `Set` objects, at `bundle.claude.js:141`. Several accept an
options object `{comparator}`; when given, membership is decided by calling
`comparator(a, b)` pairwise instead of by identity, which costs O(n·m) but lets
you work with `{x, y}` coords and other structural values. Watch the in-place
versus copying split carefully — the names do not announce it.

#### `takeOne(sourceSet)`
Removes and returns the first element in iteration order.
- **Returns:** the element, or `undefined` on an empty set. **Mutates:**
  `sourceSet`.

#### `deleteAll(targetSet, itemsToDelete, options?)`
Removes every item of `itemsToDelete` from `targetSet`.
- **Returns:** `targetSet`. **Mutates:** `targetSet`.
- **Notes:** this is the in-place set difference. Its copying twin is
  `difference` below; the pair differs only in that. Pick `deleteAll` when you
  own the set, `difference` when you do not.

#### `difference(sourceSet, itemsToRemove, options?)`
Same removal, on a copy.
- **Returns:** a new `Set`. **Mutates:** nothing.

#### `symmetricDifference(leftCollection, rightCollection)`
Elements in exactly one of the two collections.
- **Returns:** a new `Set`.
- **Notes:** takes the fast path only when both arguments have a `has` method;
  otherwise it falls back to two `difference` calls unioned, so arrays work but
  cost more. No comparator option.

#### `filter(targetSet, otherSet)`
Retains in `targetSet` only what `otherSet.has`.
- **Returns:** `targetSet`. **Mutates:** `targetSet`. This is the in-place
  intersection, despite the name suggesting a predicate; it takes a set, not a
  function.

#### `intersection(sourceSet, otherSet)`
The same intersection, on a copy.
- **Returns:** a new `Set`. **Mutates:** nothing.

#### `addAll(targetSet, itemsToAdd)`
Adds every item of an iterable.
- **Returns:** `targetSet`. **Mutates:** `targetSet`.

#### `union(leftSet, rightSet)`
- **Returns:** a new `Set` with both sides' elements. **Mutates:** nothing.

#### `isEqual(leftSet, rightSet, options?)`
Size check, then `hasAll`.
- **Returns:** boolean.
- **Notes:** with a comparator the size check still uses raw `size`, so two sets
  that a loose comparator would call equal but that differ in cardinality
  return false.

#### `hasAll(containerSet, items, options?)`
Whether `containerSet` contains every item of the iterable.
- **Returns:** boolean. An empty `items` gives true.

#### `hasSome(containerSet, items, options?)`
Whether it contains at least one.
- **Returns:** boolean. An empty `items` gives false.

#### `hasSomeWhere(sourceSet, predicate)`
Whether any element satisfies `predicate`.
- **Returns:** boolean. This is the one that really takes a function.

### `IterationUtils` (global `IterationUtils`)

Iterable helpers, at `bundle.claude.js:197`. Three of the six are generators, so
their results are consumed once — spread them if you need to iterate twice.

#### `getOne(iterable)`
First element, by opening the iterator once.
- **Returns:** the element, or `undefined` when empty. Does not consume more
  than one step of a generator.

#### `getRange(startValue, endValue)`
Ascending integers, `start` up to but excluding `end`.
- **Returns:** generator of numbers. Empty when `start >= end`.

#### `getRangeInclusive(startValue, endValue)`
Same, including `end`. Use this one for digits: `getRangeInclusive(spec.minDigit,
spec.maxDigit)`.
- **Returns:** generator of numbers.

#### `getCombinations(items, size)`
Every combination of exactly `size` elements, in lexicographic index order.
- **Params:** `items` – any iterable; it is materialized to an array first.
- **Returns:** generator of arrays, each a fresh array.
- **Notes:** yields nothing when `size` exceeds the item count. `size` 0 yields
  one empty array and then stops. It combines by position, not by value, so
  duplicate items produce duplicate combinations. Cost is C(n, k) — fine for one
  cage, expensive if you nest it per cell per solve step.

#### `getCounts(items)`
Tallies occurrences.
- **Returns:** a `Map` from value to count, keyed by `Map` identity semantics.

#### `getBest(items, scoreFn, fallback)`
The element with the highest `scoreFn` value.
- **Returns:** the winning element, or `fallback` when `items` is empty.
- **Notes:** strictly greater wins, so the first of several tied maxima is kept.
  The initial best score is `-Infinity`, so an element scoring `-Infinity` never
  beats the fallback.

### `ArrayUtils` (global `ArrayUtils`)

Array helpers, at `bundle.claude.js:1825`. The same `{comparator}` option
appears throughout with the same meaning as in `SetUtils`. The in-place members
(`remove`, `removeWhere`, `removeFirst`, `removeFirstWhere`) all return the same
array they were handed, which makes an accidental aliasing bug easy to write.

#### `count(values, target, {comparator}?)`
How many elements equal `target`; the default comparator is `===`.
- **Returns:** number.

#### `countWhere(values, predicate)`
How many elements satisfy `predicate`. **Returns:** number.

#### `removeFirst(array, value, options?)`
Splices out the first occurrence.
- **Returns:** `array`. **Mutates:** `array`. A miss is a no-op.

#### `removeFirstWhere(array, predicate)`
Splices out the first match of `predicate`.
- **Returns:** `array`. **Mutates:** `array`.

#### `withoutAll(array, valuesToRemove, options?)`
Every element not in `valuesToRemove`.
- **Returns:** a new array. **Mutates:** nothing. Uses a `Set` for the
  comparator-free path.

#### `remove(array, valuesToRemove, options?)`
The same filtering, applied in place by emptying and refilling the array.
- **Returns:** `array`. **Mutates:** `array`. This and `withoutAll` are the
  array-side copy/in-place twin pair.

#### `removeWhere(array, predicate)`
Drops every element satisfying `predicate`, in place.
- **Returns:** `array`. **Mutates:** `array`.

#### `includesSome(array, values, options?)`
Whether any of `values` appears. **Returns:** boolean.

#### `includesEvery(array, values, options?)`
Whether all of `values` appear. **Returns:** boolean; empty `values` gives true.

#### `shuffled(array)`
Fisher-Yates on a copy, using `Math.random`.
- **Returns:** a new array. **Mutates:** nothing.
- **Notes:** non-deterministic, so keep it out of `update` if you want
  reproducible solve output.

#### `mapIterable(iterable, mapFn)`
Maps any iterable into an array. **Returns:** a new array. `mapFn` receives the
element only, no index.

#### `sliceWrapped(array, start, end)`
Slice with wraparound indexing, via Euclidean mod, so negative and
past-the-end indices wrap. Useful for cyclic lines and rings.
- **Returns:** a new array of length `end - start`, or `[]` for an empty input.
  Elements repeat when the span exceeds the array length.

#### `chunk(array, chunkSize)`
Splits into consecutive runs of `chunkSize`, the last possibly short.
- **Returns:** array of arrays.

#### `areSameLength(...arrays)`
Whether all arguments have equal length. **Returns:** boolean; true for no
arguments.

#### `hasDuplicates(array, options?)`
Whether any value repeats. **Returns:** boolean. The comparator path is O(n²).

#### `withoutDuplicates(array, options?)`
Deduplicates, keeping first occurrences.
- **Returns:** a new array. `Set`-based without a comparator, O(n²) with one.

#### `ensureArray(value)`
`Array.isArray(value) ? value : [value]`.
- **Returns:** an array. **Notes:** it does not copy an array input, so the
  result may alias the caller's array. It does not unwrap a `Set` either — a
  `Set` comes back wrapped as a single element.

#### `createFilledArray(length, fillValue)`
`new Array(length).fill(fillValue)`.
- **Returns:** a new array. **Notes:** every slot holds the same reference, so
  do not fill with an object or array you intend to mutate per index.

### `CombinatoricUtils` (global `CombinatoricUtils`)

One function, at `bundle.claude.js:3342`. This is the sum-combination search
behind killer-style reasoning.

#### `getCombinationsForSum(values, targetSum, minCount = 1, maxCount = Infinity)`
Every combination of distinct positions in `values` whose elements add to
`targetSum`, with a size between `minCount` and `maxCount`.
- **Params:** `values` – iterable of numbers, copied and sorted ascending
  internally. `targetSum` – the total to hit. `minCount`/`maxCount` – inclusive
  bounds on combination length.
- **Returns:** generator of arrays, each ascending, each a fresh array.
- **Notes:** no element is reused, and equal values at different positions are
  deduplicated, so `[1,1,2]` never yields `[1,1]` twice. It prunes on
  `value > remainingSum`, which assumes non-negative values — negatives break
  the pruning and the results. `targetSum` 0 yields the empty combination only
  when `minCount` is 0. A digit set needs converting first:
  `getCombinationsForSum([...digitSet], 15, 2, 2)`.

### `OuterPosition` (global `OuterPosition`)

A numeric enum of the eight outer-clue anchor positions, at
`bundle.claude.js:677`: `Top` 0, `Right` 1, `Bottom` 2, `Left` 3, `TopLeft` 4,
`TopRight` 5, `BottomRight` 6, `BottomLeft` 7. It is the usual TypeScript
two-way enum object, so `OuterPosition[0]` is the string `"Top"`. The geometry
helper uses it to turn an outer cell into the row, column or diagonal it points
along; the four corners are the diagonal cases.

### `DiagonalType` (global `DiagonalType`)

A numeric enum with two members, at `bundle.claude.js:697`: `PositiveDiagonal`
is `1` and `NegativeDiagonal` is `-1`. The values are the x-step direction used
when walking a diagonal, not arbitrary tags, so they can be multiplied into
coordinate arithmetic. Also two-way: `DiagonalType[1]` is `"PositiveDiagonal"`.
Beware the sign intuition — in screen coords, where y grows downward, the
"negative" diagonal is the one running top-left to bottom-right.

> Discrepancy: the brief lists `../../bundle-api-index.md` as required reading,
> but no such file exists in `docs/research/humanify-pedagogy/`. This section was
> written against `docs/puzzle-api.md` and `docs/component-contract.md` only.

> Discrepancy: `docs/puzzle-api.md:61-62` lists `createFullDigitSet()` and
> `createOddsDigitSet()` / `createEvensDigitSet()` as **[docs]**, unverified.
> Both are real, on `DigitsHelper` at `bundle.claude.js:626`, along with two
> undocumented siblings, `createModuloDigitSet(divisor, remainder)` and
> `createFilteredDigitSet(predicate)`. All four build within the puzzle's
> `minDigit`..`maxDigit` range.

> Discrepancy: `docs/puzzle-api.md:104` calls `set.intersect` / `.union` /
> `.subtract` "Set algebra" that mutates and returns the receiver, which is
> right, but the table omits `xor`, which behaves identically, and omits the
> non-mutating statics `SmallNumberSet.getUnion(sets)` and
> `.getIntersection(sets)` (`bundle.claude.js:606-615`) that do give a fresh set.
