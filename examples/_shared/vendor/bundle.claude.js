(function () {
  "use strict";
  class CellIds {
    spec;
    width;
    height;
    constructor(spec) {
      ((this.spec = spec),
        (this.width = spec.size.width),
        (this.height = spec.size.height));
    }
    getX(cellId) {
      return cellId % this.width;
    }
    getY(cellId) {
      return Math.floor(cellId / this.width);
    }
    getCoordsFromId(cellId) {
      return { x: this.getX(cellId), y: this.getY(cellId) };
    }
    getIdFromCoords(coords) {
      return coords.x + coords.y * this.width;
    }
    getIdFromCoordsSafe(coords) {
      if (!(
        coords.x < 0 ||
        coords.y < 0 ||
        coords.x >= this.width ||
        coords.y >= this.height
      ))
        return this.getIdFromCoords(coords);
    }
    areValidCoords({ x: x, y: y }) {
      return x >= 0 && y >= 0 && x < this.width && y < this.height;
    }
    getAllCellIds() {
      return Array.from(
        { length: this.width * this.height },
        (unusedElement, index) => index,
      );
    }
    getCellCenterFromId(cellId) {
      return { x: this.getX(cellId) + 0.5, y: this.getY(cellId) + 0.5 };
    }
  }
  function takeOneFromSet(sourceSet) {
    for (const firstItem of sourceSet)
      return (sourceSet.delete(firstItem), firstItem);
  }
  function deleteAllFromSet(targetSet, itemsToDelete, options) {
    if (options?.comparator)
      for (const itemToDelete of itemsToDelete)
        for (const existingItem of targetSet)
          options.comparator(itemToDelete, existingItem) &&
            targetSet.delete(existingItem);
    else
      for (const itemToRemove of itemsToDelete) targetSet.delete(itemToRemove);
    return targetSet;
  }
  function differenceOfSets(sourceSet, itemsToRemove, options) {
    const resultSet = new Set(sourceSet);
    if (options?.comparator)
      for (const itemToRemove of itemsToRemove)
        for (const existingItem of resultSet)
          options?.comparator(existingItem, itemToRemove) &&
            resultSet.delete(existingItem);
    else for (const removedItem of itemsToRemove) resultSet.delete(removedItem);
    return resultSet;
  }
  function symmetricDifferenceOfCollections(leftCollection, rightCollection) {
    return "has" in leftCollection && "has" in rightCollection
      ? symmetricDifferenceOfSets(leftCollection, rightCollection)
      : unionOfSets(
          differenceOfSets(leftCollection, rightCollection),
          differenceOfSets(rightCollection, leftCollection),
        );
  }
  function symmetricDifferenceOfSets(leftSet, rightSet) {
    const resultSet = new Set();
    for (const leftItem of leftSet)
      rightSet.has(leftItem) || resultSet.add(leftItem);
    for (const rightItem of rightSet)
      leftSet.has(rightItem) || resultSet.add(rightItem);
    return resultSet;
  }
  function retainIntersectionInSet(targetSet, otherSet) {
    for (const item of targetSet) otherSet.has(item) || targetSet.delete(item);
    return targetSet;
  }
  function intersectionOfSets(sourceSet, otherSet) {
    const resultSet = new Set(sourceSet);
    for (const item of sourceSet) otherSet.has(item) || resultSet.delete(item);
    return resultSet;
  }
  function addAllToSet(targetSet, itemsToAdd) {
    for (const item of itemsToAdd) targetSet.add(item);
    return targetSet;
  }
  function unionOfSets(leftSet, rightSet) {
    const resultSet = new Set(leftSet);
    for (const item of rightSet) resultSet.add(item);
    return resultSet;
  }
  function setsAreEqual(leftSet, rightSet, options) {
    return leftSet.size !== rightSet.size
      ? !1
      : setHasAllOf(leftSet, rightSet, options);
  }
  function setHasAllOf(containerSet, items, options) {
    if (options?.comparator) {
      const comparator = options.comparator;
      for (const item of items) {
        let found = !1;
        for (const candidateItem of containerSet)
          if (comparator(candidateItem, item)) {
            found = !0;
            break;
          }
        if (!found) return !1;
      }
      return !0;
    }
    for (const plainItem of items) if (!containerSet.has(plainItem)) return !1;
    return !0;
  }
  function setHasSomeOf(containerSet, items, options) {
    if (options?.comparator) {
      const comparator = options.comparator;
      for (const item of items)
        for (const candidateItem of containerSet)
          if (comparator(candidateItem, item)) return !0;
      return !1;
    }
    for (const plainItem of items) if (containerSet.has(plainItem)) return !0;
    return !1;
  }
  function setHasSomeWhere(sourceSet, predicate) {
    for (const item of sourceSet) if (predicate(item)) return !0;
    return !1;
  }
  const SetUtils = {
    takeOne: takeOneFromSet,
    deleteAll: deleteAllFromSet,
    difference: differenceOfSets,
    symmetricDifference: symmetricDifferenceOfCollections,
    filter: retainIntersectionInSet,
    intersection: intersectionOfSets,
    addAll: addAllToSet,
    union: unionOfSets,
    isEqual: setsAreEqual,
    hasAll: setHasAllOf,
    hasSome: setHasSomeOf,
    hasSomeWhere: setHasSomeWhere,
  };
  function getFirstOfIterable(iterable) {
    return iterable[Symbol.iterator]().next().value;
  }
  function* iterateRangeExclusive(startValue, endValue) {
    for (let value = startValue; value < endValue; value++) yield value;
  }
  function* iterateRangeInclusive(startValue, endValue) {
    for (let value = startValue; value <= endValue; value++) yield value;
  }
  function* iterateCombinationsOfSize(items, size) {
    const itemArray = [...items],
      itemCount = itemArray.length;
    if (size > itemCount) return;
    const indices = Array.from(
      { length: size },
      (unusedSlot, position) => position,
    );
    for (yield indices.map((indexValue) => itemArray[indexValue]); ;) {
      let pivot = size - 1;
      for (; pivot >= 0 && indices[pivot] === pivot + itemCount - size;)
        pivot--;
      if (pivot === -1) return;
      indices[pivot]++;
      for (let fillIndex = pivot + 1; fillIndex < size; fillIndex++)
        indices[fillIndex] = indices[fillIndex - 1] + 1;
      yield indices.map((combinationIndex) => itemArray[combinationIndex]);
    }
  }
  function countOccurrencesByValue(items) {
    const counts = new Map();
    for (const item of items) counts.set(item, (counts.get(item) || 0) + 1);
    return counts;
  }
  function getBestByScore(items, scoreFn, fallback) {
    let bestScore = -1 / 0,
      bestItem = fallback;
    for (const item of items) {
      const score = scoreFn(item);
      score > bestScore && ((bestItem = item), (bestScore = score));
    }
    return bestItem;
  }
  const IterationUtils = {
    getOne: getFirstOfIterable,
    getRange: iterateRangeExclusive,
    getRangeInclusive: iterateRangeInclusive,
    getCombinations: iterateCombinationsOfSize,
    getCounts: countOccurrencesByValue,
    getBest: getBestByScore,
  };
  function deepClone(value) {
    if (Array.isArray(value))
      return value.map((arrayElement) => deepClone(arrayElement));
    if (value instanceof Set)
      return new Set([...value].map((setElement) => deepClone(setElement)));
    if (value instanceof Map)
      return new Map(
        [...value].map(([mapKey, mapValue]) => [mapKey, deepClone(mapValue)]),
      );
    if (value && typeof value == "object") {
      if ("clone" in value && typeof value.clone == "function")
        return value.clone();
      const clonedObject = {};
      for (const key in value) clonedObject[key] = deepClone(value[key]);
      return clonedObject;
    }
    return value;
  }
  const internedCloneByObject = new WeakMap(),
    internedCloneBySerialization = new Map();
  function serializeForInternKey(value) {
    if (["string", "number", "boolean"].includes(typeof value))
      return value.toString();
    let serialized = "";
    for (const [key, propertyValue] of Object.entries(value))
      serialized += `${key}:(${serializeForInternKey(propertyValue)});`;
    return serialized;
  }
  function internStructuredValue(value) {
    if (value == null || ["string", "number", "boolean"].includes(typeof value))
      return value;
    if (internedCloneByObject.has(value))
      return internedCloneByObject.get(value);
    const serialKey = serializeForInternKey(value);
    if (internedCloneBySerialization.has(serialKey)) {
      const existingClone = internedCloneBySerialization.get(serialKey);
      return (internedCloneByObject.set(value, existingClone), existingClone);
    }
    const newClone = deepClone(value);
    return (
      internedCloneBySerialization.set(serialKey, newClone),
      internedCloneByObject.set(value, newClone),
      newClone
    );
  }
  class LineGraph {
    constructor(
      lines = [],
      comparator = (leftPoint, rightPoint) => leftPoint > rightPoint,
    ) {
      this.isGreaterThan = comparator;
      for (const line of lines) this.addLine(line);
    }
    pointsConnected = new Map();
    addLine(line) {
      for (let index = 0; index < line.length - 1; index++)
        this.addEdge(line[index], line[index + 1]);
      return this;
    }
    addPoint(point) {
      this.pointsConnected.has(point) ||
        this.pointsConnected.set(point, new Set());
    }
    addPoints(points) {
      for (const point of points) this.addPoint(point);
    }
    addEdge(pointA, pointB) {
      return (
        (pointA = internStructuredValue(pointA)),
        (pointB = internStructuredValue(pointB)),
        this.pointsConnected.has(pointA) ||
          this.pointsConnected.set(pointA, new Set()),
        this.pointsConnected.has(pointB) ||
          this.pointsConnected.set(pointB, new Set()),
        this.pointsConnected.get(pointA).add(pointB),
        this.pointsConnected.get(pointB).add(pointA),
        this
      );
    }
    removeEdge(pointA, pointB, pruneIsolated = !0) {
      return (
        (pointA = internStructuredValue(pointA)),
        (pointB = internStructuredValue(pointB)),
        !this.pointsConnected.has(pointA) || !this.pointsConnected.has(pointB)
          ? this
          : (this.pointsConnected.get(pointA)?.delete(pointB),
            pruneIsolated &&
              this.pointsConnected.get(pointA)?.size === 0 &&
              this.pointsConnected.delete(pointA),
            this.pointsConnected.get(pointB)?.delete(pointA),
            pruneIsolated &&
              this.pointsConnected.get(pointB)?.size === 0 &&
              this.pointsConnected.delete(pointB),
            this)
      );
    }
    removePoint(point) {
      if (
        ((point = internStructuredValue(point)),
        !this.pointsConnected.has(point))
      )
        return this;
      for (const neighborPoint of this.pointsConnected.get(point))
        this.removeEdge(point, neighborPoint);
      return this;
    }
    hasEdge(pointA, pointB) {
      return (
        (pointA = internStructuredValue(pointA)),
        (pointB = internStructuredValue(pointB)),
        !!this.pointsConnected.get(pointA)?.has(pointB)
      );
    }
    hasPoint(point) {
      return (
        (point = internStructuredValue(point)),
        this.pointsConnected.has(point)
      );
    }
    getPoints() {
      return [...this.pointsConnected.keys()];
    }
    *getEdges() {
      for (const [point, neighbors] of this.pointsConnected)
        for (const neighborPoint of neighbors)
          this.isGreaterThan(neighborPoint, point) &&
            (yield [point, neighborPoint]);
    }
    getPointsAdjacentTo(point) {
      return (
        (point = internStructuredValue(point)),
        this.pointsConnected.get(point) || new Set()
      );
    }
    getPointCount() {
      return this.pointsConnected.size;
    }
    isEmpty() {
      return this.pointsConnected.size === 0;
    }
    *getAllComponents() {
      const remainingPoints = new Set(this.getPoints());
      for (; remainingPoints.size > 0;) {
        const component = this.getComponentContainingPoint(
          takeOneFromSet(remainingPoints),
        );
        for (const componentPoint of component.getPoints())
          remainingPoints.delete(componentPoint);
        yield component;
      }
    }
    *getConnectedPointSets(points) {
      points
        ? (points = [...points].map((point) => internStructuredValue(point)))
        : (points = this.getPoints());
      const remainingPoints = new Set(points);
      for (; remainingPoints.size > 0;) {
        const connectedPoints = this.getPointsConnectedTo(
          takeOneFromSet(remainingPoints),
        );
        for (const connectedPoint of connectedPoints)
          remainingPoints.delete(connectedPoint);
        yield [...connectedPoints];
      }
    }
    getPointsConnectedTo(startPoint) {
      startPoint = internStructuredValue(startPoint);
      const visited = new Set(),
        queue = new Set([startPoint]);
      for (; queue.size > 0;) {
        const currentPoint = takeOneFromSet(queue);
        if (!(
          visited.has(currentPoint) || !this.pointsConnected.has(currentPoint)
        )) {
          visited.add(currentPoint);
          for (const neighborPoint of this.pointsConnected.get(currentPoint))
            queue.add(neighborPoint);
        }
      }
      return visited;
    }
    getComponentContainingPoint(startPoint) {
      startPoint = internStructuredValue(startPoint);
      const connectedPoints = this.getPointsConnectedTo(startPoint),
        componentGraph = new LineGraph([], this.isGreaterThan);
      componentGraph.addPoints(connectedPoints);
      for (const point of connectedPoints)
        for (const neighborPoint of this.pointsConnected.get(point))
          this.isGreaterThan(neighborPoint, point) &&
            componentGraph.addEdge(point, neighborPoint);
      return componentGraph;
    }
    getComponentsContainingPoints(points) {
      points = [...points].map((point) => internStructuredValue(point));
      const remainingPoints = new Set(points),
        groups = [];
      for (; remainingPoints.size > 0;) {
        const startPoint = takeOneFromSet(remainingPoints),
          groupPoints = [...this.getPointsConnectedTo(startPoint)];
        (deleteAllFromSet(remainingPoints, groupPoints),
          groups.push(groupPoints));
      }
      const componentGraph = new LineGraph([], this.isGreaterThan);
      componentGraph.addPoints(points);
      for (const group of groups)
        for (const groupPoint of group)
          for (const neighborPoint of this.pointsConnected.get(groupPoint))
            this.isGreaterThan(neighborPoint, groupPoint) &&
              componentGraph.addEdge(groupPoint, neighborPoint);
      return componentGraph;
    }
    isSimpleLines() {
      for (const neighbors of this.pointsConnected.values())
        if (neighbors.size > 2) return !1;
      return !0;
    }
    hasCycles() {
      const visited = new Set(),
        inStack = new Set(),
        visit = (point, parentPoint) => {
          if (!visited.has(point)) {
            (visited.add(point), inStack.add(point));
            const neighbors = this.pointsConnected.get(point);
            if (neighbors) {
              for (const neighborPoint of neighbors)
                if (
                  neighborPoint !== parentPoint &&
                  ((!visited.has(neighborPoint) &&
                    visit(neighborPoint, point)) ||
                    inStack.has(neighborPoint))
                )
                  return !0;
            }
          }
          return (inStack.delete(point), !1);
        };
      for (const startPoint of this.getPoints())
        if (!visited.has(startPoint) && visit(startPoint)) return !0;
      return !1;
    }
    toArrays() {
      const graphCopy = this.clone(),
        findEndpoint = () => {
          for (const point of graphCopy.pointsConnected.keys())
            if (graphCopy.pointsConnected.get(point).size === 1) return point;
          return getFirstOfIterable(graphCopy.pointsConnected.keys());
        };
      let stepCount = 0;
      function traceLine() {
        const visited = new Set(),
          linePoints = [];
        let currentPoint = findEndpoint();
        for (;;) {
          if ((stepCount++, stepCount > 1e3))
            throw new Error("This should never happen");
          if ((linePoints.push(currentPoint), visited.has(currentPoint)))
            return linePoints;
          visited.add(currentPoint);
          const neighbors = graphCopy.pointsConnected.get(currentPoint),
            nextPoint = neighbors ? getFirstOfIterable(neighbors) : void 0;
          if (nextPoint === void 0) return linePoints;
          (graphCopy.removeEdge(currentPoint, nextPoint),
            (currentPoint = nextPoint));
        }
      }
      const lines = [];
      for (; graphCopy.getPointCount() > 0;) lines.push(traceLine());
      return lines;
    }
    clone() {
      return new LineGraph(this.getEdges(), this.isGreaterThan);
    }
  }
  class ConnectivityHelper {
    spec;
    geometryHelper;
    constructor(geometryHelper) {
      ((this.spec = geometryHelper.spec),
        (this.geometryHelper = geometryHelper));
    }
    getOrthogonallyConnectedGroups(cells) {
      const cellSet = new Set(cells),
        graph = new LineGraph();
      for (const cellToAdd of cells) graph.addPoint(cellToAdd);
      for (const cell of cells)
        for (const adjacentCell of this.geometryHelper.getOrthogonallyAdjacentCells(
          cell,
        ))
          cellSet.has(adjacentCell) && graph.addEdge(cell, adjacentCell);
      return graph.getAllComponents();
    }
  }
  class CornerIds {
    constructor(cellIdHelper) {
      ((this.cellIdHelper = cellIdHelper), (this.spec = cellIdHelper.spec));
    }
    spec;
    getIdFromCornerCoords(cornerCoords) {
      return cornerCoords.x + cornerCoords.y * (this.spec.size.width + 1);
    }
    getCoordsFromId(cornerId) {
      return {
        x: cornerId % (this.spec.size.width + 1),
        y: Math.floor(cornerId / (this.spec.size.width + 1)),
      };
    }
  }
  function buildDigitMask(digits) {
    let mask = 0;
    for (const digit of digits) mask |= 1 << digit;
    return mask;
  }
  function listDigitsInMask(mask) {
    const digits = [];
    for (; mask;)
      (digits.push(31 - Math.clz32(mask & -mask)), (mask &= mask - 1));
    return digits;
  }
  function popCount(bits) {
    return (
      (bits >>>= 0),
      (bits -= (bits >>> 1) & 1431655765),
      (bits = (bits & 858993459) + ((bits >>> 2) & 858993459)),
      (bits = (bits + (bits >>> 4)) & 252645135),
      (bits * 16843009) >>> 24
    );
  }
  function isSingleCandidateMask(mask) {
    return mask && (mask & (mask - 1)) === 0;
  }
  function lowestSetBitIndex(mask) {
    if (mask !== 0) return 31 - Math.clz32(mask & -mask);
  }
  function highestSetBitIndex(mask) {
    if (mask !== 0) return 31 - Math.clz32(mask);
  }
  class SmallNumberSet {
    mask;
    constructor(initialMask = 0) {
      this.mask = +initialMask;
    }
    get size() {
      return popCount(this.mask);
    }
    add(numberToAdd) {
      this.mask |= 1 << numberToAdd;
    }
    delete(numberToDelete) {
      this.mask &= ~(1 << numberToDelete);
    }
    clear() {
      this.mask = 0;
    }
    union(otherSet) {
      return ((this.mask |= otherSet.valueOf()), this);
    }
    intersect(otherSet) {
      return ((this.mask &= otherSet.valueOf()), this);
    }
    xor(otherSet) {
      return ((this.mask ^= otherSet.valueOf()), this);
    }
    subtract(otherSet) {
      return ((this.mask &= ~otherSet.valueOf()), this);
    }
    has(number) {
      return (this.mask & (1 << number)) !== 0;
    }
    equals(otherSet) {
      return this.mask === +otherSet;
    }
    isSubsetOf(otherSet) {
      const otherMask = otherSet.valueOf();
      return (this.mask & otherMask) === this.mask;
    }
    isSupersetOf(otherSet) {
      const otherMask = otherSet.valueOf();
      return (this.mask & otherMask) === otherMask;
    }
    isDisjointFrom(otherSet) {
      return (this.mask & otherSet.valueOf()) === 0;
    }
    intersects(otherSet) {
      return (this.mask & otherSet.valueOf()) !== 0;
    }
    valueOf() {
      return this.mask;
    }
    getSmallestNumber() {
      return lowestSetBitIndex(this.mask);
    }
    getLargestNumber() {
      return highestSetBitIndex(this.mask);
    }
    *[Symbol.iterator]() {
      let remainingMask = this.mask;
      for (; remainingMask;)
        (yield 31 - Math.clz32(remainingMask & -remainingMask),
          (remainingMask &= remainingMask - 1));
    }
    static from(numbers) {
      return new this(buildDigitMask(numbers));
    }
    static getUnion(sets) {
      const unionSet = new this();
      for (const set of sets) unionSet.union(set);
      return unionSet;
    }
    static getIntersection(sets) {
      const intersectionSet = new this(2147483647);
      for (const set of sets) intersectionSet.intersect(set);
      return intersectionSet;
    }
  }
  class SudokuDigitSet extends SmallNumberSet {
    getSmallestDigit() {
      return this.getSmallestNumber();
    }
    getLargestDigit() {
      return this.getLargestNumber();
    }
  }
  class DigitsHelper {
    minDigit;
    maxDigit;
    allDigitsMask;
    constructor(spec) {
      ((this.minDigit = spec.minDigit),
        (this.maxDigit = spec.maxDigit),
        (this.allDigitsMask =
          (1 << (this.maxDigit + 1)) - (1 << this.minDigit)));
    }
    createFullDigitSet() {
      return new SudokuDigitSet(this.allDigitsMask);
    }
    createEvensDigitSet() {
      return new SudokuDigitSet(this.allDigitsMask & 1431655765);
    }
    createOddsDigitSet() {
      return new SudokuDigitSet(this.allDigitsMask & 2863311530);
    }
    createModuloDigitSet(divisor, remainder) {
      const digitSet = new SudokuDigitSet();
      for (let digit = this.minDigit; digit <= this.maxDigit; digit++)
        digit % divisor === remainder && digitSet.add(digit);
      return digitSet;
    }
    createFilteredDigitSet(predicate) {
      const digitSet = new SudokuDigitSet();
      for (let digit = this.minDigit; digit <= this.maxDigit; digit++)
        predicate(digit) && digitSet.add(digit);
      return digitSet;
    }
  }
  class EdgeIds {
    constructor(cellIdHelper) {
      ((this.cellIdHelper = cellIdHelper), (this.spec = cellIdHelper.spec));
    }
    spec;
    getIdFromCoords(coords) {
      return Math.floor(coords.x) + (coords.y - 0.5) * this.spec.size.width * 2;
    }
    getCoordsFromId(edgeId) {
      const { width: width } = this.spec.size;
      return edgeId % (width * 2) < width
        ? { x: edgeId % width, y: Math.floor(edgeId / (width * 2)) + 0.5 }
        : {
            x: 0.5 + (edgeId % width),
            y: Math.floor(edgeId / (width * 2)) + 1,
          };
    }
  }
  var OuterPosition = ((positionEnum) => (
      (positionEnum[(positionEnum.Top = 0)] = "Top"),
      (positionEnum[(positionEnum.Right = 1)] = "Right"),
      (positionEnum[(positionEnum.Bottom = 2)] = "Bottom"),
      (positionEnum[(positionEnum.Left = 3)] = "Left"),
      (positionEnum[(positionEnum.TopLeft = 4)] = "TopLeft"),
      (positionEnum[(positionEnum.TopRight = 5)] = "TopRight"),
      (positionEnum[(positionEnum.BottomRight = 6)] = "BottomRight"),
      (positionEnum[(positionEnum.BottomLeft = 7)] = "BottomLeft"),
      positionEnum
    ))(OuterPosition || {}),
    HouseType = ((houseTypeEnum) => (
      (houseTypeEnum.Row = "Row"),
      (houseTypeEnum.Column = "Column"),
      (houseTypeEnum.Region = "Region"),
      (houseTypeEnum.ExtraRegion = "ExtraRegion"),
      (houseTypeEnum.DiagonalMinus = "DiagonalMinus"),
      (houseTypeEnum.DiagonalPlus = "DiagonalPlus"),
      houseTypeEnum
    ))(HouseType || {}),
    DiagonalType = ((diagonalTypeEnum) => (
      (diagonalTypeEnum[(diagonalTypeEnum.PositiveDiagonal = 1)] =
        "PositiveDiagonal"),
      (diagonalTypeEnum[(diagonalTypeEnum.NegativeDiagonal = -1)] =
        "NegativeDiagonal"),
      diagonalTypeEnum
    ))(DiagonalType || {});
  function sumOfNumbers(numbers) {
    let total = 0;
    for (const number of numbers) total += number;
    return total;
  }
  function productOfNumbers(numbers) {
    let product = 1;
    for (const number of numbers) product *= number;
    return product;
  }
  function modulo(dividend, divisor) {
    return ((dividend % divisor) + divisor) % divisor;
  }
  function clamp(value, minValue, maxValue) {
    return Math.min(Math.max(minValue, value), maxValue);
  }
  function lerp(startValue, endValue, fraction) {
    return startValue + (endValue - startValue) * fraction;
  }
  function triangularNumber(count) {
    return (count * (count + 1)) / 2;
  }
  const SmallPrimes = [
      2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67,
      71, 73, 79, 83,
    ],
    SmallPrimeSet = new Set(SmallPrimes),
    primalityCache = new Map();
  function isPrime(number) {
    if (number < 87) return SmallPrimeSet.has(number);
    if (primalityCache.has(number)) return primalityCache.get(number);
    if (number % 2 === 0) return (primalityCache.set(number, !1), !1);
    for (let divisor = 3; divisor * divisor <= number; divisor += 2)
      if (number % divisor === 0) return (primalityCache.set(number, !1), !1);
    return (primalityCache.set(number, !0), !0);
  }
  function getPrimeFactors(number) {
    if (number % 1 !== 0) throw new Error("Cannot factorize non-integers");
    const factors = [];
    let primeIndex = 0;
    for (; primeIndex < SmallPrimes.length;) {
      const prime = SmallPrimes[primeIndex];
      for (; number % prime === 0;) (factors.push(prime), (number /= prime));
      if (Math.abs(number) === 1) return factors;
      primeIndex++;
    }
    for (
      let candidatePrime = SmallPrimes[SmallPrimes.length - 1] + 2;
      ;
      candidatePrime += 2
    )
      if (isPrime(candidatePrime)) {
        for (; number % candidatePrime === 0;)
          (factors.push(candidatePrime), (number /= candidatePrime));
        if (Math.abs(number) === 1) return factors;
      }
  }
  function radiansToDegrees(radians) {
    return (radians / Math.PI) * 180;
  }
  function degreesToRadians(degrees) {
    return (degrees / 180) * Math.PI;
  }
  const MathUtils = {
    sum: sumOfNumbers,
    product: productOfNumbers,
    mod: modulo,
    clamp: clamp,
    lerp: lerp,
    triangularNumber: triangularNumber,
    isPrime: isPrime,
    getFactors: getPrimeFactors,
    toDegrees: radiansToDegrees,
    toRadians: degreesToRadians,
  };
  class Vector2 {
    constructor(x = 0, y = 0) {
      ((this.x = x), (this.y = y));
    }
    get magnitude() {
      return Math.hypot(this.x, this.y);
    }
    get magnitudeSqr() {
      return this.x * this.x + this.y * this.y;
    }
    add(otherVector) {
      return ((this.x += otherVector.x), (this.y += otherVector.y), this);
    }
    addScaled(otherVector, scaleFactor) {
      return (
        (this.x += otherVector.x * scaleFactor),
        (this.y += otherVector.y * scaleFactor),
        this
      );
    }
    subtract(otherVector) {
      return ((this.x -= otherVector.x), (this.y -= otherVector.y), this);
    }
    rotate(angle) {
      const cosAngle = Math.cos(angle),
        sinAngle = Math.sin(angle),
        { x: currentX, y: currentY } = this;
      return (
        (this.x = cosAngle * currentX - sinAngle * currentY),
        (this.y = sinAngle * currentX + cosAngle * currentY),
        this
      );
    }
    scale(scaleFactor) {
      return ((this.x *= scaleFactor), (this.y *= scaleFactor), this);
    }
    normalize() {
      const magnitude = this.magnitude;
      return ((this.x /= magnitude), (this.y /= magnitude), this);
    }
    copy(otherVector) {
      return ((this.x = otherVector.x), (this.y = otherVector.y), this);
    }
    static from(source) {
      return new Vector2(source.x, source.y);
    }
  }
  function getVectorMagnitude(vector) {
    return Math.hypot(vector.x, vector.y);
  }
  function getNormalizedVector(vector) {
    const inverseMagnitude = 1 / getVectorMagnitude(vector);
    return { x: vector.x * inverseMagnitude, y: vector.y * inverseMagnitude };
  }
  function getScaledVector(vector, scaleFactor) {
    return { x: vector.x * scaleFactor, y: vector.y * scaleFactor };
  }
  function addVectors(vectorA, vectorB) {
    return { x: vectorA.x + vectorB.x, y: vectorA.y + vectorB.y };
  }
  function subtractVectors(vectorA, vectorB) {
    return { x: vectorA.x - vectorB.x, y: vectorA.y - vectorB.y };
  }
  function addScaledVector(vectorA, vectorB, scaleFactor) {
    return {
      x: vectorA.x + vectorB.x * scaleFactor,
      y: vectorA.y + vectorB.y * scaleFactor,
    };
  }
  function getDistanceBetweenPoints(pointA, pointB) {
    return Math.hypot(pointA.x - pointB.x, pointA.y - pointB.y);
  }
  function getDotProduct(vectorA, vectorB) {
    return vectorA.x * vectorB.x + vectorA.y * vectorB.y;
  }
  function getAngleBetweenVectors(vectorA, vectorB) {
    return Math.acos(
      getDotProduct(
        new Vector2(vectorA.x, vectorA.y).normalize(),
        new Vector2(vectorB.x, vectorB.y).normalize(),
      ),
    );
  }
  function getManhattanDistanceBetweenPoints(pointA, pointB) {
    return Math.abs(pointA.x - pointB.x) + Math.abs(pointA.y - pointB.y);
  }
  function getRotatedVector(vector, angle) {
    const cosAngle = Math.cos(angle),
      sinAngle = Math.sin(angle);
    return {
      x: vector.x * cosAngle - vector.y * sinAngle,
      y: vector.x * sinAngle + vector.y * cosAngle,
    };
  }
  function getClampedVector(point, rect) {
    return {
      x: clamp(point.x, rect.x, rect.x + rect.width),
      y: clamp(point.y, rect.y, rect.y + rect.height),
    };
  }
  function compareVectorsInReadingOrder(pointA, pointB) {
    return pointA.y < pointB.y
      ? -1
      : pointA.y > pointB.y
        ? 1
        : Math.sign(pointA.x - pointB.x);
  }
  function isVectorAfterInReadingOrder(pointA, pointB) {
    return compareVectorsInReadingOrder(pointA, pointB) > 0;
  }
  function getAverageVector(points) {
    const total = { x: 0, y: 0 };
    let count = 0;
    for (const point of points)
      ((total.x += point.x), (total.y += point.y), count++);
    return ((total.x /= count), (total.y /= count), total);
  }
  const Vector2Funcs = {
    getMagnitude: getVectorMagnitude,
    normalized: getNormalizedVector,
    scaled: getScaledVector,
    sum: addVectors,
    difference: subtractVectors,
    scaledSum: addScaledVector,
    getDistance: getDistanceBetweenPoints,
    getDotProduct: getDotProduct,
    getAngle: getAngleBetweenVectors,
    getManhattanDistance: getManhattanDistanceBetweenPoints,
    getRotated: getRotatedVector,
    getClamped: getClampedVector,
    compareVectors: compareVectorsInReadingOrder,
    isVectorGreaterThan: isVectorAfterInReadingOrder,
    getAverage: getAverageVector,
  };
  class GeometryHelper {
    constructor(
      cellIdsHelper,
      edgeIdsHelper,
      cornerIdsHelper,
      outerCellIdsHelper,
    ) {
      ((this.cellIdHelper = cellIdsHelper),
        (this.edgeIdHelper = edgeIdsHelper),
        (this.cornerIdHelper = cornerIdsHelper),
        (this.outerCellIdHelper = outerCellIdsHelper),
        (this.spec = cellIdsHelper.spec),
        (this.width = this.spec.size.width),
        (this.height = this.spec.size.height));
    }
    spec;
    width;
    height;
    *getAdjacentCells(cellId, includeDiagonals = !1) {
      (yield* this.getOrthogonallyAdjacentCells(cellId),
        includeDiagonals && (yield* this.getDiagonallyAdjacentCells(cellId)));
    }
    *getOrthogonallyAdjacentCells(cellId) {
      const { x: x, y: y } = this.cellIdHelper.getCoordsFromId(cellId);
      (x > 0 && (yield this.cellIdHelper.getIdFromCoords({ x: x - 1, y: y })),
        y > 0 && (yield this.cellIdHelper.getIdFromCoords({ x: x, y: y - 1 })),
        x < this.width - 1 &&
          (yield this.cellIdHelper.getIdFromCoords({ x: x + 1, y: y })),
        y < this.height - 1 &&
          (yield this.cellIdHelper.getIdFromCoords({ x: x, y: y + 1 })));
    }
    *getDiagonallyAdjacentCells(cellId) {
      const { x: x, y: y } = this.cellIdHelper.getCoordsFromId(cellId);
      (x > 0 &&
        y > 0 &&
        (yield this.cellIdHelper.getIdFromCoords({ x: x - 1, y: y - 1 })),
        x < this.width - 1 &&
          y > 0 &&
          (yield this.cellIdHelper.getIdFromCoords({ x: x + 1, y: y - 1 })),
        x > 0 &&
          y < this.height - 1 &&
          (yield this.cellIdHelper.getIdFromCoords({ x: x - 1, y: y + 1 })),
        x < this.width - 1 &&
          y < this.height - 1 &&
          (yield this.cellIdHelper.getIdFromCoords({ x: x + 1, y: y + 1 })));
    }
    *getCellsInRow(rowIndex) {
      for (let columnIndex = 0; columnIndex < this.width; columnIndex++)
        yield this.cellIdHelper.getIdFromCoords({
          x: columnIndex,
          y: rowIndex,
        });
    }
    *getCellsInColumn(columnIndex) {
      for (let rowIndex = 0; rowIndex < this.height; rowIndex++)
        yield this.cellIdHelper.getIdFromCoords({
          x: columnIndex,
          y: rowIndex,
        });
    }
    *getCellsInRowOfCell(cellId) {
      yield* this.getCellsInRow(this.cellIdHelper.getY(cellId));
    }
    *getCellsInColumnOfCell(cellId) {
      yield* this.getCellsInColumn(this.cellIdHelper.getX(cellId));
    }
    *getCellsKnightsMoveAwayFromCell(cellId) {
      const { x: x, y: y } = this.cellIdHelper.getCoordsFromId(cellId);
      (x >= 1 &&
        y >= 2 &&
        (yield this.cellIdHelper.getIdFromCoords({ x: x - 1, y: y - 2 })),
        x < this.width - 1 &&
          y >= 2 &&
          (yield this.cellIdHelper.getIdFromCoords({ x: x + 1, y: y - 2 })),
        x >= 2 &&
          y >= 1 &&
          (yield this.cellIdHelper.getIdFromCoords({ x: x - 2, y: y - 1 })),
        x < this.width - 2 &&
          y >= 1 &&
          (yield this.cellIdHelper.getIdFromCoords({ x: x + 2, y: y - 1 })),
        x >= 2 &&
          y < this.height - 1 &&
          (yield this.cellIdHelper.getIdFromCoords({ x: x - 2, y: y + 1 })),
        x < this.width - 2 &&
          y < this.height - 1 &&
          (yield this.cellIdHelper.getIdFromCoords({ x: x + 2, y: y + 1 })),
        x >= 1 &&
          y < this.height - 2 &&
          (yield this.cellIdHelper.getIdFromCoords({ x: x - 1, y: y + 2 })),
        x < this.width - 1 &&
          y < this.height - 2 &&
          (yield this.cellIdHelper.getIdFromCoords({ x: x + 1, y: y + 2 })));
    }
    *getCoordsInDiagonal(diagonalType, startX) {
      const xStep = diagonalType === DiagonalType.NegativeDiagonal ? 1 : -1;
      startX === void 0 &&
        (startX =
          diagonalType === DiagonalType.NegativeDiagonal ? 0 : this.width - 1);
      for (let rowIndex = 0; rowIndex < this.height; rowIndex++) {
        const x = startX + rowIndex * xStep;
        if (x < 0 || x >= this.width) break;
        yield { x: x, y: rowIndex };
      }
    }
    *getCellsInDiagonal(diagonalType, startX) {
      for (const coords of this.getCoordsInDiagonal(diagonalType, startX))
        yield this.cellIdHelper.getIdFromCoords(coords);
    }
    *getAllRows() {
      for (let rowIndex = 0; rowIndex < this.height; rowIndex++)
        yield [...this.getCellsInRow(rowIndex)];
    }
    *getAllColumns() {
      for (let columnIndex = 0; columnIndex < this.width; columnIndex++)
        yield [...this.getCellsInColumn(columnIndex)];
    }
    *getAllPairsWithOffset(offsetX, offsetY) {
      for (let rowIndex = 0; rowIndex < this.height; rowIndex++)
        for (let columnIndex = 0; columnIndex < this.width; columnIndex++) {
          const offsetCoords = {
            x: columnIndex + offsetX,
            y: rowIndex + offsetY,
          };
          offsetCoords.x < 0 ||
            offsetCoords.y < 0 ||
            offsetCoords.x >= this.width ||
            offsetCoords.y >= this.height ||
            (yield [
              this.cellIdHelper.getIdFromCoords({
                x: columnIndex,
                y: rowIndex,
              }),
              this.cellIdHelper.getIdFromCoords(offsetCoords),
            ]);
        }
    }
    *getAllDominoes() {
      (yield* this.getAllPairsWithOffset(1, 0),
        yield* this.getAllPairsWithOffset(0, 1));
    }
    *getAllDiagonallyAdjacentPairs() {
      (yield* this.getAllPairsWithOffset(1, -1),
        yield* this.getAllPairsWithOffset(1, 1));
    }
    *getAllKingsMovePairs() {
      (yield* this.getAllPairsWithOffset(1, 0),
        yield* this.getAllPairsWithOffset(0, 1),
        yield* this.getAllPairsWithOffset(1, -1),
        yield* this.getAllPairsWithOffset(1, 1));
    }
    *getAllKnightMovePairs() {
      (yield* this.getAllPairsWithOffset(1, -2),
        yield* this.getAllPairsWithOffset(1, 2),
        yield* this.getAllPairsWithOffset(2, -1),
        yield* this.getAllPairsWithOffset(2, 1));
    }
    *getAllQuadruples() {
      for (let rowIndex = 0; rowIndex < this.height - 1; rowIndex++)
        for (let columnIndex = 0; columnIndex < this.width - 1; columnIndex++)
          yield [
            this.cellIdHelper.getIdFromCoords({ x: columnIndex, y: rowIndex }),
            this.cellIdHelper.getIdFromCoords({
              x: columnIndex + 1,
              y: rowIndex,
            }),
            this.cellIdHelper.getIdFromCoords({
              x: columnIndex,
              y: rowIndex + 1,
            }),
            this.cellIdHelper.getIdFromCoords({
              x: columnIndex + 1,
              y: rowIndex + 1,
            }),
          ];
    }
    *getCellsTouchingCorner(cornerId) {
      const cornerCoords = this.cornerIdHelper.getCoordsFromId(cornerId),
        touchingCells = [];
      for (let offsetY = -1; offsetY <= 0; offsetY++)
        for (let offsetX = -1; offsetX <= 0; offsetX++) {
          const cellId = this.cellIdHelper.getIdFromCoordsSafe({
            x: cornerCoords.x + offsetX,
            y: cornerCoords.y + offsetY,
          });
          cellId !== void 0 && (yield cellId);
        }
      return touchingCells;
    }
    getCellsTouchingEdge(edgeId) {
      const { x: x, y: y } = this.edgeIdHelper.getCoordsFromId(edgeId);
      return [
        { x: Math.floor(x - 0.5), y: Math.floor(y - 0.5) },
        { x: Math.ceil(x - 0.5), y: Math.ceil(y - 0.5) },
      ].map((coords) => this.cellIdHelper.getIdFromCoords(coords));
    }
    *getCoordsPointedAtByOuterClue(outerCellId, diagonalType) {
      const attributes = this.outerCellIdHelper.getAllAttributes(outerCellId);
      let { x: x, y: y } = attributes;
      const { side: side } = attributes;
      if (diagonalType) {
        const step = OuterClueDiagonalSteps[`${side}_${diagonalType}`];
        if (!step) return;
        for (
          x += step.x, y += step.y;
          x >= 0 && y >= 0 && x < this.width && y < this.height;
        )
          (yield { x: x, y: y }, (x += step.x), (y += step.y));
      } else
        switch (side) {
          case OuterPosition.Top: {
            for (let rowIndexTop = 0; rowIndexTop < this.height; rowIndexTop++)
              yield { x: x, y: rowIndexTop };
            return;
          }
          case OuterPosition.Right:
            for (
              let columnIndexRight = this.width - 1;
              columnIndexRight >= 0;
              columnIndexRight--
            )
              yield { x: columnIndexRight, y: y };
            return;
          case OuterPosition.Bottom:
            for (
              let rowIndexBottom = this.height - 1;
              rowIndexBottom >= 0;
              rowIndexBottom--
            )
              yield { x: x, y: rowIndexBottom };
            return;
          case OuterPosition.Left:
            for (
              let columnIndexLeft = 0;
              columnIndexLeft < this.width;
              columnIndexLeft++
            )
              yield { x: columnIndexLeft, y: y };
            return;
          case OuterPosition.TopLeft: {
            const diagonalLengthTopLeft = Math.min(this.width, this.height);
            for (
              let diagonalIndexTopLeft = 0;
              diagonalIndexTopLeft < diagonalLengthTopLeft;
              diagonalIndexTopLeft++
            )
              yield { x: diagonalIndexTopLeft, y: diagonalIndexTopLeft };
            return;
          }
          case OuterPosition.TopRight: {
            const diagonalLengthTopRight = Math.min(this.width, this.height);
            for (
              let diagonalIndexTopRight = 0;
              diagonalIndexTopRight < diagonalLengthTopRight;
              diagonalIndexTopRight++
            )
              yield {
                x: this.width - 1 - diagonalIndexTopRight,
                y: diagonalIndexTopRight,
              };
            return;
          }
          case OuterPosition.BottomRight: {
            const diagonalLengthBottomRight = Math.min(this.width, this.height);
            for (
              let diagonalIndexBottomRight = 0;
              diagonalIndexBottomRight < diagonalLengthBottomRight;
              diagonalIndexBottomRight++
            )
              yield {
                x: diagonalIndexBottomRight,
                y: this.height - 1 - diagonalIndexBottomRight,
              };
            return;
          }
          case OuterPosition.BottomLeft: {
            const diagonalLengthBottomLeft = Math.min(this.width, this.height);
            for (
              let diagonalIndexBottomLeft = 0;
              diagonalIndexBottomLeft < diagonalLengthBottomLeft;
              diagonalIndexBottomLeft++
            )
              yield {
                x: this.width - 1 - diagonalIndexBottomLeft,
                y: this.height - 1 - diagonalIndexBottomLeft,
              };
          }
        }
    }
    *getCellsPointedAtByOuterClue(outerCellId, diagonalType) {
      for (const coords of this.getCoordsPointedAtByOuterClue(
        outerCellId,
        diagonalType,
      ))
        yield this.cellIdHelper.getIdFromCoords(coords);
    }
    getManhattanDistanceBetweenCells(cellA, cellB) {
      const coordsA = this.cellIdHelper.getCoordsFromId(cellA),
        coordsB = this.cellIdHelper.getCoordsFromId(cellB);
      return getManhattanDistanceBetweenPoints(coordsA, coordsB);
    }
    getCellsAreKingsMoveApart(cellA, cellB) {
      const coordsA = this.cellIdHelper.getCoordsFromId(cellA),
        coordsB = this.cellIdHelper.getCoordsFromId(cellB),
        deltaX = Math.abs(coordsA.x - coordsB.x),
        deltaY = Math.abs(coordsA.y - coordsB.y);
      return deltaX === 0 && deltaY === 0 ? !1 : deltaX <= 1 && deltaY <= 1;
    }
  }
  const OuterClueDiagonalSteps = {
      [`${OuterPosition.Top}_${DiagonalType.NegativeDiagonal}`]: { x: 1, y: 1 },
      [`${OuterPosition.Top}_${DiagonalType.PositiveDiagonal}`]: {
        x: -1,
        y: 1,
      },
      [`${OuterPosition.Bottom}_${DiagonalType.NegativeDiagonal}`]: {
        x: -1,
        y: -1,
      },
      [`${OuterPosition.Bottom}_${DiagonalType.PositiveDiagonal}`]: {
        x: 1,
        y: -1,
      },
      [`${OuterPosition.Left}_${DiagonalType.NegativeDiagonal}`]: {
        x: 1,
        y: 1,
      },
      [`${OuterPosition.Left}_${DiagonalType.PositiveDiagonal}`]: {
        x: 1,
        y: -1,
      },
      [`${OuterPosition.Right}_${DiagonalType.NegativeDiagonal}`]: {
        x: -1,
        y: -1,
      },
      [`${OuterPosition.Right}_${DiagonalType.PositiveDiagonal}`]: {
        x: -1,
        y: 1,
      },
      [`${OuterPosition.TopLeft}_${DiagonalType.NegativeDiagonal}`]: {
        x: 1,
        y: 1,
      },
      [`${OuterPosition.TopLeft}_${DiagonalType.PositiveDiagonal}`]: void 0,
      [`${OuterPosition.TopRight}_${DiagonalType.NegativeDiagonal}`]: void 0,
      [`${OuterPosition.TopRight}_${DiagonalType.PositiveDiagonal}`]: {
        x: -1,
        y: 1,
      },
      [`${OuterPosition.BottomLeft}_${DiagonalType.NegativeDiagonal}`]: void 0,
      [`${OuterPosition.BottomLeft}_${DiagonalType.PositiveDiagonal}`]: {
        x: 1,
        y: -1,
      },
      [`${OuterPosition.BottomRight}_${DiagonalType.NegativeDiagonal}`]: {
        x: -1,
        y: -1,
      },
      [`${OuterPosition.BottomRight}_${DiagonalType.PositiveDiagonal}`]: void 0,
    },
    TupleNamesBySize = [
      "empty tuple",
      "single",
      "pair",
      "triple",
      "quadruple",
      "quintuple",
      "sextuple",
      "septuple",
      "octuple",
      "nonuple",
    ];
  function getTupleNameBySize(tupleSize) {
    return TupleNamesBySize[tupleSize] || `${tupleSize}-tuple`;
  }
  const countCandidatesInMask = popCount,
    toDigitMask = buildDigitMask,
    smallestDigitInMask = lowestSetBitIndex,
    largestDigitInMask = highestSetBitIndex,
    digitsInMask = listDigitsInMask;
  function joinWithConjunction(values, conjunction = "and") {
    const parts = [];
    for (let index = 0; index < values.length; index++)
      (parts.push(String(values[index])),
        index < values.length - 2
          ? parts.push(", ")
          : index < values.length - 1 && parts.push(` ${conjunction} `));
    return parts.join("");
  }
  class NamingHelper {
    constructor(
      edgeIdsHelper,
      outerCellIdsHelper,
      geometryHelper,
      digitsHelper,
    ) {
      ((this.edgeIdHelper = edgeIdsHelper),
        (this.outerCellIdHelper = outerCellIdsHelper),
        (this.geometryHelper = geometryHelper),
        (this.digitsHelper = digitsHelper),
        (this.spec = edgeIdsHelper.spec));
      for (let rowIndex = 0; rowIndex < this.spec.size.height; rowIndex++)
        for (
          let columnIndex = 0;
          columnIndex < this.spec.size.width;
          columnIndex++
        )
          this.names.push(`R${rowIndex + 1}C${columnIndex + 1}`);
    }
    spec;
    names = [];
    getCellName(cellId) {
      return this.names[cellId];
    }
    getColumnName(columnIndex) {
      return `C${columnIndex + 1}`;
    }
    getRowName(rowIndex) {
      return `R${rowIndex + 1}`;
    }
    getDigitFilterDescription(digitSet) {
      return (
        (digitSet = this.digitsHelper.createFullDigitSet().intersect(digitSet)),
        this.digitsHelper.createOddsDigitSet().equals(digitSet)
          ? "an odd digit"
          : this.digitsHelper.createEvensDigitSet().equals(digitSet)
            ? "an even digit"
            : popCount(+digitSet) === 1
              ? `a ${smallestDigitInMask(+digitSet).toString()}`
              : `a ${this.getDigitSetDescription(digitSet, "or")}`
      );
    }
    getDigitSetDescription(digitSet, conjunction = "and") {
      return (
        (digitSet = this.digitsHelper.createFullDigitSet().intersect(digitSet)),
        joinWithConjunction([...digitSet], conjunction)
      );
    }
    getCellsDescription(cells) {
      const sortedCells = [...cells].sort((cellA, cellB) => cellA - cellB);
      return sortedCells.length === 0
        ? "???"
        : joinWithConjunction(
            sortedCells.map((cellId) => this.getCellName(cellId)),
          );
    }
    getLineName(lineLabel, cells) {
      return `the ${lineLabel} from ${this.getCellName(cells[0])} to ${this.getCellName(cells.at(-1))}`;
    }
    getBranchingLineName(lineLabel, cells) {
      return `the ${lineLabel} containing ${this.getCellName(Math.min(...cells))}`;
    }
    getEdgeClueName(clueLabel, edgeId) {
      return this.getEdgeClueNameFromDomino(
        clueLabel,
        this.geometryHelper.getCellsTouchingEdge(edgeId),
      );
    }
    getEdgeClueNameFromDomino(clueLabel, dominoCells) {
      return `the ${clueLabel} between ${this.getCellsDescription(dominoCells)}`;
    }
    getCageName(cageLabel, cells) {
      return `the ${cageLabel} at ${this.getCellName(Math.min(...cells))}`;
    }
    getTupleName(cells) {
      return getTupleNameBySize(cells.length);
    }
    getTupleNameBySize(tupleSize) {
      return getTupleNameBySize(tupleSize);
    }
    getOuterClueName(clueLabel, outerCellId) {
      const attributes = this.outerCellIdHelper.getAllAttributes(outerCellId);
      switch (attributes.side) {
        case OuterPosition.TopLeft:
          return `the top-left ${clueLabel}`;
        case OuterPosition.TopRight:
          return `the top-right ${clueLabel}`;
        case OuterPosition.Top:
          return `the top ${clueLabel} in ${this.getColumnName(attributes.x)}`;
        case OuterPosition.BottomLeft:
          return `the bottom-left ${clueLabel}`;
        case OuterPosition.BottomRight:
          return `the bottom-right ${clueLabel}`;
        case OuterPosition.Bottom:
          return `the bottom ${clueLabel} in ${this.getColumnName(attributes.x)}`;
        case OuterPosition.Right:
          return `the right ${clueLabel} in ${this.getRowName(attributes.y)}`;
        case OuterPosition.Left:
          return `the left ${clueLabel} in ${this.getRowName(attributes.y)}`;
      }
    }
  }
  class OuterCellIds {
    width;
    height;
    constructor(spec) {
      ((this.width = spec.size.width), (this.height = spec.size.height));
    }
    getX(outerCellId) {
      return (outerCellId % (this.width + 2)) - 1;
    }
    getY(outerCellId) {
      return Math.floor(outerCellId / (this.width + 2)) - 1;
    }
    getIdFromCoords(coords) {
      return coords.x + 1 + (coords.y + 1) * (this.width + 2);
    }
    getCoordsFromId(outerCellId) {
      return new Vector2(this.getX(outerCellId), this.getY(outerCellId));
    }
    getCellCenterFromId(outerCellId) {
      return new Vector2(
        this.getX(outerCellId) + 0.5,
        this.getY(outerCellId) + 0.5,
      );
    }
    getSide(outerCellId) {
      return this.getSideFromCoords(this.getCoordsFromId(outerCellId));
    }
    getAllAttributes(outerCellId) {
      const coords = this.getCoordsFromId(outerCellId);
      return { x: coords.x, y: coords.y, side: this.getSideFromCoords(coords) };
    }
    getSideFromCoords(coords) {
      return coords.y < 0
        ? coords.x < 0
          ? OuterPosition.TopLeft
          : coords.x >= this.width
            ? OuterPosition.TopRight
            : OuterPosition.Top
        : coords.y >= this.height
          ? coords.x < 0
            ? OuterPosition.BottomLeft
            : coords.x >= this.width
              ? OuterPosition.BottomRight
              : OuterPosition.Bottom
          : coords.x >= this.width
            ? OuterPosition.Right
            : OuterPosition.Left;
    }
  }
  function memoizeWithKey(computeValue, getKey, useWeakKeys = !1) {
    const cache = useWeakKeys ? new WeakMap() : new Map();
    return function (...args) {
      const key = getKey(...args);
      let result;
      return (
        cache.has(key)
          ? (result = cache.get(key))
          : ((result = computeValue(...args)), cache.set(key, result)),
        result
      );
    };
  }
  class SumsHelper {
    minDigit;
    maxDigit;
    constructor(spec) {
      ((this.minDigit = spec.minDigit),
        (this.maxDigit = spec.maxDigit),
        (this.getCombinationsForSumWithoutRepeat = memoizeWithKey(
          this.getCombinationsForSumWithoutRepeat.bind(this),
          (sum, cellCount) => `${sum}_${cellCount}`,
        )));
    }
    getExtremeSumsWithRepeat(candidateMasks, weights) {
      let minSum = 0,
        maxSum = 0;
      for (let index = 0; index < candidateMasks.length; index++) {
        const mask = candidateMasks[index],
          weight = weights?.[index] ?? 1,
          smallestDigit = smallestDigitInMask(mask),
          largestDigit = largestDigitInMask(mask);
        ((minSum += (smallestDigit ?? 0) * weight),
          (maxSum += (largestDigit ?? 0) * weight));
      }
      return { minSum: minSum, maxSum: maxSum };
    }
    getExtremeSumsWithoutRepeat(candidateMasks, weights) {
      const minSum = this.getMinimumSumWithoutRepeat(candidateMasks, weights);
      if (minSum === null) return null;
      const maxSum = this.getMaximumSumWithoutRepeat(candidateMasks, weights);
      return { minSum: minSum, maxSum: maxSum };
    }
    getMinimumSumWithoutRepeat(candidateMasks, weights) {
      const searchMinimum = (remainingEntries, usedMask) => {
        let bestSum = 1 / 0,
          noEntries = !0;
        for (
          let entryIndex = 0;
          entryIndex < remainingEntries.length;
          entryIndex++
        ) {
          const [mask, weight] = remainingEntries[entryIndex];
          noEntries = !1;
          const digit = smallestDigitInMask(mask & ~usedMask);
          if (digit === void 0) return null;
          const restEntries = remainingEntries.slice();
          restEntries.splice(entryIndex, 1);
          const subSum = searchMinimum(restEntries, usedMask | (1 << digit));
          subSum !== null &&
            subSum + digit * weight < bestSum &&
            (bestSum = subSum + digit * weight);
        }
        return noEntries ? 0 : bestSum === 1 / 0 ? null : bestSum;
      };
      return this.#e(candidateMasks, weights, searchMinimum);
    }
    getMaximumSumWithoutRepeat(candidateMasks, weights) {
      const searchMaximum = (remainingEntries, usedMask) => {
        let bestSum = -1 / 0,
          noEntries = !0;
        for (
          let entryIndex = 0;
          entryIndex < remainingEntries.length;
          entryIndex++
        ) {
          const [mask, weight] = remainingEntries[entryIndex];
          noEntries = !1;
          const digit = largestDigitInMask(mask & ~usedMask);
          if (digit === void 0) return null;
          const restEntries = remainingEntries.slice();
          restEntries.splice(entryIndex, 1);
          const subSum = searchMaximum(restEntries, usedMask | (1 << digit));
          subSum !== null &&
            subSum + digit * weight > bestSum &&
            (bestSum = subSum + digit * weight);
        }
        return noEntries ? 0 : bestSum === -1 / 0 ? null : bestSum;
      };
      return this.#e(candidateMasks, weights, searchMaximum);
    }
    getCombinationsForSumWithoutRepeat(sum, cellCount) {
      if (cellCount === 0) return [];
      const matchingCombinations = [],
        allCombinations = iterateCombinationsOfSize(
          iterateRangeInclusive(this.minDigit, this.maxDigit),
          cellCount,
        );
      for (const combination of allCombinations)
        combination.reduce((runningSum, digit) => runningSum + digit, 0) ===
          sum && matchingCombinations.push(combination);
      return matchingCombinations;
    }
    getCombinationsForSumsWithoutRepeat(sums, cellCount) {
      if (cellCount === 0) return [];
      const matchingCombinations = [];
      for (const sum of sums)
        matchingCombinations.push(
          ...this.getCombinationsForSumWithoutRepeat(sum, cellCount),
        );
      return matchingCombinations;
    }
    #e(candidateMasks, weights, searchExtremeSum) {
      const remainingEntries = [];
      let fixedSum = 0,
        fixedMask = 0;
      for (let index = 0; index < candidateMasks.length; index++) {
        const weight = weights?.[index] ?? 1;
        isSingleCandidateMask(candidateMasks[index])
          ? ((fixedSum += smallestDigitInMask(candidateMasks[index]) * weight),
            (fixedMask |= candidateMasks[index]))
          : remainingEntries.push([candidateMasks[index], weight]);
      }
      const searchedSum = searchExtremeSum(remainingEntries, fixedMask);
      return searchedSum === null ? null : searchedSum + fixedSum;
    }
  }
  class XSumsHelper {
    constructor(sumsHelper) {
      ((this.sumHelper = sumsHelper), (this.maxDigit = sumsHelper.maxDigit));
    }
    maxDigit;
    *getXSumPossibilities(sum) {
      if (sum === 1) {
        yield { x: 1, combinations: [2] };
        return;
      } else if (
        sum === 2 ||
        sum === 4 ||
        sum > triangularNumber(this.maxDigit)
      )
        return;
      for (let xValue = 2; xValue <= this.maxDigit; xValue++)
        if (sum >= triangularNumber(xValue) && sum <= this.#e(xValue)) {
          const combinationMasks = [];
          for (const combination of this.sumHelper.getCombinationsForSumWithoutRepeat(
            sum - xValue,
            xValue - 1,
          ))
            combination.includes(xValue) ||
              combinationMasks.push(buildDigitMask(combination));
          combinationMasks.length > 0 &&
            (yield { x: xValue, combinations: combinationMasks });
        }
    }
    #e(xLength) {
      return (
        xLength + this.maxDigit * (xLength - 1) - triangularNumber(xLength - 2)
      );
    }
  }
  function createHelpers(spec) {
    const cellIdsHelper = new CellIds(spec),
      cornerIdsHelper = new CornerIds(cellIdsHelper),
      edgeIdsHelper = new EdgeIds(cellIdsHelper),
      outerCellIdsHelper = new OuterCellIds(spec),
      sumsHelper = new SumsHelper(spec),
      geometryHelper = new GeometryHelper(
        cellIdsHelper,
        edgeIdsHelper,
        cornerIdsHelper,
        outerCellIdsHelper,
      ),
      xSumsHelper = new XSumsHelper(sumsHelper),
      digitsHelper = new DigitsHelper(spec),
      namingHelper = new NamingHelper(
        edgeIdsHelper,
        outerCellIdsHelper,
        geometryHelper,
        digitsHelper,
      ),
      connectivityHelper = new ConnectivityHelper(geometryHelper);
    return {
      cellIds: cellIdsHelper,
      cornerIds: cornerIdsHelper,
      edgeIds: edgeIdsHelper,
      outerCellIds: outerCellIdsHelper,
      geometry: geometryHelper,
      sums: sumsHelper,
      xSums: xSumsHelper,
      digits: digitsHelper,
      naming: namingHelper,
      connectivity: connectivityHelper,
    };
  }
  let puzzleSpec,
    allDigitsMask = 0,
    sharedHelpers;
  function setPuzzleSpec(spec) {
    ((puzzleSpec = deepClone(spec)),
      (sharedHelpers = createHelpers(puzzleSpec)),
      (allDigitsMask = +sharedHelpers.digits.createFullDigitSet()));
  }
  let verboseSolvingEnabled = !0;
  function disableVerboseSolving() {
    verboseSolvingEnabled = !1;
  }
  function countMatchingValues(
    values,
    target,
    { comparator: comparator = (valueA, valueB) => valueA === valueB } = {},
  ) {
    return values.reduce(
      (count, value) => count + (comparator(value, target) ? 1 : 0),
      0,
    );
  }
  function countWhere(values, predicate) {
    return values.reduce(
      (count, value) => count + (predicate(value) ? 1 : 0),
      0,
    );
  }
  function removeFirstValue(array, value, options) {
    if (options?.comparator)
      return removeFirstWhere(array, (candidate) =>
        options.comparator(value, candidate),
      );
    const index = array.indexOf(value);
    return (index === -1 || array.splice(index, 1), array);
  }
  function removeFirstWhere(array, predicate) {
    const index = array.findIndex(predicate);
    return (index === -1 || array.splice(index, 1), array);
  }
  function arrayWithoutAll(array, valuesToRemove, options) {
    if (options?.comparator) {
      const uniqueRemovals = toArrayMaybeUnique(valuesToRemove, { unique: !0 });
      return array.filter(
        (value) =>
          !uniqueRemovals.find((removal) => options.comparator(value, removal)),
      );
    }
    const removalSet = new Set(valuesToRemove),
      keptValues = [];
    for (const keptValue of array)
      removalSet.has(keptValue) || keptValues.push(keptValue);
    return keptValues;
  }
  function removeValuesInPlace(array, valuesToRemove, options) {
    if (options?.comparator) {
      const originalItemsForComparator = [...array],
        uniqueRemovals = toArrayMaybeUnique(valuesToRemove, { unique: !0 });
      array.length = 0;
      for (const item of originalItemsForComparator)
        uniqueRemovals.find((removal) => options.comparator(item, removal)) ||
          array.push(item);
      return array;
    }
    const originalItems = [...array],
      removalSet = new Set(valuesToRemove);
    array.length = 0;
    for (const remainingItem of originalItems)
      removalSet.has(remainingItem) || array.push(remainingItem);
    return array;
  }
  function removeWhereInPlace(array, predicate) {
    const originalItems = [...array];
    array.length = 0;
    for (const item of originalItems) predicate(item) || array.push(item);
    return array;
  }
  function arrayIncludesSome(array, values, options) {
    if (options?.comparator) {
      for (const value of values)
        if (array.some((candidate) => options.comparator(value, candidate)))
          return !0;
      return !1;
    }
    for (const plainValue of values) if (array.includes(plainValue)) return !0;
    return !1;
  }
  function arrayIncludesEvery(array, values, options) {
    if (options?.comparator) {
      for (const value of values)
        if (!array.some((existing) => options.comparator(value, existing)))
          return !1;
      return !0;
    }
    for (const value of values) if (!array.includes(value)) return !1;
    return !0;
  }
  function shuffledCopy(array) {
    array = array.slice();
    for (let index = array.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [array[index], array[swapIndex]] = [array[swapIndex], array[index]];
    }
    return array;
  }
  function mapIterableToArray(iterable, mapFn) {
    const result = [];
    for (const item of iterable) result.push(mapFn(item));
    return result;
  }
  function sliceWrapped(array, start, end) {
    if (array.length === 0) return [];
    const result = [];
    for (let index = start; index < end; index++)
      result.push(array[modulo(index, array.length)]);
    return result;
  }
  function chunkArray(array, chunkSize) {
    const chunks = [];
    let currentChunk;
    for (let index = 0; index < array.length; index++)
      (index % chunkSize === 0 &&
        ((currentChunk = []), chunks.push(currentChunk)),
        currentChunk.push(array[index]));
    return chunks;
  }
  function arraysAreSameLength(...arrays) {
    return arrays.length === 0
      ? !0
      : arrays.every((array) => array.length === arrays[0].length);
  }
  function hasDuplicates(array, options) {
    if (options?.comparator)
      return hasDuplicatesByComparator(array, options?.comparator);
    const seen = new Set();
    for (let index = 0; index < array.length; index++) {
      if (seen.has(array[index])) return !0;
      seen.add(array[index]);
    }
    return !1;
  }
  function hasDuplicatesByComparator(array, comparator) {
    for (let index = 0; index < array.length; index++)
      for (let otherIndex = index + 1; otherIndex < array.length; otherIndex++)
        if (comparator(array[index], array[otherIndex])) return !0;
    return !1;
  }
  function withoutDuplicates(array, options) {
    return options?.comparator
      ? withoutDuplicatesByComparator(array, options.comparator)
      : Array.from(new Set(array));
  }
  function withoutDuplicatesByComparator(array, comparator) {
    let index = -1;
    const length = array.length,
      result = [];
    for (; ++index < length;) {
      const value = array[index];
      result.find((existing) => comparator(existing, value)) ||
        result.push(value);
    }
    return result;
  }
  function ensureArray(value) {
    return Array.isArray(value) ? value : [value];
  }
  function toArrayMaybeUnique(value, { unique: unique = !1 } = {}) {
    return Array.isArray(value)
      ? unique
        ? withoutDuplicates(value)
        : value
      : (unique && !(value instanceof Set) && (value = new Set(value)),
        Array.from(value));
  }
  function createFilledArray(length, fillValue) {
    return new Array(length).fill(fillValue);
  }
  const ArrayUtils = {
    count: countMatchingValues,
    countWhere: countWhere,
    removeFirst: removeFirstValue,
    removeFirstWhere: removeFirstWhere,
    withoutAll: arrayWithoutAll,
    remove: removeValuesInPlace,
    removeWhere: removeWhereInPlace,
    includesSome: arrayIncludesSome,
    includesEvery: arrayIncludesEvery,
    shuffled: shuffledCopy,
    mapIterable: mapIterableToArray,
    sliceWrapped: sliceWrapped,
    chunk: chunkArray,
    areSameLength: arraysAreSameLength,
    hasDuplicates: hasDuplicates,
    withoutDuplicates: withoutDuplicates,
    ensureArray: ensureArray,
    createFilledArray: createFilledArray,
  };
  var ChangeType = ((changeTypeEnum) => (
    (changeTypeEnum[(changeTypeEnum.SetValue = 0)] = "SetValue"),
    (changeTypeEnum[(changeTypeEnum.FilterCandidatesAtCell = 1)] =
      "FilterCandidatesAtCell"),
    (changeTypeEnum[(changeTypeEnum.FilterCandidatesAtCells = 2)] =
      "FilterCandidatesAtCells"),
    (changeTypeEnum[(changeTypeEnum.RemoveCandidatesFromCell = 3)] =
      "RemoveCandidatesFromCell"),
    (changeTypeEnum[(changeTypeEnum.RemoveCandidatesFromCells = 4)] =
      "RemoveCandidatesFromCells"),
    (changeTypeEnum[(changeTypeEnum.AbortSolver = 5)] = "AbortSolver"),
    (changeTypeEnum[(changeTypeEnum.ReplaceComponent = 6)] =
      "ReplaceComponent"),
    changeTypeEnum
  ))(ChangeType || {});
  function setValueChange(value, cell) {
    return { type: 0, value: value, cell: cell };
  }
  function keepOnlyDigitAtCell(digit, cell) {
    return { type: 1, value: 1 << digit, cell: cell };
  }
  function filterCandidatesAtCellChange(digitMask, cell) {
    return { type: 1, value: digitMask, cell: cell };
  }
  function filterCandidatesAtCellsChange(digitMask, cells) {
    return { type: 2, value: digitMask, cells: [...cells] };
  }
  function removeDigitFromCellChange(digit, cell) {
    return { type: 3, value: 1 << digit, cell: cell };
  }
  function removeDigitFromCellsChange(digit, cells) {
    return { type: 4, value: 1 << digit, cells: [...cells] };
  }
  function removeCandidatesFromCellChange(digitMask, cell) {
    return { type: 3, value: digitMask, cell: cell };
  }
  function removeCandidatesFromCellsChange(digitMask, cells) {
    return { type: 4, value: digitMask, cells: [...cells] };
  }
  function abortSolverChange(message = "", cells = []) {
    return { type: 5, cells: cells, message: message };
  }
  function replaceComponentChange(components) {
    return { type: 6, with: ensureArray(components) };
  }
  function removeComponentChange() {
    return replaceComponentChange([]);
  }
  function cellsShareColumn(cellA, cellB) {
    return (
      sharedHelpers.cellIds.getX(cellA) === sharedHelpers.cellIds.getX(cellB)
    );
  }
  function cellsShareRow(cellA, cellB) {
    return (
      sharedHelpers.cellIds.getY(cellA) === sharedHelpers.cellIds.getY(cellB)
    );
  }
  class AlmostXWingLogicStep {
    constructor(sudoku) {
      this.sudoku = sudoku;
    }
    *execute() {
      for (
        let digit = puzzleSpec.minDigit;
        digit <= puzzleSpec.maxDigit;
        digit++
      ) {
        const candidateSets = [...this.sudoku.getSetsForCandidate(digit)];
        for (const houseType of [HouseType.Row, HouseType.Column]) {
          const setsOfType = candidateSets.filter(
            (candidateSet) => candidateSet.houseType === houseType,
          );
          yield* this.handleHouse(digit, houseType, setsOfType);
        }
      }
    }
    clone(sudoku) {
      return new AlmostXWingLogicStep(sudoku);
    }
    *handleHouse(digit, houseType, candidateSets) {
      const pairSets = candidateSets.filter(
          (candidateSet) => candidateSet.cells.length === 2,
        ),
        sharesCrossLine =
          houseType === HouseType.Row ? cellsShareColumn : cellsShareRow;
      for (let baseIndex = 0; baseIndex < pairSets.length; baseIndex++) {
        const baseSet = pairSets[baseIndex];
        for (const coverSet of candidateSets) {
          const coverPairIndex = pairSets.indexOf(coverSet);
          if (!(
            baseSet === coverSet ||
            (coverPairIndex > -1 && baseIndex < coverPairIndex)
          ))
            for (let baseCellIndex = 0; baseCellIndex < 2; baseCellIndex++) {
              const baseCell = baseSet.cells[baseCellIndex],
                matchedCoverCell = coverSet.cells.find((coverCandidateCell) =>
                  sharesCrossLine(baseCell, coverCandidateCell),
                );
              if (matchedCoverCell === void 0) continue;
              const otherBaseCell = baseSet.cells[1 - baseCellIndex],
                remainingCoverCells = arrayWithoutAll(coverSet.cells, [
                  matchedCoverCell,
                ]),
                otherBaseCellCovered = remainingCoverCells.some(
                  (remainingCoverCell) =>
                    sharesCrossLine(otherBaseCell, remainingCoverCell),
                ),
                eliminationCells = this.sudoku.getCellsSeenByCells([
                  otherBaseCell,
                  ...remainingCoverCells,
                ]),
                patternName = otherBaseCellCovered
                  ? "finned"
                  : remainingCoverCells.length > 1
                    ? "sashimi"
                    : "skyscraper";
              yield {
                changes: [removeDigitFromCellsChange(digit, eliminationCells)],
                description: {
                  type: "AlmostXWing",
                  parameters: [
                    patternName,
                    houseType,
                    [baseSet, coverSet].map((patternSet) =>
                      patternSet.name.substring(patternSet.name.length - 1),
                    ),
                  ],
                },
              };
            }
        }
      }
    }
  }
  function describeCellsWithNoCandidates(cells) {
    const cellsDescription = sharedHelpers.naming.getCellsDescription(cells),
      verb = cells.length === 1 ? "has" : "have";
    return `${cellsDescription} ${verb} no candidates`;
  }
  function createFailedResultForCell(cell) {
    return { type: "failed", cells: [cell] };
  }
  function createFailedResultForCells(cells, message) {
    return { type: "failed", cells: cells.slice(), message: message };
  }
  const UnchangedResult = { type: "unchanged" },
    ChangedResult = { type: "changed" };
  function getFailureMessage(failedResult) {
    return (
      failedResult.message || describeCellsWithNoCandidates(failedResult.cells)
    );
  }
  function mergeDeductionResults(currentResult, nextResult) {
    if (currentResult.type === "unchanged") return nextResult;
    if (nextResult.type === "failed") {
      if (currentResult.type === "failed") {
        for (const failedCell of nextResult.cells)
          currentResult.cells.includes(failedCell) ||
            currentResult.cells.push(failedCell);
        return currentResult;
      }
      return nextResult;
    }
    return currentResult;
  }
  class ChangeApplier {
    sudoku;
    requests;
    constructor(sudoku, requests) {
      ((this.sudoku = sudoku), (this.requests = ensureArray(requests)));
    }
    execute() {
      let result = UnchangedResult;
      for (const request of this.requests)
        for (
          let changeIndex = 0;
          changeIndex < request.changes.length;
          changeIndex++
        ) {
          const change = request.changes[changeIndex];
          for (const changeResult of this.processChange(change)) {
            if (changeResult.type === "failed") return changeResult;
            changeResult.type === "changed" && (result = changeResult);
          }
        }
      return result;
    }
    *processChange(change) {
      switch (change.type) {
        case ChangeType.SetValue:
          return yield* this.setValueAtCell(change.value, change.cell);
        case ChangeType.FilterCandidatesAtCell:
          return yield* this.filterCandidatesAtCell(change.value, change.cell);
        case ChangeType.FilterCandidatesAtCells:
          return yield* this.filterCandidatesAtCells(
            change.value,
            change.cells,
          );
        case ChangeType.RemoveCandidatesFromCell:
          return yield* this.removeCandidatesFromCell(
            change.value,
            change.cell,
          );
        case ChangeType.RemoveCandidatesFromCells:
          return yield* this.removeCandidatesFromCells(
            change.value,
            change.cells,
          );
        case ChangeType.AbortSolver:
          return yield {
            type: "failed",
            cells: change.cells || [],
            message: change.message,
          };
      }
    }
    *setValueAtCell(value, cell) {
      yield this.sudoku.setValueAtCell(value, cell);
    }
    *filterCandidatesAtCell(digitMask, cell) {
      yield this.sudoku.filterCandidatesAtCell(digitMask, cell);
    }
    *filterCandidatesAtCells(digitMask, cells) {
      yield* this.sudoku.filterCandidatesAtCells(digitMask, cells);
    }
    *removeCandidatesFromCell(digitMask, cell) {
      yield this.sudoku.removeCandidatesFromCell(digitMask, cell);
    }
    *removeCandidatesFromCells(digitMask, cells) {
      yield* this.sudoku.removeCandidatesFromCells(digitMask, cells);
    }
  }
  class VerboseChangeApplier {
    sudoku;
    affected = [];
    requests;
    affectedPerChange = new Map();
    constructor(sudoku, requests) {
      ((this.sudoku = sudoku), (this.requests = ensureArray(requests)));
    }
    execute() {
      let result = UnchangedResult;
      for (const request of this.requests)
        for (
          let changeIndex = 0;
          changeIndex < request.changes.length;
          changeIndex++
        ) {
          const change = request.changes[changeIndex];
          for (const [affectedCell, changeResult] of this.processChange(
            change,
          )) {
            if (
              changeResult.type !== "unchanged" &&
              verboseSolvingEnabled &&
              (this.affectedPerChange.has(change) ||
                this.affectedPerChange.set(change, []),
              affectedCell !== void 0)
            ) {
              const affectedForChange = this.affectedPerChange.get(change);
              for (const cloneCell of this.sudoku.getCloneSet(affectedCell))
                (affectedForChange.includes(cloneCell) ||
                  affectedForChange.push(cloneCell),
                  this.affected.includes(cloneCell) ||
                    this.affected.push(cloneCell));
            }
            if (changeResult.type === "failed") return changeResult;
            changeResult.type === "changed" && (result = changeResult);
          }
        }
      return result;
    }
    getVerboseResults() {
      return this.requests
        .map((request) => {
          const effectiveChanges = request.changes.filter((change) => {
            const affectedCells = this.affectedPerChange.get(change);
            return (
              change.type === ChangeType.AbortSolver ||
              (affectedCells && affectedCells.length > 0)
            );
          });
          return {
            description: request.description,
            changes: effectiveChanges,
            affected: effectiveChanges.map(
              (appliedChange) =>
                this.affectedPerChange.get(appliedChange) || [],
            ),
          };
        })
        .filter((verboseRequest) => verboseRequest.changes.length > 0);
    }
    processChange(change) {
      switch (change.type) {
        case ChangeType.SetValue:
          return this.setValueAtCell(change.value, change.cell);
        case ChangeType.FilterCandidatesAtCell:
          return this.filterCandidatesAtCell(change.value, change.cell);
        case ChangeType.FilterCandidatesAtCells:
          return this.filterCandidatesAtCells(change.value, change.cells);
        case ChangeType.RemoveCandidatesFromCell:
          return this.removeCandidatesFromCell(change.value, change.cell);
        case ChangeType.RemoveCandidatesFromCells:
          return this.removeCandidatesFromCells(change.value, change.cells);
        case ChangeType.AbortSolver:
          return this.reportBroken(change.cells || [], change.message);
        default:
          return [];
      }
    }
    *setValueAtCell(value, cell) {
      const result = this.sudoku.setValueAtCell(value, cell);
      result.type !== "unchanged" &&
        (yield [cell, this.ensureErrorMessage(result)]);
    }
    *filterCandidatesAtCell(digitMask, cell) {
      const result = this.sudoku.filterCandidatesAtCell(digitMask, cell);
      result.type !== "unchanged" &&
        (yield [cell, this.ensureErrorMessage(result)]);
    }
    *filterCandidatesAtCells(digitMask, cells) {
      for (const cell of cells) {
        const result = this.sudoku.filterCandidatesAtCell(digitMask, cell);
        result.type !== "unchanged" &&
          (yield [cell, this.ensureErrorMessage(result)]);
      }
    }
    *removeCandidatesFromCell(digitMask, cell) {
      const result = this.sudoku.removeCandidatesFromCell(digitMask, cell);
      result.type !== "unchanged" &&
        (yield [cell, this.ensureErrorMessage(result)]);
    }
    *removeCandidatesFromCells(digitMask, cells) {
      for (const cell of cells) {
        const result = this.sudoku.removeCandidatesFromCell(digitMask, cell);
        result.type !== "unchanged" &&
          (yield [cell, this.ensureErrorMessage(result)]);
      }
    }
    *reportBroken(cells, message) {
      yield [void 0, { type: "failed", cells: cells, message: message }];
    }
    ensureErrorMessage(result) {
      return (
        result.type === "failed" &&
          !result.message &&
          (result.message = describeCellsWithNoCandidates(result.cells)),
        result
      );
    }
  }
  class BranchCellRanking {
    constructor(sudoku, useRandomness = !0) {
      ((this.sudoku = sudoku),
        (this.useRandomness = useRandomness),
        (this.cellWeights = new Array(
          puzzleSpec.size.width * puzzleSpec.size.height,
        )));
    }
    cellWeights;
    getBestCell() {
      let bestCell;
      for (const cell of this.sudoku.cells)
        cell.value === void 0 &&
          (!bestCell || this.getBetterCell(bestCell, cell) === cell) &&
          (bestCell = cell);
      return bestCell;
    }
    getSortedCells() {
      return this.sudoku.cells
        .filter((cell) => cell.value === void 0)
        .sort((cellA, cellB) => this.compareCells(cellA, cellB));
    }
    getBetterCell(cellA, cellB) {
      return this.compareCells(cellA, cellB) <= 0 ? cellA : cellB;
    }
    compareCells(cellA, cellB) {
      const weightA = this.getCellWeight(cellA),
        weightB = this.getCellWeight(cellB);
      return weightA < weightB ? -1 : weightA > weightB ? 1 : 0;
    }
    getCellWeight(cell) {
      if (!this.cellWeights[cell.id]) {
        let candidateCount = countCandidatesInMask(cell.candidates);
        (candidateCount > 3 && (candidateCount = 3),
          (this.cellWeights[cell.id] =
            (this.useRandomness ? Math.random() : 0) +
            candidateCount * 1e5 -
            this.sudoku.getConstraintComponentsAt(cell.id).size));
      }
      return this.cellWeights[cell.id];
    }
  }
  function getNakedSingleDigit(cell) {
    const candidates = cell.candidates;
    if (isSingleCandidateMask(candidates)) return 31 - Math.clz32(candidates);
  }
  class NakedSingleLogicStep {
    constructor(sudoku) {
      this.sudoku = sudoku;
    }
    *execute() {
      for (const cell of this.sudoku.cells) {
        if (cell.value !== void 0) continue;
        const digit = getNakedSingleDigit(cell);
        digit !== void 0 &&
          (yield {
            changes: [setValueChange(digit, cell.id)],
            description: { type: "NakedSingle", parameters: [cell.id] },
          });
      }
    }
    clone(sudoku) {
      return new NakedSingleLogicStep(sudoku);
    }
  }
  const HiddenFailureReason = "fail";
  function describeVerboseDeductions(verboseResults) {
    const descriptions = [];
    for (const verboseResult of verboseResults)
      for (
        let changeIndex = 0;
        changeIndex < verboseResult.changes.length;
        changeIndex++
      ) {
        const change = verboseResult.changes[changeIndex],
          affectedCells = verboseResult.affected[changeIndex];
        if (affectedCells.length === 0) continue;
        const cellsDescription =
          sharedHelpers.naming.getCellsDescription(affectedCells);
        switch (change.type) {
          case ChangeType.SetValue:
            descriptions.push(`${cellsDescription} → ${change.value}`);
            break;
          case ChangeType.FilterCandidatesAtCell:
          case ChangeType.FilterCandidatesAtCells:
            descriptions.push(
              `all candidates other than ${sharedHelpers.naming.getDigitSetDescription(change.value)} to be removed from ${cellsDescription}`,
            );
            break;
          case ChangeType.RemoveCandidatesFromCell:
          case ChangeType.RemoveCandidatesFromCells:
            descriptions.push(
              `${sharedHelpers.naming.getDigitSetDescription(change.value)} to be removed from ${cellsDescription}`,
            );
            break;
        }
      }
    return joinWithConjunction(descriptions);
  }
  class ByContradictionLogicStep {
    constructor(sudoku, useRandomness = !0) {
      ((this.sudoku = sudoku), (this.useRandomness = useRandomness));
    }
    clone(sudoku) {
      return new ByContradictionLogicStep(sudoku, this.useRandomness);
    }
    *execute() {
      const sortedCells = new BranchCellRanking(
        this.sudoku,
        this.useRandomness,
      ).getSortedCells();
      for (const cell of sortedCells)
        for (const digit of digitsInMask(cell.candidates)) {
          const contradictionReason = this.tryCandidate(cell.id, digit);
          contradictionReason &&
            (yield {
              changes: [removeDigitFromCellChange(digit, cell.id)],
              description: {
                type: "ByContradiction",
                parameters: [digit, cell.id, contradictionReason],
              },
            });
        }
    }
    tryCandidate(cellId, digit) {
      const clonedSudoku = this.sudoku.clone(),
        setResult = clonedSudoku.setValueAtCell(digit, cellId);
      if (setResult.type === "failed")
        return verboseSolvingEnabled
          ? `causes a contradiction: ${getFailureMessage(setResult)}`
          : HiddenFailureReason;
      const validateResult = clonedSudoku.updateConstraintsAndValidate();
      return validateResult.type === "failed"
        ? verboseSolvingEnabled
          ? `causes a contradiction: ${getFailureMessage(validateResult)}`
          : HiddenFailureReason
        : verboseSolvingEnabled
          ? this.verboseNakedSingleCheck(clonedSudoku)
          : this.optimizedNakedSingleCheck(clonedSudoku);
    }
    optimizedNakedSingleCheck(sudoku) {
      const singleRequests = [...new NakedSingleLogicStep(sudoku).execute()];
      for (const request of singleRequests)
        if (
          new ChangeApplier(sudoku, request).execute().type === "failed" ||
          sudoku.updateConstraintsAndValidate().type === "failed"
        )
          return HiddenFailureReason;
      return null;
    }
    verboseNakedSingleCheck(sudoku) {
      const verboseResults = [],
        singleRequests = [...new NakedSingleLogicStep(sudoku).execute()];
      for (const request of singleRequests) {
        const applier = new VerboseChangeApplier(sudoku, request),
          applyResult = applier.execute();
        if (
          (verboseResults.push(...applier.getVerboseResults()),
          applyResult.type === "failed")
        )
          return verboseSolvingEnabled
            ? `forces ${describeVerboseDeductions(verboseResults)}, causing a contradiction: ${getFailureMessage(applyResult)}`
            : HiddenFailureReason;
        const validateResult = sudoku.updateConstraintsAndValidate();
        if (validateResult.type === "failed")
          return verboseSolvingEnabled
            ? `forces ${describeVerboseDeductions(verboseResults)}, causing a contradiction: ${getFailureMessage(validateResult)}`
            : HiddenFailureReason;
      }
      return null;
    }
  }
  function unionMaskOverMappedSets(candidateSets, mapCell) {
    let mask = 0;
    for (const candidateSet of candidateSets) {
      const mappedValues = candidateSet.cells.map((cell) => mapCell(cell));
      mask |= buildDigitMask(mappedValues);
    }
    return mask;
  }
  class FishLogicStep {
    constructor(groupSize, sudoku) {
      ((this.groupSize = groupSize), (this.sudoku = sudoku));
    }
    *execute() {
      for (
        let digit = puzzleSpec.minDigit;
        digit <= puzzleSpec.maxDigit;
        digit++
      ) {
        const candidateSets = [...this.sudoku.getSetsForCandidate(digit)],
          rowSets = candidateSets
            .filter(
              (rowCandidateSet) =>
                rowCandidateSet.houseType === HouseType.Row &&
                rowCandidateSet.cells.length <= this.groupSize,
            )
            .map((rowSetToMap) => ({
              ...rowSetToMap,
              y: sharedHelpers.cellIds.getY(rowSetToMap.cells[0]),
            }));
        for (const rowCombination of iterateCombinationsOfSize(
          rowSets,
          this.groupSize,
        )) {
          const columnMask = unionMaskOverMappedSets(
            rowCombination,
            (rowComboCell) => sharedHelpers.cellIds.getX(rowComboCell),
          );
          if (popCount(columnMask) === this.groupSize) {
            const rowEliminationCells = [];
            for (
              let rowIndex = 0;
              rowIndex < puzzleSpec.size.height;
              rowIndex++
            )
              if (
                !rowCombination.some(
                  (comboRowSet) => comboRowSet.y === rowIndex,
                )
              )
                for (const columnInMask of listDigitsInMask(columnMask))
                  rowEliminationCells.push(
                    columnInMask + rowIndex * puzzleSpec.size.width,
                  );
            yield {
              changes: [removeDigitFromCellsChange(digit, rowEliminationCells)],
              description: {
                type: "Fishes",
                parameters: [
                  HouseType.Row,
                  rowCombination.map((rowComboSet) =>
                    rowComboSet.name.substring(rowComboSet.name.length - 1),
                  ),
                ],
              },
            };
          }
        }
        const columnSets = candidateSets
          .filter(
            (columnCandidateSet) =>
              columnCandidateSet.houseType === HouseType.Column &&
              columnCandidateSet.cells.length <= this.groupSize,
          )
          .map((columnSetToMap) => ({
            ...columnSetToMap,
            x: sharedHelpers.cellIds.getX(columnSetToMap.cells[0]),
          }));
        for (const columnCombination of iterateCombinationsOfSize(
          columnSets,
          this.groupSize,
        )) {
          const rowMask = unionMaskOverMappedSets(
            columnCombination,
            (columnComboCell) => sharedHelpers.cellIds.getY(columnComboCell),
          );
          if (popCount(rowMask) === this.groupSize) {
            const columnEliminationCells = [];
            for (
              let columnIndex = 0;
              columnIndex < puzzleSpec.size.width;
              columnIndex++
            )
              if (
                !columnCombination.some(
                  (comboColumnSet) => comboColumnSet.x === columnIndex,
                )
              )
                for (const rowInMask of listDigitsInMask(rowMask))
                  columnEliminationCells.push(
                    columnIndex + rowInMask * puzzleSpec.size.width,
                  );
            yield {
              changes: [
                removeDigitFromCellsChange(digit, columnEliminationCells),
              ],
              description: {
                type: "Fishes",
                parameters: [
                  HouseType.Column,
                  columnCombination.map((columnComboSet) =>
                    columnComboSet.name.substring(
                      columnComboSet.name.length - 1,
                    ),
                  ),
                ],
              },
            };
          }
        }
      }
    }
    clone(sudoku) {
      return new FishLogicStep(this.groupSize, sudoku);
    }
  }
  class HiddenSetLogicStep {
    constructor(groupSize, sudoku) {
      ((this.groupSize = groupSize), (this.sudoku = sudoku));
    }
    *execute() {
      for (const house of this.sudoku.getHouseComponents())
        yield* this.executeForRegion(house);
    }
    clone(sudoku) {
      return new HiddenSetLogicStep(this.groupSize, sudoku);
    }
    *executeForRegion(house) {
      const unsolvedCells = house.cellIds
        .map((cellId) => this.sudoku.cells[cellId])
        .filter((cell) => cell.value === void 0);
      if (!(unsolvedCells.length <= this.groupSize))
        for (const combination of iterateCombinationsOfSize(
          unsolvedCells,
          this.groupSize,
        )) {
          let combinationMask = 0;
          for (const comboCell of combination)
            combinationMask |= comboCell.candidates;
          let outsideMask = 0;
          for (const otherCell of unsolvedCells)
            combination.includes(otherCell) ||
              (outsideMask |= otherCell.candidates);
          const hiddenMask = combinationMask & ~outsideMask;
          if (countCandidatesInMask(hiddenMask) === this.groupSize) {
            const comboCellIds = combination.map(
              (cellInCombo) => cellInCombo.id,
            );
            yield {
              changes: [
                filterCandidatesAtCellsChange(hiddenMask, comboCellIds),
                removeCandidatesFromCellsChange(
                  hiddenMask,
                  this.sudoku.getCellsSeenByCells(comboCellIds),
                ),
              ],
              description: {
                type: "HiddenSet",
                parameters: [house.name, comboCellIds],
              },
            };
          }
        }
    }
  }
  class HiddenSingleLogicStep {
    constructor(sudoku) {
      this.sudoku = sudoku;
    }
    *execute() {
      for (
        let digit = puzzleSpec.minDigit;
        digit <= puzzleSpec.maxDigit;
        digit++
      )
        for (const candidateSet of this.sudoku.getSetsForCandidate(digit))
          candidateSet.cells.length === 1 &&
            (yield {
              changes: [setValueChange(digit, candidateSet.cells[0])],
              description: {
                type: "HiddenSingle",
                parameters: [candidateSet.name],
              },
            });
    }
    clone(sudoku) {
      return new HiddenSingleLogicStep(sudoku);
    }
  }
  class NakedSetLogicStep {
    constructor(groupSize, sudoku) {
      ((this.groupSize = groupSize), (this.sudoku = sudoku));
    }
    *execute() {
      for (const houseComponent of this.sudoku.getHouseComponents())
        yield* this.check(houseComponent);
    }
    clone(newSudoku) {
      return new NakedSetLogicStep(this.groupSize, newSudoku);
    }
    *check(house) {
      const unsolvedCells = house.cellIds
        .map((cellId) => this.sudoku.cells[cellId])
        .filter((cell) => cell.value === void 0);
      for (const cellCombination of iterateCombinationsOfSize(
        unsolvedCells,
        this.groupSize,
      )) {
        let combinedMask = 0;
        for (const comboCell of cellCombination)
          combinedMask |= comboCell.candidates;
        if (countCandidatesInMask(combinedMask) === this.groupSize) {
          const comboCellIds = cellCombination.map((setCell) => setCell.id),
            seenCells = this.sudoku.getCellsSeenByCells(comboCellIds);
          yield {
            changes: [removeCandidatesFromCellsChange(combinedMask, seenCells)],
            description: {
              type: "NakedSet",
              parameters: [house.name, comboCellIds],
            },
          };
        }
      }
    }
  }
  class PointingSetLogicStep {
    constructor(sudoku) {
      this.sudoku = sudoku;
    }
    *execute() {
      const sudoku = this.sudoku;
      for (
        let digit = puzzleSpec.minDigit;
        digit <= puzzleSpec.maxDigit;
        digit++
      )
        for (const candidateSet of sudoku.getSetsForCandidate(digit)) {
          const seenCells = sudoku.getCellsSeenByCells(candidateSet.cells);
          seenCells.size !== 0 &&
            (yield {
              changes: [removeDigitFromCellsChange(digit, seenCells)],
              description: {
                type:
                  candidateSet.houseType === void 0
                    ? "PointingRequiredDigits"
                    : "PointingSet",
                parameters: [candidateSet.name, candidateSet.cells],
              },
            });
        }
    }
    clone(newSudoku) {
      return new PointingSetLogicStep(newSudoku);
    }
  }
  class UnorthodoxNakedSetLogicStep {
    constructor(groupSize, sudoku) {
      ((this.groupSize = groupSize), (this.sudoku = sudoku));
    }
    *execute() {
      const { sudoku: sudoku, groupSize: groupSize } = this,
        candidateCellIds = sharedHelpers.cellIds
          .getAllCellIds()
          .filter(
            (cellId) =>
              sudoku.cells[cellId].value === void 0 &&
              countCandidatesInMask(sudoku.cells[cellId].candidates) <=
                groupSize,
          );
      for (const cellIdCombination of iterateCombinationsOfSize(
        candidateCellIds,
        groupSize,
      )) {
        let combinedMask = 0;
        for (const comboCellId of cellIdCombination)
          combinedMask |= sudoku.cells[comboCellId].candidates;
        if (
          countCandidatesInMask(combinedMask) !== groupSize ||
          !sudoku.getCellsSeeEachOther(cellIdCombination)
        )
          continue;
        const seenCells = sudoku.getCellsSeenByCells(cellIdCombination);
        seenCells.size !== 0 &&
          (yield {
            changes: [removeCandidatesFromCellsChange(combinedMask, seenCells)],
            description: {
              type: "UnorthodoxNakedSet",
              parameters: [cellIdCombination],
            },
          });
      }
    }
    clone(newSudoku) {
      return new UnorthodoxNakedSetLogicStep(this.groupSize, newSudoku);
    }
  }
  const ValidResult = { valid: !0 };
  class ConstraintComponent {
    name;
    cellIds;
    constructor(name, cellIds) {
      ((this.name = name || "Nameless constraint"), (this.cellIds = cellIds));
    }
    get validateDuringSolve() {
      return !1;
    }
    get allowsEmptyCells() {
      return !1;
    }
    *initialize(solverState) {
      if (
        this.getExclusionGroup !==
          ConstraintComponent.prototype.getExclusionGroup ||
        this.onValueSet !== ConstraintComponent.prototype.onValueSet
      )
        for (const cellId of this.cellIds) {
          const value = solverState.cells[cellId].value;
          if (value !== void 0) {
            yield* this.onValueSet(solverState, cellId, value);
            const exclusionCells = removeFirstValue(
              [...this.getExclusionGroup(cellId)],
              cellId,
            );
            yield removeDigitFromCellsChange(value, exclusionCells);
          }
        }
      yield* this.update(solverState);
    }
    *onValueSet(solverState, cellId, value) {}
    *update(solverState) {}
    validate(solverState) {
      return ValidResult;
    }
    getExclusionGroup(cellId) {
      return [];
    }
    getIsDone(solverState) {
      return this.cellIds.some(
        (cellId) => solverState.cells[cellId].value === void 0,
      )
        ? !1
        : this.validateDuringSolve
          ? this.validate(solverState).valid
          : !1;
    }
  }
  var ParamType = ((enumObject) => (
    (enumObject[(enumObject.String = 0)] = "String"),
    (enumObject[(enumObject.StringArray = 1)] = "StringArray"),
    (enumObject[(enumObject.Cell = 2)] = "Cell"),
    (enumObject[(enumObject.CellArray = 3)] = "CellArray"),
    (enumObject[(enumObject.CellOrCellArray = 4)] = "CellOrCellArray"),
    (enumObject[(enumObject.Number = 5)] = "Number"),
    (enumObject[(enumObject.NumberArray = 6)] = "NumberArray"),
    (enumObject[(enumObject.NumberOrNumberArray = 7)] = "NumberOrNumberArray"),
    (enumObject[(enumObject.DigitSet = 8)] = "DigitSet"),
    (enumObject[(enumObject.DigitSetArray = 9)] = "DigitSetArray"),
    (enumObject[(enumObject.Boolean = 10)] = "Boolean"),
    (enumObject[(enumObject.BooleanArray = 11)] = "BooleanArray"),
    (enumObject[(enumObject.Object = 12)] = "Object"),
    (enumObject[(enumObject.ObjectArray = 13)] = "ObjectArray"),
    enumObject
  ))(ParamType || {});
  const componentMetadataByConstructor = new Map(),
    componentConstructorsByName = new Map(),
    DefaultComponentParams = [["cells", ParamType.CellArray]];
  function defineComponent(
    names,
    description,
    params = DefaultComponentParams,
  ) {
    return function (componentClass) {
      names = ensureArray(names).map((rawName) =>
        rawName.endsWith("Component") ? rawName : `${rawName}Component`,
      );
      for (const componentName of names)
        componentConstructorsByName.set(componentName, componentClass);
      if (!componentMetadataByConstructor.has(componentClass)) {
        const [primaryName, ...aliases] = names;
        componentMetadataByConstructor.set(componentClass, {
          name: primaryName,
          aliases: aliases,
          description: description,
          params: params,
        });
      }
    };
  }
  function getComponentConstructorsByName() {
    return componentConstructorsByName;
  }
  var getOwnPropDescriptor01 = Object.getOwnPropertyDescriptor,
    applyClassDecorators01 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var descriptorOrTarget =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor01(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (descriptorOrTarget =
            decorator(descriptorOrTarget) || descriptorOrTarget);
      return descriptorOrTarget;
    };
  let ConsecutiveDigitsComponent = class extends ConstraintComponent {
    constructor(name, cellIds) {
      super(name, cellIds);
    }
    *update({ cells: cells }) {
      const digitSeen = createFilledArray(puzzleSpec.maxDigit, !1);
      let distinctCount = this.cellIds.length;
      for (const solvedCellId of this.cellIds) {
        const candidateMask = cells[solvedCellId].candidates;
        if (countCandidatesInMask(candidateMask) === 1) {
          const solvedDigit = smallestDigitInMask(candidateMask);
          (digitSeen[solvedDigit] && distinctCount--,
            (digitSeen[solvedDigit] = !0));
        }
      }
      let allowedMask = allDigitsMask;
      for (const cellId of this.cellIds) {
        const rangeMin = Math.max(
            puzzleSpec.minDigit,
            smallestDigitInMask(cells[cellId].candidates) - distinctCount + 1,
          ),
          rangeMax = Math.min(
            puzzleSpec.maxDigit,
            largestDigitInMask(cells[cellId].candidates) + distinctCount - 1,
          );
        allowedMask &= toDigitMask(iterateRangeInclusive(rangeMin, rangeMax));
      }
      yield filterCandidatesAtCellsChange(allowedMask, this.cellIds);
    }
  };
  ConsecutiveDigitsComponent = applyClassDecorators01(
    [
      defineComponent(
        "ConsecutiveDigits",
        "All digits within {cells} must make a set of consecutive digits, but may repeat as well.",
        [["cells", ParamType.CellArray]],
      ),
    ],
    ConsecutiveDigitsComponent,
  );
  function* yieldRequiredDigitDeductions(
    solverState,
    digitMask,
    houseName,
    cellIds,
  ) {
    if (
      !solverState.markDigitsAsRequiredForCells(digitMask, houseName, cellIds)
    )
      return;
    const changes = [];
    for (const digit of digitsInMask(digitMask)) {
      const cellsWithDigit = cellIds.filter(
        (candidateCellId) =>
          (solverState.cells[candidateCellId].candidates & (1 << digit)) !== 0,
      );
      cellsWithDigit.length === 1 &&
        (yield {
          description: {
            type: "HiddenSingle",
            parameters: [houseName, cellIds],
          },
          changes: [setValueChange(digit, cellsWithDigit[0])],
        });
      const seenCells = solverState.getCellsSeenByCells(cellsWithDigit);
      seenCells.size > 0 &&
        changes.push(removeDigitFromCellsChange(digit, seenCells));
    }
    yield {
      description: {
        type: "PointingRequiredDigits",
        parameters: [houseName, cellIds],
      },
      changes: changes,
    };
  }
  class ComponentSubscription {
    constructor(
      filter,
      state = void 0,
      onAdd = () => {},
      onDelete = () => {},
      components = new Set(),
    ) {
      ((this.filter = filter),
        (this.state = state),
        (this.onAdd = onAdd),
        (this.onDelete = onDelete),
        (this.components = components));
    }
    solverState;
    initialize(solverState) {
      this.bind(solverState);
      for (const component of this.solverState.getConstraintComponents())
        this.filter(component) &&
          (this.components.add(component), this.onAdd(component, this.state));
    }
    bind(solverState) {
      ((this.solverState = solverState),
        this.solverState.addComponentListener(
          ({ type: eventType, component: eventComponent }) => {
            eventType === "add"
              ? this.filter(eventComponent) &&
                (this.components.add(eventComponent),
                this.onAdd(eventComponent, this.state))
              : (this.components.delete(eventComponent),
                this.onDelete(eventComponent, this.state));
          },
        ));
    }
    getComponents() {
      return this.components;
    }
    getState() {
      return this.state;
    }
    clone(newSolverState) {
      const subscriptionClone = new ComponentSubscription(
        this.filter,
        this.state?.clone(),
        this.onAdd,
        this.onDelete,
        new Set(this.components),
      );
      return (subscriptionClone.bind(newSolverState), subscriptionClone);
    }
  }
  class ConsecutiveSetsLogicStep {
    constructor(state, previousStep) {
      ((this.state = state),
        previousStep
          ? (this.cache = previousStep.cache.clone(state))
          : ((this.cache = new ComponentSubscription(
              (candidateComponent) =>
                candidateComponent instanceof ConsecutiveDigitsComponent &&
                state.getCellsSeeEachOther(candidateComponent.cellIds),
            )),
            this.cache.initialize(state)));
    }
    cache;
    *execute() {
      for (const consecutiveComponent of this.cache.getComponents())
        (yield* this.getValidSubsetDeduction(consecutiveComponent),
          yield* this.getPointingSubsetDeduction(consecutiveComponent));
    }
    clone(newState) {
      return new ConsecutiveSetsLogicStep(newState, this);
    }
    *getValidSubsetDeduction(component) {
      let combinedMask = 0;
      for (const maskCellId of component.cellIds)
        combinedMask |= this.state.cells[maskCellId].candidates;
      const removableDigits = [];
      let runDigits = [],
        previousDigit = -1;
      for (const digit of digitsInMask(combinedMask)) {
        if (previousDigit === -1) {
          ((runDigits = [digit]), (previousDigit = digit));
          continue;
        }
        if (digit > previousDigit + 1) {
          (runDigits.length < component.cellIds.length &&
            removableDigits.push(...runDigits),
            (runDigits = [digit]),
            (previousDigit = digit));
          continue;
        }
        (runDigits.push(digit), (previousDigit = digit));
      }
      (runDigits.length < component.cellIds.length &&
        removableDigits.push(...runDigits),
        yield {
          changes: [
            removeCandidatesFromCellsChange(
              toDigitMask(removableDigits),
              component.cellIds,
            ),
          ],
          description: { type: "Consecutive", parameters: [component.name] },
        });
    }
    *getPointingSubsetDeduction(component) {
      const { state: state } = this;
      let combinedMask = 0;
      for (const maskCellId of component.cellIds)
        combinedMask |= state.cells[maskCellId].candidates;
      const cellCount = component.cellIds.length;
      if (countCandidatesInMask(combinedMask) >= cellCount * 2) return;
      const lowestDigit = smallestDigitInMask(combinedMask),
        highestDigit = largestDigitInMask(combinedMask);
      let requiredMask = 0;
      for (
        let digit = highestDigit - cellCount + 1;
        digit <= lowestDigit + cellCount - 1;
        digit++
      )
        requiredMask |= 1 << digit;
      requiredMask !== 0 &&
        (yield* yieldRequiredDigitDeductions(
          state,
          requiredMask,
          component.name,
          component.cellIds,
        ));
    }
  }
  const nakedSubsetScratchBuffer = new Uint8Array(4 * 1024 * 1024),
    MaxNakedSubsetSearchSize = 16;
  function findNakedSubsetsAmongCells(cells, houseName) {
    if (cells.length > MaxNakedSubsetSearchSize) return ValidResult;
    const maskBySubset = new Uint32Array(nakedSubsetScratchBuffer.buffer),
      subsetCount = 1 << cells.length;
    for (let subset = 1; subset < subsetCount; subset++) {
      const lowestBit = subset & -subset,
        cellIndex = 31 - Math.clz32(lowestBit),
        subsetMask =
          maskBySubset[subset ^ lowestBit] | cells[cellIndex].candidates;
      maskBySubset[subset] = subsetMask;
      const subsetSize = popCount(subset);
      if (popCount(subsetMask) < subsetSize) {
        const subsetCellIds = cells
            .filter(
              (maskedCell) =>
                (subsetMask & maskedCell.candidates) === maskedCell.candidates,
            )
            .map((containedCell) => containedCell.id),
          maskSize = popCount(subsetMask);
        if (
          cells.length === puzzleSpec.digitCount &&
          maskSize > puzzleSpec.digitCount / 2
        ) {
          const placedDigits = SudokuDigitSet.from(
              cells
                .filter((solvedCell) => solvedCell.value !== void 0)
                .map((valuedCell) => valuedCell.value),
            ),
            missingDigits = sharedHelpers.digits
              .createFullDigitSet()
              .subtract(subsetMask)
              .subtract(placedDigits),
            otherCellIds = cells
              .filter(
                (unsolvedCell) =>
                  unsolvedCell.value === void 0 &&
                  !subsetCellIds.includes(unsolvedCell.id),
              )
              .map((outsideCell) => outsideCell.id),
            otherCellsDescription =
              sharedHelpers.naming.getCellsDescription(otherCellIds),
            missingDigitsDescription =
              sharedHelpers.naming.getDigitSetDescription(missingDigits),
            housePrefix = houseName ? `in ${houseName}, ` : "";
          return {
            valid: !1,
            cells: otherCellIds,
            message:
              otherCellIds.length === 1
                ? `${housePrefix}${otherCellsDescription} must be ${missingDigitsDescription} simultaneously`
                : `${housePrefix}${otherCellsDescription} are the only cells for ${missingDigits.size} candidates (${missingDigitsDescription})`,
          };
        } else {
          const subsetCellsDescription =
              sharedHelpers.naming.getCellsDescription(subsetCellIds),
            subsetDigitsDescription =
              sharedHelpers.naming.getDigitSetDescription(subsetMask);
          return {
            valid: !1,
            cells: subsetCellIds,
            message:
              maskSize === 1
                ? `${subsetCellsDescription} must ${subsetCellIds.length === 2 ? "both" : "all"} be ${subsetDigitsDescription}`
                : `${subsetCellsDescription} share only ${maskSize} ${maskSize > 1 ? "candidates" : "candidate"} (${subsetDigitsDescription})`,
          };
        }
      }
    }
    return ValidResult;
  }
  var getOwnPropDescriptor02 = Object.getOwnPropertyDescriptor,
    applyClassDecorators02 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var descriptorOrTarget =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor02(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (descriptorOrTarget =
            decorator(descriptorOrTarget) || descriptorOrTarget);
      return descriptorOrTarget;
    };
  let HouseComponent = class extends ConstraintComponent {
    houseType;
    seenIds = new Map();
    constructor(name, cellIds, houseType = HouseType.ExtraRegion) {
      (super(name, cellIds), (this.houseType = houseType));
      for (const houseCellId of cellIds)
        this.seenIds.set(
          houseCellId,
          cellIds.filter((otherCellId) => otherCellId !== houseCellId),
        );
    }
    get validateDuringSolve() {
      return !0;
    }
    getExclusionGroup() {
      return this.cellIds;
    }
    validate({ cells: cells }) {
      let missingMask = allDigitsMask;
      for (let cellIndex = 0; cellIndex < this.cellIds.length; cellIndex++) {
        const cellId = this.cellIds[cellIndex];
        missingMask &= ~cells[cellId].candidates;
      }
      return missingMask !== 0 || this.cellIds.length !== puzzleSpec.digitCount
        ? {
            valid: !1,
            message: `unable to place ${sharedHelpers.naming.getDigitSetDescription(missingMask)} in ${this.name}`,
          }
        : verboseSolvingEnabled
          ? findNakedSubsetsAmongCells(
              this.cellIds.map((validateCellId) => cells[validateCellId]),
              this.name,
            )
          : ValidResult;
    }
  };
  HouseComponent = applyClassDecorators02(
    [
      defineComponent(
        "House",
        "Every digit must appear exactly once in {cells}.",
        [["cells", ParamType.CellArray]],
      ),
    ],
    HouseComponent,
  );
  var getOwnPropDescriptor03 = Object.getOwnPropertyDescriptor,
    applyClassDecorators03 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var descriptorOrTarget =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor03(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (descriptorOrTarget =
            decorator(descriptorOrTarget) || descriptorOrTarget);
      return descriptorOrTarget;
    };
  let DifferentDigitsComponent = class extends ConstraintComponent {
    constructor(name, cellIds) {
      super(name, cellIds);
    }
    get validateDuringSolve() {
      return verboseSolvingEnabled;
    }
    *initialize(solverState) {
      this.cellIds.length === puzzleSpec.digitCount
        ? yield replaceComponentChange(
            new HouseComponent(this.name, this.cellIds),
          )
        : yield* super.initialize(solverState);
    }
    *update(solverState) {
      const digitSet = new SudokuDigitSet();
      for (const cellId of this.cellIds)
        digitSet.union(solverState.cells[cellId].candidates);
      digitSet.size < this.cellIds.length &&
        (yield abortSolverChange(
          `unable to place ${this.cellIds.length} different values in ${this.name}`,
          this.cellIds,
        ));
    }
    getExclusionGroup() {
      return this.cellIds;
    }
    validate(solverState) {
      return findNakedSubsetsAmongCells(
        this.cellIds.map((cellId) => solverState.cells[cellId]),
        this.name,
      );
    }
  };
  DifferentDigitsComponent = applyClassDecorators03(
    [
      defineComponent(
        "DifferentDigits",
        "Every cell of {cells} must have a different digit from the rest.",
        [["cells", ParamType.CellArray]],
      ),
    ],
    DifferentDigitsComponent,
  );
  var getOwnPropDescriptor04 = Object.getOwnPropertyDescriptor,
    applyClassDecorators04 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var descriptorOrTarget =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor04(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (descriptorOrTarget =
            decorator(descriptorOrTarget) || descriptorOrTarget);
      return descriptorOrTarget;
    };
  let RequiredDigitsComponent = class extends ConstraintComponent {
    values;
    repeatCounts = new Map();
    constructor(name, values, cellIds) {
      (super(name, cellIds), (this.values = values));
      for (const value of values)
        (this.repeatCounts.has(value) || this.repeatCounts.set(value, -1),
          this.repeatCounts.set(value, this.repeatCounts.get(value) + 1));
      for (const [repeatValue, repeatCount] of this.repeatCounts)
        repeatCount === 0 && this.repeatCounts.delete(repeatValue);
    }
    get validateDuringSolve() {
      return !0;
    }
    *initialize(solverState) {
      this.values.length === 0
        ? yield removeComponentChange()
        : yield* super.initialize(solverState);
    }
    *update({ cells: cells }) {
      const unsolvedCellIds = [],
        remainingValues = this.values.slice();
      for (const cellId of this.cellIds) {
        const value = cells[cellId].value;
        value !== void 0
          ? removeFirstValue(remainingValues, value)
          : unsolvedCellIds.push(cellId);
      }
      unsolvedCellIds.length === remainingValues.length &&
        (yield filterCandidatesAtCellsChange(
          toDigitMask(remainingValues),
          unsolvedCellIds,
        ));
    }
    validate({ cells: cells }) {
      const unplacedValues = this.values.slice(),
        valuesMask = toDigitMask(this.values);
      for (const cellId of this.cellIds)
        for (const digit of digitsInMask(cells[cellId].candidates & valuesMask))
          if (
            (removeFirstValue(unplacedValues, digit),
            unplacedValues.length === 0)
          )
            return ValidResult;
      let valuesDescription;
      return (
        this.repeatCounts.size > 0
          ? (valuesDescription = `enough ${joinWithConjunction(unplacedValues)}s`)
          : (valuesDescription = joinWithConjunction(unplacedValues)),
        {
          valid: !1,
          message: `unable to place ${valuesDescription} in ${this.name}`,
        }
      );
    }
  };
  RequiredDigitsComponent = applyClassDecorators04(
    [
      defineComponent(
        "RequiredDigits",
        "Every digit of {values} must be assigned a unique cell of {cells}. Requiring a digit to repeat can be achieved by repeating that digit in {values}.",
        [
          ["values", ParamType.NumberArray],
          ["cells", ParamType.CellArray],
        ],
      ),
    ],
    RequiredDigitsComponent,
  );
  function* iterateCombinationsForSum(
    values,
    targetSum,
    minCount = 1,
    maxCount = 1 / 0,
  ) {
    const sortedValues = [...values].sort(
      (leftValue, rightValue) => leftValue - rightValue,
    );
    function* search(startIndex, currentCombination, remainingSum) {
      if (remainingSum === 0) {
        currentCombination.length >= minCount &&
          (yield [...currentCombination]);
        return;
      }
      if (currentCombination.length !== maxCount)
        for (
          let valueIndex = startIndex;
          valueIndex < sortedValues.length;
          valueIndex++
        ) {
          if (
            valueIndex > startIndex &&
            sortedValues[valueIndex] === sortedValues[valueIndex - 1]
          )
            continue;
          const value = sortedValues[valueIndex];
          if (value > remainingSum) break;
          (currentCombination.push(value),
            yield* search(
              valueIndex + 1,
              currentCombination,
              remainingSum - value,
            ),
            currentCombination.pop());
        }
    }
    yield* search(0, [], targetSum);
  }
  const CombinatoricUtils = {
    getCombinationsForSum: iterateCombinationsForSum,
  };
  class SelfCountingSumComponent extends ConstraintComponent {
    helperComponents;
    excludedDigits = 0;
    addedComponentsFor;
    possibleSums;
    possibleDigits;
    constructor(
      name,
      cellIds,
      helperComponents,
      excludedDigitsMask = 0,
      addedComponentsMask = 0,
    ) {
      (super(name, cellIds),
        (this.helperComponents = helperComponents),
        (this.excludedDigits = excludedDigitsMask),
        (this.addedComponentsFor = addedComponentsMask));
    }
    *initialize(sudoku) {
      if (this.cellIds.length === 0) {
        yield removeComponentChange();
        return;
      }
      (this.helperComponents ||
        (this.helperComponents = [...sudoku.getConstraintComponents()].filter(
          (otherComponent) =>
            (otherComponent instanceof DifferentDigitsComponent ||
              otherComponent instanceof HouseComponent) &&
            ArrayUtils.includesSome(otherComponent.cellIds, this.cellIds),
        )),
        yield* super.initialize(sudoku));
    }
    *update(state) {
      if ((this.updatePossibleSums(state), this.possibleSums.length === 0)) {
        yield abortSolverChange(`impossible to satisfy ${this.name}`);
        return;
      }
      if (this.possibleSums.length === 1) {
        const newDigits = new SudokuDigitSet(this.possibleDigits).subtract(
          this.addedComponentsFor,
        );
        if (newDigits.size) {
          const addedDigits = new SudokuDigitSet(this.addedComponentsFor).union(
              newDigits,
            ),
            replacementComponent = new SelfCountingSumComponent(
              this.name,
              this.cellIds,
              this.helperComponents,
              this.excludedDigits,
              +addedDigits,
            );
          yield replaceComponentChange([
            replacementComponent,
            ...[...newDigits].map(
              (newDigit) =>
                new RequiredDigitsComponent(
                  this.name,
                  createFilledArray(newDigit, newDigit),
                  this.cellIds,
                ),
            ),
          ]);
          return;
        }
      }
      yield filterCandidatesAtCellsChange(+this.possibleDigits, this.cellIds);
      const cellsByDigit = Array.from(
          { length: puzzleSpec.maxDigit + 1 },
          () => [],
        ),
        candidateCounts = createFilledArray(puzzleSpec.maxDigit + 1, 0);
      for (const cellId of this.cellIds) {
        const value = state.cells[cellId].value;
        if (value) {
          if (
            (cellsByDigit[value].push(cellId),
            cellsByDigit[value].length === value)
          ) {
            const otherCells = this.cellIds.filter(
                (otherCellId) => !cellsByDigit[value].includes(otherCellId),
              ),
              remainingExcludedMask = this.excludedDigits & ~(1 << value);
            (yield removeDigitFromCellsChange(value, otherCells),
              otherCells.length > 0 &&
                (yield replaceComponentChange(
                  new SelfCountingSumComponent(
                    this.name,
                    otherCells,
                    this.helperComponents,
                    remainingExcludedMask,
                    this.addedComponentsFor,
                  ),
                )));
            return;
          } else if ((this.addedComponentsFor & (1 << value)) === 0) {
            const nextAddedMask = this.addedComponentsFor | (1 << value);
            yield replaceComponentChange([
              new SelfCountingSumComponent(
                this.name,
                this.cellIds,
                this.helperComponents,
                this.excludedDigits,
                nextAddedMask,
              ),
              new RequiredDigitsComponent(
                this.name,
                createFilledArray(value, value),
                this.cellIds,
              ),
            ]);
          }
        }
        for (const candidateDigit of digitsInMask(
          state.cells[cellId].candidates,
        ))
          candidateCounts[candidateDigit]++;
      }
      const availableDigits = new SudokuDigitSet();
      for (
        let digitValue = puzzleSpec.minDigit;
        digitValue <= puzzleSpec.maxDigit;
        digitValue++
      )
        if (candidateCounts[digitValue] >= digitValue)
          availableDigits.add(digitValue);
        else if (cellsByDigit[digitValue].length > 0) {
          yield abortSolverChange();
          return;
        }
      this.possibleSums.some((combination) =>
        combination.every((comboDigit) => availableDigits.has(comboDigit)),
      ) || (yield abortSolverChange());
    }
    updatePossibleSums(state) {
      let maxRepeats = 1;
      for (const houseComponent of this.helperComponents) {
        const overlapCount = ArrayUtils.countWhere(
          houseComponent.cellIds,
          (houseCellId) => this.cellIds.includes(houseCellId),
        );
        maxRepeats = Math.max(overlapCount, maxRepeats);
      }
      this.possibleSums = [];
      const unionCandidates = new SudokuDigitSet();
      for (const unionCellId of this.cellIds)
        unionCandidates.union(state.cells[unionCellId].candidates);
      this.possibleDigits = new SudokuDigitSet();
      for (const combination of iterateCombinationsForSum(
        unionCandidates,
        this.cellIds.length,
        maxRepeats,
        puzzleSpec.maxDigit,
      )) {
        const combinationDigits = SudokuDigitSet.from(combination);
        combinationDigits.intersects(this.excludedDigits) ||
          !unionCandidates.isSupersetOf(combinationDigits) ||
          (this.possibleSums.push(combination),
          this.possibleDigits.union(SudokuDigitSet.from(combination)));
      }
    }
  }
  const PrimaryHouseTypes = [HouseType.Row, HouseType.Column, HouseType.Region];
  class CountingCirclesCacheState {
    constructor(info = new Map()) {
      this.info = info;
    }
    clone() {
      return new CountingCirclesCacheState(deepClone(this.info));
    }
  }
  class CountingCirclesLogicStep {
    constructor(sudokuState, source) {
      if (((this.state = sudokuState), source))
        ((this.rowMapping = source.rowMapping),
          (this.columnMapping = source.columnMapping),
          (this.regionMapping = source.regionMapping),
          (this.legibleHouses = source.legibleHouses),
          (this.cache = source.cache.clone(sudokuState)));
      else {
        ((this.rowMapping = new Map()),
          (this.columnMapping = new Map()),
          (this.regionMapping = new Map()),
          (this.legibleHouses = new Set()));
        for (const houseComponent of sudokuState.getHouseComponents())
          switch (houseComponent.houseType) {
            case HouseType.Row:
              this.legibleHouses.add(houseComponent);
              for (const rowCellId of houseComponent.cellIds)
                this.rowMapping.set(rowCellId, houseComponent);
              break;
            case HouseType.Column:
              this.legibleHouses.add(houseComponent);
              for (const columnCellId of houseComponent.cellIds)
                this.columnMapping.set(columnCellId, houseComponent);
              break;
            case HouseType.Region:
              this.legibleHouses.add(houseComponent);
              for (const regionCellId of houseComponent.cellIds)
                this.regionMapping.set(regionCellId, houseComponent);
              break;
          }
        ((this.cache = new ComponentSubscription(
          (candidateComponent) =>
            candidateComponent instanceof SelfCountingSumComponent,
          new CountingCirclesCacheState(),
          (addedComponent, cacheState) => {
            const entry = {
              houses: {
                [HouseType.Row]: new Map(),
                [HouseType.Column]: new Map(),
                [HouseType.Region]: new Map(),
              },
              availableDigits: sharedHelpers.digits.createFullDigitSet(),
            };
            for (const circleCellId of addedComponent.cellIds) {
              const rowHouse = this.rowMapping.get(circleCellId),
                columnHouse = this.columnMapping.get(circleCellId),
                regionHouse = this.regionMapping.get(circleCellId);
              (entry.houses[HouseType.Row].has(rowHouse) ||
                entry.houses[HouseType.Row].set(rowHouse, []),
                entry.houses[HouseType.Row].get(rowHouse).push(circleCellId),
                entry.houses[HouseType.Column].has(columnHouse) ||
                  entry.houses[HouseType.Column].set(columnHouse, []),
                entry.houses[HouseType.Column]
                  .get(columnHouse)
                  .push(circleCellId),
                entry.houses[HouseType.Region].has(regionHouse) ||
                  entry.houses[HouseType.Region].set(regionHouse, []),
                entry.houses[HouseType.Region]
                  .get(regionHouse)
                  .push(circleCellId));
            }
            cacheState.info.set(addedComponent, entry);
          },
          (removedComponent, removedCacheState) => {
            removedCacheState.info.delete(removedComponent);
          },
        )),
          this.cache.initialize(sudokuState));
      }
    }
    cache;
    rowMapping;
    columnMapping;
    regionMapping;
    legibleHouses;
    *execute() {
      for (const component of this.cache.getComponents()) {
        const digitCounts = Array.from(
          { length: puzzleSpec.maxDigit + 1 },
          () => 0,
        );
        for (const cellId of component.cellIds) {
          const value = this.state.cells[cellId].value;
          value !== void 0 && digitCounts[value]++;
        }
        const emptyCells = component.cellIds.filter(
          (unfilledCellId) => this.state.cells[unfilledCellId].value === void 0,
        );
        (yield* this.getMaxCountDeduction(component, digitCounts, emptyCells),
          yield* this.getHouseExclusionDeduction(component),
          yield* this.getDigitLimitations(component));
      }
    }
    *getMaxCountDeduction(component, digitCounts, emptyCells) {
      const allInRows = emptyCells.every((rowCheckCell) =>
          this.rowMapping.has(rowCheckCell),
        ),
        allInColumns = emptyCells.every((columnCheckCell) =>
          this.columnMapping.has(columnCheckCell),
        ),
        allInRegions = emptyCells.every((regionCheckCell) =>
          this.regionMapping.has(regionCheckCell),
        );
      let minHouseCount = 1 / 0,
        bestHouseType;
      if (allInRows) {
        const rowCount = new Set(
          emptyCells.map((rowCellId) => this.rowMapping.get(rowCellId)),
        ).size;
        rowCount < minHouseCount &&
          ((minHouseCount = rowCount), (bestHouseType = HouseType.Row));
      }
      if (allInColumns) {
        const columnCount = new Set(
          emptyCells.map((columnCellId) =>
            this.columnMapping.get(columnCellId),
          ),
        ).size;
        columnCount < minHouseCount &&
          ((minHouseCount = columnCount), (bestHouseType = HouseType.Column));
      }
      if (allInRegions) {
        const regionCount = new Set(
          emptyCells.map((regionCellId) =>
            this.regionMapping.get(regionCellId),
          ),
        ).size;
        regionCount < minHouseCount &&
          ((minHouseCount = regionCount), (bestHouseType = HouseType.Region));
      }
      if (minHouseCount === 1 / 0) return;
      const excludedDigits = sharedHelpers.digits.createFilteredDigitSet(
        (digit) => digit - digitCounts[digit] > minHouseCount,
      );
      yield {
        changes: [
          removeCandidatesFromCellsChange(+excludedDigits, component.cellIds),
        ],
        description: {
          type: "CountingCircles",
          parameters: [minHouseCount, bestHouseType],
        },
      };
    }
    *getDigitLimitations(component) {
      const entry = this.cache.getState().info.get(component);
      for (const digit of entry.availableDigits)
        for (const houseType of PrimaryHouseTypes) {
          if (entry.houses[houseType].has(void 0)) continue;
          let houseCount = 0;
          for (const houseCells of entry.houses[houseType].values())
            houseCells.some(
              (houseCellId) =>
                this.state.cells[houseCellId].candidates & (1 << digit),
            ) && houseCount++;
          houseCount < digit &&
            (entry.availableDigits.delete(digit),
            yield {
              changes: [removeDigitFromCellsChange(digit, component.cellIds)],
              description: {
                type: "CountingCirclesExclusion",
                parameters: [houseType, houseCount],
              },
            });
        }
    }
    *getHouseExclusionDeduction(component) {
      const circleCells = new Set(component.cellIds),
        housesByType = Map.groupBy(
          this.legibleHouses,
          (houseForGrouping) => houseForGrouping.houseType,
        ),
        housesByDigit = Array.from(
          { length: puzzleSpec.maxDigit + 1 },
          () => new Set(),
        );
      for (const house of this.legibleHouses) {
        const candidateUnion = new SudokuDigitSet(),
          circleCellsInHouse = house.cellIds.filter((houseCellId) =>
            circleCells.has(houseCellId),
          );
        for (const circleCellId of circleCellsInHouse)
          candidateUnion.union(this.state.cells[circleCellId].candidates);
        if (candidateUnion.size === circleCellsInHouse.length)
          for (const unionDigit of candidateUnion)
            housesByDigit[unionDigit].add(house);
      }
      for (
        let digit = puzzleSpec.minDigit;
        digit <= puzzleSpec.maxDigit;
        digit++
      ) {
        const digitHousesByType = Map.groupBy(
          housesByDigit[digit],
          (digitHouse) => digitHouse.houseType,
        );
        for (const [houseType, houses] of digitHousesByType)
          if (houses.length > digit)
            yield {
              changes: [abortSolverChange()],
              description: {
                type: "CountingCirclesError",
                parameters: [houses.length, houseType, digit],
              },
            };
          else if (houses.length === digit) {
            const otherHouses = ArrayUtils.withoutAll(
                housesByType.get(houseType),
                houses,
              ),
              cellsToClear = [];
            for (const otherHouse of otherHouses)
              cellsToClear.push(
                ...otherHouse.cellIds.filter((otherHouseCellId) =>
                  circleCells.has(otherHouseCellId),
                ),
              );
            yield {
              changes: [removeDigitFromCellsChange(digit, cellsToClear)],
              description: {
                type: "CountingCirclesRequirement",
                parameters: [
                  houses.map((requiredHouse) => requiredHouse.name),
                  houseType,
                ],
              },
            };
          }
      }
    }
    clone(newState) {
      return new CountingCirclesLogicStep(newState, this);
    }
  }
  var FriendCacheKeyKind = ((kinds) => (
    (kinds[(kinds.None = 0)] = "None"),
    (kinds[(kinds.Number = 1)] = "Number"),
    (kinds[(kinds.Numbers = 2)] = "Numbers"),
    (kinds[(kinds.String = 3)] = "String"),
    kinds
  ))(FriendCacheKeyKind || {});
  function getFriendCacheKeyBuilder(keyKind) {
    switch (keyKind) {
      case 0:
        return (paramValue, minDigitArg, maxDigitArg) =>
          minDigitArg + 10 * maxDigitArg;
      case 1:
        return (paramValue, minDigitArg, maxDigitArg) =>
          (minDigitArg + 10 * maxDigitArg) * 1e3 + paramValue;
      case 2:
        return (paramValues, minDigitArg, maxDigitArg) =>
          `${paramValues.join(",")}_${minDigitArg + 10 * maxDigitArg}`;
      case 3:
        return (paramText, minDigitArg, maxDigitArg) =>
          `${paramText}_${minDigitArg + 10 * maxDigitArg}`;
    }
  }
  class FriendDigitTable {
    constructor(callback, paramType = FriendCacheKeyKind.None) {
      ((this.callback = callback),
        (this.paramType = paramType),
        (this.memoizedGenerate = memoizeWithKey(
          (paramValue, minDigitArg, maxDigitArg) => {
            const friendsByDigit = [];
            for (let digit = minDigitArg; digit <= maxDigitArg; digit++)
              friendsByDigit[digit] = callback(paramValue, digit);
            return friendsByDigit;
          },
          getFriendCacheKeyBuilder(paramType),
        )));
    }
    memoizedGenerate;
    getFriends(paramValue) {
      return this.memoizedGenerate(
        paramValue,
        puzzleSpec.minDigit,
        puzzleSpec.maxDigit,
      );
    }
  }
  var getOwnPropDescriptor05 = Object.getOwnPropertyDescriptor,
    applyClassDecorators05 = (decorators, target, propertyKey, kind) => {
      for (
        var descriptor =
            kind > 1
              ? void 0
              : kind
                ? getOwnPropDescriptor05(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (descriptor = decorator(descriptor) || descriptor);
      return descriptor;
    };
  const friendMasksFromDigitSets = memoizeWithKey(
      (digitSets) => {
        const { minDigit: minDigitValue, maxDigit: maxDigitValue } = puzzleSpec,
          masks = createFilledArray(maxDigitValue + 1, 0);
        for (let digit = minDigitValue; digit <= maxDigitValue; digit++)
          for (const friendDigit of digitsInMask(digitSets[digit]))
            masks[friendDigit] |= 1 << digit;
        return masks;
      },
      (digitSetsKey) => digitSetsKey,
      !0,
    ),
    friendMasksFromPredicate = memoizeWithKey(
      (predicate) => {
        const forwardMasks = createFilledArray(puzzleSpec.maxDigit + 1, 0),
          backwardMasks = createFilledArray(puzzleSpec.maxDigit + 1, 0);
        for (
          let digit1 = puzzleSpec.minDigit;
          digit1 <= puzzleSpec.maxDigit;
          digit1++
        )
          for (
            let digit2 = puzzleSpec.minDigit;
            digit2 <= puzzleSpec.maxDigit;
            digit2++
          )
            predicate(digit1, digit2) &&
              ((forwardMasks[digit1] |= 1 << digit2),
              (backwardMasks[digit2] |= 1 << digit1));
        return [forwardMasks, backwardMasks];
      },
      (predicateKey) => predicateKey,
      !0,
    );
  let PairComponent = class extends ConstraintComponent {
    friendsFor2;
    friendsFor1;
    cellId1;
    cellId2;
    unique;
    constructor(name, filterOrMapping, cellId1, cellId2) {
      (super(name, [cellId1, cellId2]),
        Array.isArray(filterOrMapping)
          ? ((this.friendsFor1 = filterOrMapping),
            (this.friendsFor2 = friendMasksFromDigitSets(this.friendsFor1)))
          : ([this.friendsFor1, this.friendsFor2] =
              friendMasksFromPredicate(filterOrMapping)),
        (this.cellId1 = cellId1),
        (this.cellId2 = cellId2),
        (this.unique = this.friendsFor1.every(
          (friendMask, digit) => (friendMask & (1 << digit)) === 0,
        )));
    }
    *update({ cells: cells }) {
      const candidates1 = cells[this.cellId1].candidates,
        candidates2 = cells[this.cellId2].candidates;
      if (candidates1) {
        let allowedMask2 = 0;
        for (const digit1 of digitsInMask(candidates1))
          allowedMask2 |= this.friendsFor1[digit1];
        yield filterCandidatesAtCellChange(allowedMask2, this.cellId2);
      }
      if (candidates2) {
        let allowedMask1 = 0;
        for (const digit2 of digitsInMask(candidates2))
          allowedMask1 |= this.friendsFor2[digit2];
        yield filterCandidatesAtCellChange(allowedMask1, this.cellId1);
      }
    }
    getExclusionGroup() {
      return this.unique ? this.cellIds : [];
    }
    getIsDone({ cells: cells }) {
      const candidatesAtCell2 = cells[this.cellId2].candidates;
      for (const digit of digitsInMask(cells[this.cellId1].candidates))
        if ((this.friendsFor1[digit] & candidatesAtCell2) !== candidatesAtCell2)
          return !1;
      return !0;
    }
  };
  PairComponent = applyClassDecorators05(
    [
      defineComponent(
        ["Pair", "AsymmetricalPair"],
        "The digits {digit1} and {digit2} in {cell1} and {cell2} are valid when {filterOrMapping(digit1, digit2)} evaluates to {true}, or when {filterOrMapping[digit1].has(digit2)}.",
        [
          [
            "filterOrMapping",
            "((d1: number, d2: number) => boolean) | DigitSet[]",
          ],
          ["cell1", ParamType.Cell],
          ["cell2", ParamType.Cell],
        ],
      ),
    ],
    PairComponent,
  );
  var getOwnPropDescriptor06 = Object.getOwnPropertyDescriptor,
    applyClassDecorators06 = (decorators, target, propertyKey, kind) => {
      for (
        var descriptor =
            kind > 1
              ? void 0
              : kind
                ? getOwnPropDescriptor06(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (descriptor = decorator(descriptor) || descriptor);
      return descriptor;
    };
  const differenceFriendTable = new FriendDigitTable((differences, digit) => {
    let friendMask = 0;
    for (const difference of differences)
      (digit + difference <= puzzleSpec.maxDigit &&
        (friendMask |= 1 << (digit + difference)),
        digit - difference >= puzzleSpec.minDigit &&
          (friendMask |= 1 << (digit - difference)));
    return friendMask;
  }, FriendCacheKeyKind.Number);
  let DifferenceComponent = class extends PairComponent {
    differences;
    cellId1;
    cellId2;
    constructor(name, difference, cellId1, cellId2) {
      ((difference = ensureArray(difference)),
        super(
          name,
          differenceFriendTable.getFriends(difference),
          cellId1,
          cellId2,
        ),
        (this.differences = difference),
        (this.cellId1 = cellId1),
        (this.cellId2 = cellId2));
    }
    validate({ cells: cells }) {
      const value1 = cells[this.cellId1].value,
        value2 = cells[this.cellId2].value;
      return value1 === void 0 ||
        value2 === void 0 ||
        this.differences.includes(Math.abs(value1 - value2))
        ? ValidResult
        : {
            valid: !1,
            message: `unable to make ${sharedHelpers.naming.getCellsDescription(this.cellIds)} have a difference of exactly ${joinWithConjunction(this.differences, "or")}`,
          };
    }
  };
  DifferenceComponent = applyClassDecorators06(
    [
      defineComponent(
        "Difference",
        "The difference between the values at {cell1} and {cell2} must be exactly {difference}.",
        [
          ["difference", ParamType.NumberOrNumberArray],
          ["cell1", ParamType.Cell],
          ["cell2", ParamType.Cell],
        ],
      ),
    ],
    DifferenceComponent,
  );
  var getOwnPropDescriptor07 = Object.getOwnPropertyDescriptor,
    applyClassDecorators07 = (decorators, target, propertyKey, kind) => {
      for (
        var descriptor =
            kind > 1
              ? void 0
              : kind
                ? getOwnPropDescriptor07(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (descriptor = decorator(descriptor) || descriptor);
      return descriptor;
    };
  const ratioFriendTable = new FriendDigitTable((ratios, digit) => {
    let friendMask = 0;
    for (const ratio of ratios)
      (digit * ratio <= puzzleSpec.maxDigit &&
        (friendMask |= 1 << (digit * ratio)),
        digit % ratio === 0 && (friendMask |= 1 << (digit / ratio)),
        digit === 0 && ratio === 0 && (friendMask = allDigitsMask));
    return friendMask;
  }, FriendCacheKeyKind.Number);
  let RatioComponent = class extends PairComponent {
    ratios;
    constructor(name, ratioOrRatios, cellId1, cellId2) {
      ((ratioOrRatios = ensureArray(ratioOrRatios)),
        super(
          name,
          ratioFriendTable.getFriends(ratioOrRatios),
          cellId1,
          cellId2,
        ),
        (this.ratios = ratioOrRatios));
    }
    validate({ cells: cells }) {
      const value1 = cells[this.cellId1].value,
        value2 = cells[this.cellId2].value;
      if (value1 === void 0 || value2 === void 0) return ValidResult;
      for (const ratio of this.ratios)
        if (value1 * ratio === value2 || value2 * ratio === value1)
          return ValidResult;
      const ratioDescription =
        this.ratios.length === 1
          ? `a 1 : ${this.ratios[0]} ratio`
          : `one of the following ratios: ${joinWithConjunction(
              this.ratios.map((ratioValue) => `1:${ratioValue}`),
              "or",
            )}`;
      return {
        valid: !1,
        message: `unable to make ${sharedHelpers.naming.getCellsDescription(this.cellIds)} form ${ratioDescription}`,
      };
    }
  };
  RatioComponent = applyClassDecorators07(
    [
      defineComponent(
        "RatioComponent",
        "The ratio of the values of {cell1} and {cell2} (either way) must equal {ratioOrRatios}.",
        [
          ["ratioOrRatios", ParamType.NumberOrNumberArray],
          ["cell1", ParamType.Cell],
          ["cell2", ParamType.Cell],
        ],
      ),
    ],
    RatioComponent,
  );
  class KropkiDotsLogicStep {
    constructor(sudoku, knownComponents) {
      this.sudoku = sudoku;
      function isKropkiComponent(candidateComponent) {
        return (
          (candidateComponent instanceof DifferenceComponent &&
            candidateComponent.differences.length === 1) ||
          (candidateComponent instanceof RatioComponent &&
            candidateComponent.ratios.length === 1)
        );
      }
      if (knownComponents) this.components = new Set(knownComponents);
      else {
        this.components = new Set();
        for (const existingComponent of sudoku.getConstraintComponents())
          isKropkiComponent(existingComponent) &&
            this.components.add(existingComponent);
      }
      this.sudoku.addComponentListener(
        ({ type: eventType, component: changedComponent }) => {
          eventType === "add"
            ? isKropkiComponent(changedComponent) &&
              this.components.add(changedComponent)
            : this.components.delete(changedComponent);
        },
      );
    }
    components;
    *execute() {
      for (const component of this.components)
        yield* this.executeForComponent(component);
    }
    *executeForComponent(component) {
      const cell1 = this.sudoku.cells[component.cellId1],
        cell2 = this.sudoku.cells[component.cellId2],
        combinedCandidates = cell1.candidates | cell2.candidates;
      if (
        !(component.ratios && combinedCandidates & 1) &&
        countCandidatesInMask(combinedCandidates) === 3
      ) {
        const middleDigitMask = 1 << digitsInMask(combinedCandidates)[1];
        yield* yieldRequiredDigitDeductions(
          this.sudoku,
          middleDigitMask,
          component.name,
          component.cellIds,
        );
      }
    }
    clone(newSudoku) {
      return new KropkiDotsLogicStep(newSudoku, this.components);
    }
  }
  class SumCandidateUpdater {
    constructor(
      state,
      minimumSum,
      maximumSum,
      cellIds,
      cellsName = sharedHelpers.naming.getCellsDescription(cellIds),
    ) {
      ((this.state = state),
        (this.minimumSum = minimumSum),
        (this.maximumSum = maximumSum),
        (this.cellIds = cellIds),
        (this.cellsName = cellsName));
    }
    *updateCandidates(allowRepeats, resolvedFlag) {
      allowRepeats
        ? yield* this.updateCandidatesWithRepeats()
        : yield* this.updateCandidatesWithoutRepeats(resolvedFlag);
    }
    *updateCandidatesWithoutRepeats(resolvedFlag) {
      const {
        state: state,
        minimumSum: minimumSum,
        maximumSum: maximumSum,
        cellIds: cellIds,
      } = this;
      let remainingMin = minimumSum,
        remainingMax = maximumSum;
      const unsolvedCells = new Set(cellIds);
      let availableDigitsMask = 0;
      for (const cellId of cellIds) {
        const cellValue = state.cells[cellId].value;
        cellValue !== void 0
          ? ((remainingMin -= cellValue),
            (remainingMax -= cellValue),
            unsolvedCells.delete(cellId),
            (availableDigitsMask &= ~(1 << cellValue)))
          : (availableDigitsMask |= state.cells[cellId].candidates);
      }
      if (unsolvedCells.size === 0) {
        (remainingMin > 0 &&
          (yield abortSolverChange(
            `${this.cellsName} sums to less than ${minimumSum}`,
            cellIds,
          )),
          remainingMax < 0 &&
            (yield abortSolverChange(
              `${this.cellsName} sums to more than ${maximumSum}`,
              cellIds,
            )));
        return;
      }
      remainingMin = Math.max(puzzleSpec.minDigit, remainingMin);
      const combinationMasks = [];
      for (
        let targetSum = remainingMin;
        targetSum <= remainingMax;
        targetSum++
      ) {
        const masksForSum = sharedHelpers.sums
          .getCombinationsForSumWithoutRepeat(targetSum, unsolvedCells.size)
          .map((digitCombination) => toDigitMask(digitCombination))
          .filter(
            (combinationMask) =>
              (combinationMask & availableDigitsMask) === combinationMask,
          );
        combinationMasks.push(...masksForSum);
      }
      if (combinationMasks.length === 1)
        (resolvedFlag && (resolvedFlag.value = !0),
          yield filterCandidatesAtCellsChange(
            combinationMasks[0],
            unsolvedCells,
          ));
      else {
        const allowedMask = combinationMasks.reduce(
          (maskAccumulator, maskToMerge) => maskAccumulator | maskToMerge,
          0,
        );
        yield filterCandidatesAtCellsChange(allowedMask, unsolvedCells);
      }
    }
    *updateCandidatesWithRepeats() {
      const {
        state: state,
        minimumSum: minimumSum,
        maximumSum: maximumSum,
        cellIds: cellIds,
      } = this;
      let remainingMin = minimumSum,
        remainingMax = maximumSum;
      const unsolvedCells = new Set(cellIds);
      for (const cellId of cellIds) {
        const cellValue = state.cells[cellId].value;
        cellValue !== void 0 &&
          ((remainingMin -= cellValue),
          (remainingMax -= cellValue),
          unsolvedCells.delete(cellId));
      }
      if (unsolvedCells.size === 0) {
        (remainingMin > 0 &&
          (yield abortSolverChange(
            `${this.cellsName} sums to less than ${minimumSum}`,
            cellIds,
          )),
          remainingMax < 0 &&
            (yield abortSolverChange(
              `${this.cellsName} sums to more than ${maximumSum}`,
              cellIds,
            )));
        return;
      }
      for (const unsolvedCellId of unsolvedCells) {
        const cell = state.cells[unsolvedCellId],
          minOtherSum = this.getMinSum(state, unsolvedCells, unsolvedCellId),
          maxOtherSum = this.getMaxSum(state, unsolvedCells, unsolvedCellId);
        let removalMask = 0;
        for (const digit of digitsInMask(cell.candidates))
          (minOtherSum + digit > remainingMax ||
            maxOtherSum + digit < remainingMin) &&
            (removalMask |= 1 << digit);
        yield removeCandidatesFromCellChange(removalMask, unsolvedCellId);
      }
    }
    getMinSum({ cells: cells }, cellIdSet, excludedCellId) {
      let total = 0;
      for (const cellId of cellIdSet) {
        if (cellId === excludedCellId) continue;
        const cell = cells[cellId];
        total += cell.value ?? (smallestDigitInMask(cell.candidates) || 0);
      }
      return total;
    }
    getMaxSum(state, cellIdSet, excludedCellId) {
      let total = 0;
      for (const cellId of cellIdSet) {
        if (cellId === excludedCellId) continue;
        const cell = state.cells[cellId];
        total += cell.value ?? (largestDigitInMask(cell.candidates) || 0);
      }
      return total;
    }
  }
  class ExactSumComponent extends ConstraintComponent {
    sums;
    repeat;
    minSum;
    maxSum;
    sumsDescription;
    constructor(componentName, sums, cellIds, repeat) {
      (super(componentName, cellIds),
        (this.sums = sums),
        (this.repeat = repeat),
        (this.sumsDescription = joinWithConjunction(this.sums, "or")),
        (this.minSum = Math.min(...this.sums)),
        (this.maxSum = Math.max(...this.sums)));
    }
    get validateDuringSolve() {
      return !0;
    }
    *update(state) {
      yield* new SumCandidateUpdater(
        state,
        this.minSum,
        this.maxSum,
        this.cellIds,
        this.name,
      ).updateCandidates(this.repeat);
    }
    validate(state) {
      let total = 0;
      for (let index = 0; index < this.cellIds.length; index++) {
        const cellValue = state.cells[this.cellIds[index]].value;
        if (cellValue === void 0) return ValidResult;
        total += cellValue;
      }
      return this.sums.includes(total)
        ? ValidResult
        : {
            valid: !1,
            message: `${this.name} cannot sum to ${this.sumsDescription}`,
          };
    }
  }
  class SumRangeComponent extends ConstraintComponent {
    minSum;
    maxSum;
    repeat;
    sumsDescription;
    constructor(componentName, minSum, maxSum, cellIds, repeat) {
      (super(componentName, cellIds),
        (this.minSum = minSum),
        (this.maxSum = maxSum),
        (this.repeat = repeat),
        (this.sumsDescription =
          this.minSum === this.maxSum
            ? this.minSum.toString()
            : `at least ${this.minSum} or at most ${this.maxSum}`));
    }
    *update(state) {
      const sumUpdater = new SumCandidateUpdater(
          state,
          this.minSum,
          this.maxSum,
          this.cellIds,
          this.name,
        ),
        resolvedFlag = { value: !1 };
      (yield* sumUpdater.updateCandidates(this.repeat, resolvedFlag),
        resolvedFlag.value && (yield removeComponentChange()));
    }
    validate({ cells: cells }) {
      let minPossibleSum, maxPossibleSum;
      if (this.repeat) {
        const extremesWithRepeat = sharedHelpers.sums.getExtremeSumsWithRepeat(
          this.cellIds.map((cellId) => cells[cellId].candidates),
        );
        ((minPossibleSum = extremesWithRepeat.minSum),
          (maxPossibleSum = extremesWithRepeat.maxSum));
      } else {
        const extremesWithoutRepeat =
          sharedHelpers.sums.getExtremeSumsWithoutRepeat(
            this.cellIds.map((cellId) => cells[cellId].candidates),
          );
        if (!extremesWithoutRepeat)
          return {
            valid: !1,
            message: `${this.name} cannot sum to ${this.sumsDescription}`,
          };
        ((minPossibleSum = extremesWithoutRepeat.minSum),
          (maxPossibleSum = extremesWithoutRepeat.maxSum));
      }
      return this.maxSum < minPossibleSum
        ? {
            valid: !1,
            message: `${this.name} sum(s) to at least ${minPossibleSum}`,
          }
        : this.minSum > maxPossibleSum
          ? {
              valid: !1,
              message: `${this.name} sum(s) to at most ${maxPossibleSum}`,
            }
          : ValidResult;
    }
  }
  class CloneableMap extends Map {
    clone() {
      const copy = new CloneableMap();
      for (const [key, valueSet] of this) copy.set(key, new Set(valueSet));
      return copy;
    }
  }
  function buildSumCombinationsEntry(sums, cellCount) {
    return {
      combinations: sharedHelpers.sums
        .getCombinationsForSumsWithoutRepeat(sums, cellCount)
        .map(toDigitMask),
      required: 0,
    };
  }
  function isNonRepeatingSumComponent(component) {
    return (
      (component instanceof SumRangeComponent ||
        component instanceof ExactSumComponent) &&
      !component.repeat
    );
  }
  class SumLogicCacheState {
    constructor(
      componentInfo = new Map(),
      componentsByCell = new CloneableMap(),
    ) {
      ((this.componentInfo = componentInfo),
        (this.componentsByCell = componentsByCell));
    }
    clone() {
      return new SumLogicCacheState(
        deepClone(this.componentInfo),
        this.componentsByCell.clone(),
      );
    }
  }
  class SimpleSumsLogicStep {
    constructor(state, sourceStep) {
      ((this.state = state),
        sourceStep
          ? (this.cache = sourceStep.cache.clone(state))
          : ((this.cache = new ComponentSubscription(
              isNonRepeatingSumComponent,
              new SumLogicCacheState(),
              (addedComponent, addCacheState) => {
                for (const addedCellId of addedComponent.cellIds)
                  (addCacheState.componentsByCell.has(addedCellId) ||
                    addCacheState.componentsByCell.set(addedCellId, new Set()),
                    addCacheState.componentsByCell
                      .get(addedCellId)
                      .add(addedComponent));
                const possibleSums =
                  "sums" in addedComponent
                    ? addedComponent.sums
                    : [
                        ...iterateRangeInclusive(
                          addedComponent.minSum,
                          addedComponent.maxSum,
                        ),
                      ];
                addCacheState.componentInfo.set(
                  addedComponent,
                  buildSumCombinationsEntry(
                    possibleSums,
                    addedComponent.cellIds.length,
                  ),
                );
              },
              (removedComponent, removeCacheState) => {
                for (const removedCellId of removedComponent.cellIds)
                  removeCacheState.componentsByCell
                    .get(removedCellId)
                    ?.delete(removedComponent);
                removeCacheState.componentInfo.delete(removedComponent);
              },
            )),
            this.cache.initialize(this.state)));
    }
    cache;
    *execute() {
      (yield* this.pointDigits(),
        yield* this.reduceCombinationsByContainment());
    }
    *pointDigits() {
      const state = this.state;
      for (const component of this.cache.getComponents()) {
        if (component.cellIds.length === 2) continue;
        const info = this.cache.getState().componentInfo.get(component);
        let placedMask = 0,
          impossibleMask = allDigitsMask;
        for (const cellId of component.cellIds) {
          const cellValue = state.cells[cellId].value;
          (cellValue !== void 0 && (placedMask |= 1 << cellValue),
            (impossibleMask &= ~state.cells[cellId].candidates));
        }
        info.combinations = info.combinations.filter(
          (combinationMask) =>
            (combinationMask & placedMask) === placedMask &&
            (combinationMask & impossibleMask) === 0,
        );
        const requiredMask = info.combinations.reduce(
          (maskAccumulator, maskToIntersect) =>
            maskAccumulator & maskToIntersect,
          allDigitsMask,
        );
        yield* yieldRequiredDigitDeductions(
          state,
          requiredMask,
          component.name,
          component.cellIds,
        );
      }
    }
    *reduceCombinationsByContainment() {
      for (
        let digit = puzzleSpec.minDigit;
        digit <= puzzleSpec.maxDigit;
        digit++
      )
        for (const candidateSet of this.state.getSetsForCandidate(digit)) {
          const containingComponents = this.getComponentsContainingCells(
            candidateSet.cells,
          );
          if (!containingComponents) continue;
          const digitMask = 1 << digit;
          for (const component of containingComponents) {
            const info = this.cache.getState().componentInfo.get(component);
            ((info.required |= digitMask),
              (info.combinations = info.combinations.filter(
                (combinationMask) =>
                  (combinationMask & digitMask) === digitMask,
              )));
            const unionMask = info.combinations.reduce(
              (maskAccumulator, maskToMerge) => maskAccumulator | maskToMerge,
              0,
            );
            yield {
              description: {
                type: "UpdateCombinations",
                parameters: [
                  component.name,
                  candidateSet.name,
                  info.required,
                  info.combinations,
                ],
              },
              changes: [
                filterCandidatesAtCellsChange(unionMask, component.cellIds),
              ],
            };
          }
        }
    }
    getComponentsContainingCells(cellIds) {
      let commonComponents;
      for (const cellId of cellIds) {
        const componentsForCell = this.cache
          .getState()
          .componentsByCell.get(cellId);
        if (!componentsForCell) return;
        if (!commonComponents) commonComponents = new Set(componentsForCell);
        else if (
          (retainIntersectionInSet(commonComponents, componentsForCell),
          commonComponents.size === 0)
        )
          return;
      }
      return commonComponents;
    }
    clone(state) {
      return new SimpleSumsLogicStep(state, this);
    }
  }
  class UnorthodoxFishLogicStep {
    constructor(state, sourceStep) {
      if (((this.state = state), sourceStep))
        ((this.cache = sourceStep.cache.clone(state)),
          (this.regionComponents = sourceStep.regionComponents),
          (this.regionComponentIndexByCell =
            sourceStep.regionComponentIndexByCell));
      else {
        ((this.cache = new ComponentSubscription(
          (candidateComponent) =>
            candidateComponent instanceof RequiredDigitsComponent &&
            candidateComponent.repeatCounts.size > 0,
        )),
          this.cache.initialize(state),
          (this.regionComponents = [...state.getHouseComponents()].filter(
            (houseComponent) => houseComponent.houseType === HouseType.Region,
          )),
          (this.regionComponentIndexByCell = []));
        for (
          let regionIndex = 0;
          regionIndex < this.regionComponents.length;
          regionIndex++
        ) {
          const regionComponent = this.regionComponents[regionIndex];
          for (const regionCellId of regionComponent.cellIds)
            this.regionComponentIndexByCell[regionCellId] = regionIndex;
        }
      }
    }
    cache;
    regionComponents;
    regionComponentIndexByCell;
    *execute() {
      const state = this.state;
      for (const component of this.cache.getComponents())
        for (let [digit, remainingCount] of component.repeatCounts) {
          let rowMask = 0,
            columnMask = 0,
            regionMask = 0,
            hasCellOutsideRegion = !1;
          for (const cellId of component.cellIds) {
            if (state.cells[cellId].value !== void 0) {
              state.cells[cellId].value === digit && remainingCount--;
              continue;
            }
            if (state.cells[cellId].candidates & (1 << digit)) {
              ((rowMask |= 1 << sharedHelpers.cellIds.getY(cellId)),
                (columnMask |= 1 << sharedHelpers.cellIds.getX(cellId)));
              const cellRegionIndex = this.regionComponentIndexByCell[cellId];
              cellRegionIndex === void 0
                ? (hasCellOutsideRegion = !0)
                : (regionMask |= 1 << cellRegionIndex);
            }
          }
          const deductions = [],
            rowCount = popCount(rowMask),
            columnCount = popCount(columnMask),
            regionCount = popCount(regionMask);
          if (rowCount === remainingCount + 1) {
            const rowIndices = listDigitsInMask(rowMask);
            deductions.push({
              changes: [
                removeDigitFromCellsChange(
                  digit,
                  this.getRowCellsWithoutCells(rowIndices, component.cellIds),
                ),
              ],
              description: {
                type: "UnorthodoxFishes",
                parameters: [
                  !0,
                  component.name,
                  rowIndices.map((rowIndex) => `row ${rowIndex + 1}`),
                ],
              },
            });
          } else
            rowCount < remainingCount + 1 &&
              (yield {
                changes: [abortSolverChange()],
                description: {
                  type: "UnorthodoxFishes",
                  parameters: [!1, component.name, HouseType.Row, digit],
                },
              });
          if (columnCount === remainingCount + 1) {
            const columnIndices = listDigitsInMask(columnMask);
            deductions.push({
              changes: [
                removeDigitFromCellsChange(
                  digit,
                  this.getColumnCellsWithoutCells(
                    columnIndices,
                    component.cellIds,
                  ),
                ),
              ],
              description: {
                type: "UnorthodoxFishes",
                parameters: [
                  !0,
                  component.name,
                  columnIndices.map(
                    (columnIndex) => `column ${columnIndex + 1}`,
                  ),
                ],
              },
            });
          } else
            columnCount < remainingCount + 1 &&
              (yield {
                changes: [abortSolverChange()],
                description: {
                  type: "UnorthodoxFishes",
                  parameters: [!1, component.name, HouseType.Column, digit],
                },
              });
          if (!hasCellOutsideRegion && regionCount === remainingCount + 1) {
            const regionIndices = listDigitsInMask(regionMask);
            deductions.push({
              changes: [
                removeDigitFromCellsChange(
                  digit,
                  this.getRegionCellsWithoutCells(
                    regionIndices,
                    component.cellIds,
                  ),
                ),
              ],
              description: {
                type: "UnorthodoxFishes",
                parameters: [
                  !0,
                  component.name,
                  regionIndices.map(
                    (namedRegionIndex) =>
                      this.regionComponents[namedRegionIndex].name,
                  ),
                ],
              },
            });
          } else
            !hasCellOutsideRegion &&
              regionCount < remainingCount + 1 &&
              (yield {
                changes: [abortSolverChange()],
                description: {
                  type: "UnorthodoxFishes",
                  parameters: [!1, component.name, HouseType.Region, digit],
                },
              });
          deductions.length > 0 && (yield deductions);
        }
    }
    clone(state) {
      return new UnorthodoxFishLogicStep(state, this);
    }
    getRowCellsWithoutCells(rowIndices, excludedCells) {
      const rowCells = new Set();
      for (const rowIndex of rowIndices)
        addAllToSet(rowCells, sharedHelpers.geometry.getCellsInRow(rowIndex));
      return (deleteAllFromSet(rowCells, excludedCells), rowCells);
    }
    getColumnCellsWithoutCells(columnIndices, excludedCells) {
      const columnCells = new Set();
      for (const columnIndex of columnIndices)
        addAllToSet(
          columnCells,
          sharedHelpers.geometry.getCellsInColumn(columnIndex),
        );
      return (deleteAllFromSet(columnCells, excludedCells), columnCells);
    }
    getRegionCellsWithoutCells(regionIndices, excludedCells) {
      const regionCells = new Set();
      for (const regionIndex of regionIndices)
        addAllToSet(regionCells, this.regionComponents[regionIndex].cellIds);
      return (deleteAllFromSet(regionCells, excludedCells), regionCells);
    }
  }
  class YWingLogicStep {
    constructor(sudokuState) {
      this.sudoku = sudokuState;
    }
    *execute() {
      const sudoku = this.sudoku;
      for (const pivotCell of sudoku.cells) {
        if (countCandidatesInMask(pivotCell.candidates) !== 2) continue;
        const bivalueCellIds = [
          ...sudoku.getCellsSeenByCell(pivotCell.id),
        ].filter(
          (peerCellId) =>
            countCandidatesInMask(sudoku.cells[peerCellId].candidates) === 2,
        );
        for (const [wingCellA, wingCellB] of iterateCombinationsOfSize(
          bivalueCellIds,
          2,
        )) {
          const unionMask =
            pivotCell.candidates |
            sudoku.cells[wingCellA].candidates |
            sudoku.cells[wingCellB].candidates;
          if (countCandidatesInMask(unionMask) !== 3) continue;
          const sharedMask =
            sudoku.cells[wingCellA].candidates &
            sudoku.cells[wingCellB].candidates;
          countCandidatesInMask(sharedMask & pivotCell.candidates) === 0 &&
            (yield {
              changes: [
                removeCandidatesFromCellsChange(
                  sharedMask,
                  sudoku.getCellsSeenByCells([wingCellA, wingCellB]),
                ),
              ],
              description: {
                type: "YWing",
                parameters: [pivotCell.id, [wingCellA, wingCellB]],
              },
            });
        }
      }
    }
    clone(state) {
      return new YWingLogicStep(state);
    }
  }
  var LogicStepType = ((stepTypes) => (
    (stepTypes.NakedSets = "nakedSets"),
    (stepTypes.HiddenSets = "hiddenSets"),
    (stepTypes.PointingSets = "pointingSets"),
    (stepTypes.XWings = "xWings"),
    (stepTypes.Fishes = "fishes"),
    (stepTypes.YWings = "yWings"),
    (stepTypes.AlmostXWings = "skyscrapers"),
    (stepTypes.UnorthodoxNakedSet = "unorthodoxNakedSets"),
    (stepTypes.SimpleSums = "simpleSumsLogic"),
    (stepTypes.ConsecutiveSets = "consecutiveSetsLogic"),
    (stepTypes.KropkiDots = "kropkiDotsLogic"),
    (stepTypes.UnorthodoxFishes = "unorthodoxFishes"),
    (stepTypes.CountingCircles = "countingCircles"),
    (stepTypes.ByContradiction = "byContradiction"),
    stepTypes
  ))(LogicStepType || {});
  class StandardLogicStepsGenerator {
    enabledStepTypes;
    useRandomness;
    constructor(options) {
      ((this.enabledStepTypes = new Set(options.stepTypes)),
        (this.useRandomness = options.useRandomness));
    }
    setLogicSteps(solver) {
      (solver.setLogicSteps(this.getLogicSteps(solver.state)),
        (solver.useRandomness = this.useRandomness));
    }
    getLogicSteps(state) {
      const isEnabled = (stepType) => this.enabledStepTypes.has(stepType),
        steps = [];
      (steps.push(new NakedSingleLogicStep(state)),
        steps.push(new HiddenSingleLogicStep(state)));
      const nakedSetsEnabled = isEnabled(LogicStepType.NakedSets),
        hiddenSetsEnabled = isEnabled(LogicStepType.HiddenSets),
        unorthodoxNakedSetsEnabled = isEnabled(
          LogicStepType.UnorthodoxNakedSet,
        );
      for (let setSize = 2; setSize <= puzzleSpec.digitCount / 2; setSize++)
        (nakedSetsEnabled && steps.push(new NakedSetLogicStep(setSize, state)),
          hiddenSetsEnabled &&
            steps.push(new HiddenSetLogicStep(setSize, state)),
          unorthodoxNakedSetsEnabled &&
            steps.push(new UnorthodoxNakedSetLogicStep(setSize, state)));
      if (
        (isEnabled(LogicStepType.PointingSets) &&
          steps.push(new PointingSetLogicStep(state)),
        (isEnabled(LogicStepType.XWings) || isEnabled(LogicStepType.Fishes)) &&
          steps.push(new FishLogicStep(2, state)),
        isEnabled(LogicStepType.SimpleSums) &&
          steps.push(new SimpleSumsLogicStep(state)),
        isEnabled(LogicStepType.ConsecutiveSets) &&
          steps.push(new ConsecutiveSetsLogicStep(state)),
        isEnabled(LogicStepType.KropkiDots) &&
          steps.push(new KropkiDotsLogicStep(state)),
        isEnabled(LogicStepType.UnorthodoxFishes) &&
          steps.push(new UnorthodoxFishLogicStep(state)),
        isEnabled(LogicStepType.Fishes))
      )
        for (
          let fishSize = 3;
          fishSize <= puzzleSpec.size.width / 2;
          fishSize++
        )
          steps.push(new FishLogicStep(fishSize, state));
      return (
        isEnabled(LogicStepType.YWings) &&
          steps.push(new YWingLogicStep(state)),
        isEnabled(LogicStepType.AlmostXWings) &&
          steps.push(new AlmostXWingLogicStep(state)),
        isEnabled(LogicStepType.CountingCircles) &&
          steps.push(new CountingCirclesLogicStep(state)),
        isEnabled(LogicStepType.ByContradiction) &&
          steps.push(new ByContradictionLogicStep(state, this.useRandomness)),
        steps
      );
    }
  }
  const CustomPuzzleEnabledStepTypes = new Set([
    LogicStepType.NakedSets,
    LogicStepType.HiddenSets,
    LogicStepType.PointingSets,
    LogicStepType.UnorthodoxNakedSet,
    LogicStepType.SimpleSums,
    LogicStepType.ConsecutiveSets,
    LogicStepType.KropkiDots,
    LogicStepType.CountingCircles,
    LogicStepType.ByContradiction,
  ]);
  class CustomLogicStepsGenerator {
    standardLogicStepsGenerator;
    useRandomness;
    constructor(options) {
      ((options = {
        ...options,
        stepTypes: options.stepTypes.filter((stepType) =>
          CustomPuzzleEnabledStepTypes.has(stepType),
        ),
      }),
        (this.standardLogicStepsGenerator = new StandardLogicStepsGenerator(
          options,
        )),
        (this.useRandomness = this.standardLogicStepsGenerator.useRandomness));
    }
    setLogicSteps(solver) {
      this.standardLogicStepsGenerator.setLogicSteps(solver);
    }
  }
  const EmptyValueSentinel = 4294967295;
  function serializeCellsToBuffer(cells) {
    const buffer = new Uint32Array(cells.length * 2);
    for (let index = 0; index < cells.length; index++)
      ((buffer[index * 2] = cells[index].value ?? EmptyValueSentinel),
        (buffer[index * 2 + 1] = cells[index].candidates));
    return buffer;
  }
  var getOwnPropDescriptor08 = Object.getOwnPropertyDescriptor,
    applyClassDecorators08 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor08(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let BetweenComponent = class extends ConstraintComponent {
    constructor(componentName, endPoints, midPoints) {
      (super(componentName, [...endPoints, ...midPoints]),
        (this.endPoints = endPoints),
        (this.midPoints = midPoints));
    }
    *update({ cells: cells }) {
      (yield* this.updateEnds(cells), yield* this.updateInBetween(cells));
    }
    *updateInBetween(cells) {
      const firstEndCell = cells[this.endPoints[0]],
        secondEndCell = cells[this.endPoints[1]],
        forwardRange = [
          smallestDigitInMask(firstEndCell.candidates),
          largestDigitInMask(secondEndCell.candidates),
        ],
        backwardRange = [
          smallestDigitInMask(secondEndCell.candidates),
          largestDigitInMask(firstEndCell.candidates),
        ];
      let upperBound, lowerBound;
      if (
        forwardRange[0] < forwardRange[1] &&
        backwardRange[0] < backwardRange[1]
      )
        ((upperBound = Math.max(forwardRange[1], backwardRange[1])),
          (lowerBound = Math.min(forwardRange[0], backwardRange[0])));
      else if (forwardRange[0] < forwardRange[1])
        ((upperBound = forwardRange[1]), (lowerBound = forwardRange[0]));
      else if (backwardRange[0] < backwardRange[1])
        ((upperBound = backwardRange[1]), (lowerBound = backwardRange[0]));
      else {
        yield abortSolverChange(
          `the end-points of ${this.name} have the same value`,
          this.endPoints,
        );
        return;
      }
      let betweenMask = 0;
      for (let digit = lowerBound + 1; digit <= upperBound - 1; digit++)
        betweenMask |= 1 << digit;
      yield filterCandidatesAtCellsChange(betweenMask, this.midPoints);
    }
    *updateEnds(cells) {
      let lowestMidValue = puzzleSpec.maxDigit - 1,
        highestMidValue = puzzleSpec.minDigit + 1;
      for (const midCellId of this.midPoints) {
        const midValue = cells[midCellId].value;
        midValue !== void 0 &&
          ((lowestMidValue = Math.min(lowestMidValue, midValue)),
          (highestMidValue = Math.max(highestMidValue, midValue)));
      }
      if (lowestMidValue > highestMidValue) return;
      let lowerMask = 0,
        upperMask = 0;
      for (
        let digit = puzzleSpec.minDigit;
        digit <= puzzleSpec.maxDigit;
        digit++
      )
        digit < lowestMidValue
          ? (lowerMask |= 1 << digit)
          : digit > highestMidValue && (upperMask |= 1 << digit);
      const firstEndCandidates = cells[this.endPoints[0]].candidates,
        secondEndCandidates = cells[this.endPoints[1]].candidates,
        firstLowSecondHigh =
          (firstEndCandidates & lowerMask) !== 0 &&
          (secondEndCandidates & upperMask) !== 0,
        firstHighSecondLow =
          (firstEndCandidates & upperMask) !== 0 &&
          (secondEndCandidates & lowerMask) !== 0;
      !firstLowSecondHigh && !firstHighSecondLow
        ? yield abortSolverChange(
            `no valid values exist for the end-points of ${this.name}`,
            this.endPoints.slice(),
          )
        : firstLowSecondHigh && !firstHighSecondLow
          ? (yield filterCandidatesAtCellChange(lowerMask, this.endPoints[0]),
            yield filterCandidatesAtCellChange(upperMask, this.endPoints[1]))
          : !firstLowSecondHigh && firstHighSecondLow
            ? (yield filterCandidatesAtCellChange(upperMask, this.endPoints[0]),
              yield filterCandidatesAtCellChange(lowerMask, this.endPoints[1]))
            : yield filterCandidatesAtCellsChange(
                lowerMask | upperMask,
                this.endPoints,
              );
    }
    getIsDone({ cells: cells }) {
      return (
        cells[this.endPoints[0]].value !== void 0 &&
        cells[this.endPoints[1]].value !== void 0
      );
    }
  };
  BetweenComponent = applyClassDecorators08(
    [
      defineComponent(
        "Between",
        "The digits on all {midPoints} must be between the digits on the {endPoints}.",
        [
          ["endPoints", { type: ParamType.CellArray, amount: 2 }],
          ["midPoints", ParamType.CellArray],
        ],
      ),
    ],
    BetweenComponent,
  );
  class CompositeComponent extends ConstraintComponent {
    constructor(componentName, cellIds, getComponents) {
      (super(componentName, cellIds), (this.getComponents = getComponents));
    }
    *initialize(state) {
      yield replaceComponentChange(this.getComponents(state));
    }
  }
  var getOwnPropDescriptor09 = Object.getOwnPropertyDescriptor,
    applyClassDecorators09 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor09(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let ConsecutiveDigitsSetComponent = class extends CompositeComponent {
    constructor(componentName, cellIds) {
      super(componentName, cellIds, () => {
        const components = [];
        return (
          cellIds.length === 2
            ? components.push(
                new DifferenceComponent(
                  componentName,
                  1,
                  cellIds[0],
                  cellIds[1],
                ),
              )
            : cellIds.length === puzzleSpec.digitCount
              ? components.push(new HouseComponent(componentName, cellIds))
              : (components.push(
                  new ConsecutiveDigitsComponent(componentName, cellIds),
                ),
                components.push(
                  new DifferentDigitsComponent(componentName, cellIds),
                )),
          components
        );
      });
    }
    getExclusionGroup() {
      return this.cellIds;
    }
  };
  ConsecutiveDigitsSetComponent = applyClassDecorators09(
    [
      defineComponent(
        "ConsecutiveDigitsSet",
        "All digits within {cells} must make a set of consecutive digits, without repeats.",
        [["cells", ParamType.CellArray]],
      ),
    ],
    ConsecutiveDigitsSetComponent,
  );
  var getOwnPropDescriptor10 = Object.getOwnPropertyDescriptor,
    applyClassDecorators10 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor10(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let CountDigitsComponent = class extends ConstraintComponent {
    constructor(componentName, digits, counterCell, targetCells) {
      (super(componentName, [counterCell, ...targetCells]),
        (this.digits = digits),
        (this.counterCell = counterCell),
        (this.targetCells = targetCells),
        (this.digitsName =
          sharedHelpers.naming.getDigitFilterDescription(digits)));
    }
    digitsName;
    get validateDuringSolve() {
      return !0;
    }
    validate({ cells: cells }) {
      let definiteCount = 0,
        possibleCount = 0;
      const minCount = smallestDigitInMask(cells[this.counterCell].candidates),
        maxCount = largestDigitInMask(cells[this.counterCell].candidates);
      for (const targetCellId of this.targetCells) {
        const targetCell = cells[targetCellId];
        if (
          (this.digits & targetCell.candidates) === targetCell.candidates &&
          (definiteCount++, definiteCount > maxCount)
        )
          return {
            valid: !1,
            message: `${this.name} counts at least ${definiteCount} cells containing ${this.digitsName} `,
          };
        targetCell.candidates & this.digits && possibleCount++;
      }
      return possibleCount < minCount
        ? {
            valid: !1,
            message: `${this.name} counts at most ${possibleCount} cells containing ${this.digitsName}`,
          }
        : ValidResult;
    }
  };
  CountDigitsComponent = applyClassDecorators10(
    [
      defineComponent(
        "CountDigits",
        "The digit in {counterCell} must equal the amount of occurrences of digits from {digits}.",
        [
          ["digits", ParamType.DigitSet],
          ["counterCell", ParamType.Cell],
          ["targetCells", ParamType.CellArray],
        ],
      ),
    ],
    CountDigitsComponent,
  );
  var getOwnPropDescriptor11 = Object.getOwnPropertyDescriptor,
    applyClassDecorators11 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor11(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let CountDigitComponent = class extends CompositeComponent {
    constructor(componentName, digit, counterCell, targetCells) {
      super(
        componentName,
        targetCells,
        () =>
          new CountDigitsComponent(
            componentName,
            1 << digit,
            counterCell,
            targetCells,
          ),
      );
    }
  };
  CountDigitComponent = applyClassDecorators11(
    [
      defineComponent(
        "CountDigit",
        "The digit in {counterCell} must equal the amount of occurrences of {digit} in {targetCells}",
        [
          ["digit", ParamType.Number],
          ["counterCell", ParamType.Cell],
          ["targetCells", ParamType.CellArray],
        ],
      ),
    ],
    CountDigitComponent,
  );
  var getOwnPropDescriptor12 = Object.getOwnPropertyDescriptor,
    applyClassDecorators12 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor12(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let DifferentCombinationsComponent = class extends ConstraintComponent {
    constructor(componentName, cellGroups) {
      (super(componentName, cellGroups.flat()), (this.cellGroups = cellGroups));
    }
    get validateDuringSolve() {
      return !0;
    }
    validate({ cells: cells }) {
      const filledGroups = this.cellGroups.filter((candidateGroup) =>
        candidateGroup.every(
          (cellIdInGroup) => cells[cellIdInGroup].value !== void 0,
        ),
      );
      if (filledGroups.length < 2) return ValidResult;
      const makeUpToGroup = new Map();
      for (const filledGroup of filledGroups) {
        const makeUp = this.getMakeUp(cells, filledGroup);
        if (!makeUpToGroup.has(makeUp)) makeUpToGroup.set(makeUp, filledGroup);
        else
          return {
            valid: !1,
            cells: filledGroup,
            message: `the make-ups of ${sharedHelpers.naming.getCellsDescription(filledGroup)} and ${sharedHelpers.naming.getCellsDescription(makeUpToGroup.get(makeUp))} are the same`,
          };
      }
      return ValidResult;
    }
    getMakeUp(cells, group) {
      return group
        .map((groupCellId) => cells[groupCellId].value)
        .sort()
        .join("");
    }
  };
  DifferentCombinationsComponent = applyClassDecorators12(
    [
      defineComponent(
        "DifferentCombinations",
        "Every group of cells of {cellGroups} must have a distinct make-up of digits.",
        [["cellGroups", "CellId[][]"]],
      ),
    ],
    DifferentCombinationsComponent,
  );
  var getOwnPropDescriptor13 = Object.getOwnPropertyDescriptor,
    applyClassDecorators13 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor13(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let DifferentGroupsComponent = class extends ConstraintComponent {
    groups;
    constructor(componentName, groupMasks, cellIds) {
      (super(componentName, cellIds),
        (this.groups = groupMasks.map((groupMaskValue) => +groupMaskValue)));
    }
    *initialize(state) {
      const allGroupsMask = this.groups.reduce(
        (accumulatedMask, groupMask) => groupMask | accumulatedMask,
      );
      (allGroupsMask !== allDigitsMask &&
        (yield filterCandidatesAtCellsChange(allGroupsMask, this.cellIds)),
        yield* this.update(state));
    }
    *update({ cells: cells }) {
      for (let cellIndex = 0; cellIndex < this.cellIds.length; cellIndex++) {
        const candidates = cells[this.cellIds[cellIndex]].candidates;
        for (const groupMask of this.groups)
          if ((candidates & groupMask) === candidates)
            for (
              let otherCellIndex = 0;
              otherCellIndex < this.cellIds.length;
              otherCellIndex++
            )
              otherCellIndex !== cellIndex &&
                (yield removeCandidatesFromCellChange(
                  groupMask,
                  this.cellIds[otherCellIndex],
                ));
      }
    }
    getIsDone({ cells: cells }) {
      for (let cellIndex = 0; cellIndex < this.cellIds.length; cellIndex++) {
        const candidates = cells[this.cellIds[cellIndex]].candidates;
        for (
          let otherCellIndex = cellIndex + 1;
          otherCellIndex < this.cellIds.length;
          otherCellIndex++
        ) {
          const otherCandidates = cells[this.cellIds[cellIndex]].candidates;
          if ((candidates & otherCandidates) !== 0) return !1;
        }
      }
      return !0;
    }
  };
  DifferentGroupsComponent = applyClassDecorators13(
    [
      defineComponent(
        "DifferentGroups",
        `Every cell of {cells} must have a digit from a different group from {groups}. E.g. if one group is 123, and one cell has a 1, the other cells cannot be 2 or 3.
**Note:** currently only works properly when the groups do not overlap.`,
        [
          ["groups", ParamType.DigitSetArray],
          ["cells", ParamType.CellArray],
        ],
      ),
    ],
    DifferentGroupsComponent,
  );
  var getOwnPropDescriptor14 = Object.getOwnPropertyDescriptor,
    applyClassDecorators14 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor14(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let PredefinedCandidatesComponent = class extends ConstraintComponent {
    candidates;
    constructor(componentName, candidateMask, cellOrCells) {
      (super(componentName, ensureArray(cellOrCells)),
        (this.candidates = +candidateMask));
    }
    *initialize() {
      (yield filterCandidatesAtCellsChange(this.candidates, this.cellIds),
        yield removeComponentChange());
    }
  };
  PredefinedCandidatesComponent = applyClassDecorators14(
    [
      defineComponent(
        "PredefinedCandidates",
        "The value of {cellOrCells} must be one of {candidates}.",
        [
          ["candidates", ParamType.DigitSet],
          ["cellOrCells", ParamType.CellArray],
        ],
      ),
    ],
    PredefinedCandidatesComponent,
  );
  var getOwnPropDescriptor15 = Object.getOwnPropertyDescriptor,
    applyClassDecorators15 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor15(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let RequiredGroupsComponent = class extends ConstraintComponent {
    groups;
    constructor(componentName, groupMasks, cellIds) {
      (super(componentName, cellIds),
        (this.groups = groupMasks.map((groupMaskValue) => +groupMaskValue)));
    }
    *update(state) {
      for (const groupMask of this.groups) {
        const onlyCellId = this.getOnlyPossibleIndexForGroup(state, groupMask);
        if (onlyCellId === !1) {
          yield abortSolverChange(
            `impossible to satisfy ${this.name}`,
            this.cellIds,
          );
          return;
        } else
          onlyCellId !== void 0 &&
            (yield filterCandidatesAtCellChange(groupMask, onlyCellId));
      }
    }
    getOnlyPossibleIndexForGroup(state, groupMask) {
      let foundCellId;
      for (let cellIndex = 0; cellIndex < this.cellIds.length; cellIndex++) {
        const cellId = this.cellIds[cellIndex];
        if ((state.cells[cellId].candidates & groupMask) !== 0) {
          if (foundCellId !== void 0) return;
          foundCellId = cellId;
        }
      }
      return foundCellId ?? !1;
    }
  };
  RequiredGroupsComponent = applyClassDecorators15(
    [
      defineComponent(
        "RequiredGroups",
        `For every group from {groups}, a digit must appear at least once in {cells}. E.g. If the groups are 123, 456 and 789, then {cells} must be at least 3 cells, and one digit of every group is assigned to a cell. 
**Note:** currently only works properly when the groups do not overlap.`,
        [
          ["groups", ParamType.DigitSetArray],
          ["cells", ParamType.CellArray],
        ],
      ),
    ],
    RequiredGroupsComponent,
  );
  var getOwnPropDescriptor16 = Object.getOwnPropertyDescriptor,
    applyClassDecorators16 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor16(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let DiverseGroupsComponent = class extends CompositeComponent {
    constructor(componentName, groupMasks, cellIds) {
      super(componentName, cellIds, () => {
        const components = [];
        if (cellIds.length === 1) {
          const combinedMask = groupMasks.reduce(
            (accumulatedMask, groupMask) => accumulatedMask | groupMask,
            0,
          );
          components.push(
            new PredefinedCandidatesComponent(
              componentName,
              combinedMask,
              cellIds[0],
            ),
          );
        } else
          (cellIds.length >= groupMasks.length &&
            components.push(
              new RequiredGroupsComponent(componentName, groupMasks, cellIds),
            ),
            cellIds.length <= groupMasks.length &&
              components.push(
                new DifferentGroupsComponent(
                  componentName,
                  groupMasks,
                  cellIds,
                ),
              ));
        return components;
      });
    }
  };
  DiverseGroupsComponent = applyClassDecorators16(
    [
      defineComponent(
        "DiverseGroups",
        `A digit from every group from {groups} must appear at least once in {cells}, or from different groups if there are less cells than there are groups. 
**Note:** currently only works properly when the groups do not overlap.`,
        [
          ["groups", ParamType.DigitSetArray],
          ["cells", ParamType.CellArray],
        ],
      ),
    ],
    DiverseGroupsComponent,
  );
  var getOwnPropDescriptor17 = Object.getOwnPropertyDescriptor,
    applyClassDecorators17 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor17(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let ForbiddenCandidatesComponent = class extends ConstraintComponent {
    forbiddenCandidates;
    constructor(componentName, forbiddenMask, cellOrCells) {
      (super(componentName, ensureArray(cellOrCells)),
        (this.forbiddenCandidates = +forbiddenMask));
    }
    *initialize() {
      (yield filterCandidatesAtCellsChange(
        allDigitsMask - this.forbiddenCandidates,
        this.cellIds,
      ),
        yield removeComponentChange());
    }
  };
  ForbiddenCandidatesComponent = applyClassDecorators17(
    [
      defineComponent(
        "ForbiddenCandidates",
        "The value of {cellOrCells} cannot be any of {candidates}.",
        [
          ["candidates", ParamType.DigitSet],
          ["cellOrCells", ParamType.CellOrCellArray],
        ],
      ),
    ],
    ForbiddenCandidatesComponent,
  );
  var getOwnPropDescriptor18 = Object.getOwnPropertyDescriptor,
    applyClassDecorators18 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor18(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let MaxDigitCountComponent = class extends ConstraintComponent {
    value;
    maxCount;
    constructor(componentName, digitValue, maxCount, cellIds) {
      (super(componentName, cellIds),
        (this.value = digitValue),
        (this.maxCount = maxCount));
    }
    *initialize(state) {
      this.maxCount === 0
        ? yield replaceComponentChange(
            new ForbiddenCandidatesComponent(
              this.name,
              1 << this.value,
              this.cellIds,
            ),
          )
        : yield* super.initialize(state);
    }
    *update(state) {
      const remainingCellIds = [];
      let placedCount = 0,
        candidateCount = 0;
      for (const cellId of this.cellIds)
        (state.cells[cellId].value === this.value && placedCount < this.maxCount
          ? placedCount++
          : remainingCellIds.push(cellId),
          state.cells[cellId].candidates & (1 << this.value) &&
            candidateCount++);
      (candidateCount <= this.maxCount && (yield removeComponentChange()),
        placedCount === this.maxCount &&
          (yield removeDigitFromCellsChange(this.value, remainingCellIds)));
    }
  };
  MaxDigitCountComponent = applyClassDecorators18(
    [
      defineComponent(
        "MaxDigitCount",
        "The digit {value} must appear at most {maxCount} times in {cells}.",
        [
          ["value", ParamType.Number],
          ["maxCount", ParamType.Number],
          ["cells", ParamType.CellArray],
        ],
      ),
    ],
    MaxDigitCountComponent,
  );
  var getOwnPropDescriptor19 = Object.getOwnPropertyDescriptor,
    applyClassDecorators19 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor19(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let ExactDigitCountComponent = class extends CompositeComponent {
    constructor(componentName, digitValue, requiredCount, cellIds) {
      super(componentName, cellIds, () => {
        const repeatedDigits = createFilledArray(requiredCount, digitValue);
        return [
          new MaxDigitCountComponent(
            componentName,
            digitValue,
            requiredCount,
            cellIds,
          ),
          new RequiredDigitsComponent(componentName, repeatedDigits, cellIds),
        ];
      });
    }
  };
  ExactDigitCountComponent = applyClassDecorators19(
    [
      defineComponent(
        "ExactDigitCount",
        "The digit {value} must appear exactly {count} times in {cells}.",
        [
          ["value", ParamType.Number],
          ["count", ParamType.Number],
          ["cells", ParamType.CellArray],
        ],
      ),
    ],
    ExactDigitCountComponent,
  );
  var getOwnPropDescriptor20 = Object.getOwnPropertyDescriptor,
    applyClassDecorators20 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor20(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  const greaterThanFriendTable = new FriendDigitTable((cacheKey, digit) => {
    let friendMask = 0;
    for (
      let higherDigit = digit + 1;
      higherDigit <= puzzleSpec.maxDigit;
      higherDigit++
    )
      friendMask |= 1 << higherDigit;
    return friendMask;
  }, FriendCacheKeyKind.None);
  let GreaterThanComponent = class extends PairComponent {
    constructor(componentName, lesserCellId, greaterCellId) {
      const friends = greaterThanFriendTable.getFriends();
      (super(componentName, friends, lesserCellId, greaterCellId),
        (this.lesserCellId = lesserCellId),
        (this.greaterCellId = greaterCellId));
    }
    validate({ cells: cells }) {
      const minLesserDigit = smallestDigitInMask(
          cells[this.lesserCellId].candidates,
        ),
        maxGreaterDigit = largestDigitInMask(
          cells[this.greaterCellId].candidates,
        );
      return minLesserDigit < maxGreaterDigit
        ? ValidResult
        : {
            valid: !1,
            message: `unable to make ${sharedHelpers.naming.getCellName(this.lesserCellId)} be less than ${sharedHelpers.naming.getCellName(this.greaterCellId)}`,
          };
    }
  };
  GreaterThanComponent = applyClassDecorators20(
    [
      defineComponent(
        ["GreaterThan", "LessThan"],
        "The digit in {lesserCell} must be less than the one in {greaterCell}",
        [
          ["lesserCell", ParamType.Cell],
          ["greaterCell", ParamType.Cell],
        ],
      ),
    ],
    GreaterThanComponent,
  );
  var getOwnPropDescriptor21 = Object.getOwnPropertyDescriptor,
    applyClassDecorators21 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor21(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  const greaterThanOrEqualsFriendTable = new FriendDigitTable(
    (cacheKey, digit) => {
      let friendMask = 0;
      for (
        let higherDigit = digit;
        higherDigit <= puzzleSpec.maxDigit;
        higherDigit++
      )
        friendMask |= 1 << higherDigit;
      return friendMask;
    },
    FriendCacheKeyKind.None,
  );
  let GreaterThanOrEqualsComponent = class extends PairComponent {
    constructor(componentName, lesserCellId, greaterCellId) {
      const friends = greaterThanOrEqualsFriendTable.getFriends();
      (super(componentName, friends, lesserCellId, greaterCellId),
        (this.lesserCellId = lesserCellId),
        (this.greaterCellId = greaterCellId));
    }
    *initialize(state) {
      state.getCellsCanHaveRepeats(this.cellIds)
        ? yield* super.initialize(state)
        : yield replaceComponentChange(
            new GreaterThanComponent(
              this.name,
              this.lesserCellId,
              this.greaterCellId,
            ),
          );
    }
    validate({ cells: cells }) {
      const lesserValue = cells[this.lesserCellId].value,
        greaterValue = cells[this.greaterCellId].value;
      return lesserValue === void 0 ||
        greaterValue === void 0 ||
        lesserValue <= greaterValue
        ? ValidResult
        : {
            valid: !1,
            message: `unable to make ${sharedHelpers.naming.getCellName(this.lesserCellId)} be less than or equal to ${sharedHelpers.naming.getCellName(this.greaterCellId)}`,
          };
    }
  };
  GreaterThanOrEqualsComponent = applyClassDecorators21(
    [
      defineComponent(
        "GreaterThanOrEquals",
        "The digit in {greaterCell} must be greater than or equal to the one in {lesserCell}",
        [
          ["lesserCell", ParamType.Cell],
          ["greaterCell", ParamType.Cell],
        ],
      ),
    ],
    GreaterThanOrEqualsComponent,
  );
  var getOwnPropDescriptor22 = Object.getOwnPropertyDescriptor,
    applyClassDecorators22 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor22(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let IndexComponent = class extends ConstraintComponent {
    constructor(componentName, valueToIndex, indexerCellId, indexingCellIds) {
      (super(componentName, [indexerCellId, ...indexingCellIds]),
        (this.valueToIndex = valueToIndex),
        (this.indexerCellId = indexerCellId),
        (this.indexingCellIds = indexingCellIds));
    }
    allowRepeats = !0;
    *initialize(state) {
      if (
        ((this.allowRepeats = state.getCellsCanHaveRepeats(
          this.indexingCellIds,
        )),
        !this.allowRepeats)
      ) {
        const indexerPosition = this.indexingCellIds.indexOf(
          this.indexerCellId,
        );
        indexerPosition !== -1 &&
          this.valueToIndex !== indexerPosition + 1 &&
          (yield removeDigitFromCellChange(
            this.valueToIndex,
            this.indexerCellId,
          ));
      }
      yield* super.initialize(state);
    }
    *update(state) {
      (yield* this.updateIndexerCandidates(state),
        yield* this.updateFromIndexer(state),
        state.cells[this.indexerCellId].value &&
          (yield removeComponentChange()));
    }
    *updateIndexerCandidates(state) {
      let indexerMask = 0;
      for (
        let positionIndex = 0;
        positionIndex < this.indexingCellIds.length;
        positionIndex++
      ) {
        const indexDigit = positionIndex + 1,
          indexedCellId = this.indexingCellIds[positionIndex];
        state.cells[indexedCellId].candidates & (1 << this.valueToIndex) &&
          (indexerMask |= 1 << indexDigit);
      }
      yield filterCandidatesAtCellChange(indexerMask, this.indexerCellId);
    }
    *updateFromIndexer(state) {
      if (state.cells[this.indexerCellId].value) {
        const targetPosition = state.cells[this.indexerCellId].value - 1;
        if (targetPosition >= this.indexingCellIds.length) {
          yield abortSolverChange(`impossible to satisfy ${this.name}`);
          return;
        }
        yield filterCandidatesAtCellChange(
          1 << this.valueToIndex,
          this.indexingCellIds[targetPosition],
        );
      }
    }
  };
  IndexComponent = applyClassDecorators22(
    [
      defineComponent(
        "Index",
        "The value of {indexerCell} must be the (1-based) index of an appearance of {valueToIndex} in the sequence of cells {cells}.",
        [
          ["valueToIndex", ParamType.Number],
          ["indexerCell", ParamType.Cell],
          ["cells", ParamType.CellArray],
        ],
      ),
    ],
    IndexComponent,
  );
  var getOwnPropDescriptor23 = Object.getOwnPropertyDescriptor,
    applyClassDecorators23 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor23(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  const maximumDifferenceFriendTable = new FriendDigitTable(
    (maxDifference, digit) => {
      let friendMask = 0;
      const lowestDigit = Math.max(puzzleSpec.minDigit, digit - maxDifference),
        highestDigit = Math.min(puzzleSpec.maxDigit, digit + maxDifference);
      for (
        let candidateDigit = lowestDigit;
        candidateDigit <= highestDigit;
        candidateDigit++
      )
        friendMask |= 1 << candidateDigit;
      return friendMask;
    },
    FriendCacheKeyKind.Number,
  );
  let MaximumDifferenceComponent = class extends PairComponent {
    constructor(componentName, maxDifference, firstCellId, secondCellId) {
      (super(
        componentName,
        maximumDifferenceFriendTable.getFriends(maxDifference),
        firstCellId,
        secondCellId,
      ),
        (this.maxDifference = maxDifference),
        (this.cellId1 = firstCellId),
        (this.cellId2 = secondCellId));
    }
    validate({ cells: cells }) {
      const firstValue = cells[this.cellId1].value,
        secondValue = cells[this.cellId2].value;
      return firstValue === void 0 ||
        secondValue === void 0 ||
        Math.abs(firstValue - secondValue) <= this.maxDifference
        ? ValidResult
        : {
            valid: !1,
            message: `unable to keep a maximum difference of ${this.maxDifference} between cells ${sharedHelpers.naming.getCellsDescription(this.cellIds)}`,
          };
    }
  };
  MaximumDifferenceComponent = applyClassDecorators23(
    [
      defineComponent(
        "MaximumDifference",
        "The difference between the values of {cell1} and {cell2} must be at most {maxDifference}.",
        [
          ["maxDifference", ParamType.Number],
          ["cell1", ParamType.Cell],
          ["cell2", ParamType.Cell],
        ],
      ),
    ],
    MaximumDifferenceComponent,
  );
  var getOwnPropDescriptor24 = Object.getOwnPropertyDescriptor,
    applyClassDecorators24 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor24(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  const minimumDifferenceFriendTable = new FriendDigitTable(
    (minDifference, digit) => {
      let friendMask = 0;
      const maxLowDigit = digit - minDifference,
        minHighDigit = digit + minDifference;
      for (
        let lowDigit = puzzleSpec.minDigit;
        lowDigit <= maxLowDigit;
        lowDigit++
      )
        friendMask |= 1 << lowDigit;
      for (
        let highDigit = minHighDigit;
        highDigit <= puzzleSpec.maxDigit;
        highDigit++
      )
        friendMask |= 1 << highDigit;
      return friendMask;
    },
    FriendCacheKeyKind.Number,
  );
  let MinimumDifferenceComponent = class extends PairComponent {
    constructor(name, minDifference, cellIdA, cellIdB) {
      (super(
        name,
        minimumDifferenceFriendTable.getFriends(minDifference),
        cellIdA,
        cellIdB,
      ),
        (this.minDifference = minDifference),
        (this.cellId1 = cellIdA),
        (this.cellId2 = cellIdB));
    }
    validate({ cells: cells }) {
      const valueA = cells[this.cellId1].value,
        valueB = cells[this.cellId2].value;
      return valueA === void 0 ||
        valueB === void 0 ||
        Math.abs(valueA - valueB) >= this.minDifference
        ? ValidResult
        : {
            valid: !1,
            message: `unable to keep a minimum difference of ${this.minDifference} between cells ${sharedHelpers.naming.getCellsDescription(this.cellIds)}`,
          };
    }
  };
  MinimumDifferenceComponent = applyClassDecorators24(
    [
      defineComponent(
        "MinimumDifference",
        "The difference between the values of {cell1} and {cell2} must be at least {minDifference}.",
        [
          ["minDifference", ParamType.Number],
          ["cell1", ParamType.Cell],
          ["cell2", ParamType.Cell],
        ],
      ),
    ],
    MinimumDifferenceComponent,
  );
  var getOwnPropDescriptor25 = Object.getOwnPropertyDescriptor,
    applyClassDecorators25 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor25(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let NegativeBetweenComponent = class extends ConstraintComponent {
    constructor(name, endPoints, midPoints) {
      (super(name, [...endPoints, ...midPoints]),
        (this.endPoints = endPoints),
        (this.midPoints = midPoints));
    }
    *update(state) {
      const minEndA = smallestDigitInMask(
          state.cells[this.endPoints[0]].candidates,
        ),
        maxEndA = largestDigitInMask(state.cells[this.endPoints[0]].candidates),
        minEndB = smallestDigitInMask(
          state.cells[this.endPoints[1]].candidates,
        ),
        maxEndB = largestDigitInMask(state.cells[this.endPoints[1]].candidates);
      if (!(maxEndA >= minEndB && maxEndB >= minEndA)) {
        const excludedDigits =
          maxEndA < minEndB
            ? iterateRangeInclusive(maxEndA + 1, minEndB - 1)
            : iterateRangeInclusive(maxEndB + 1, minEndA - 1);
        yield removeCandidatesFromCellsChange(
          toDigitMask(excludedDigits),
          this.midPoints,
        );
      }
      for (const midCellId of this.midPoints) {
        const midValue = state.cells[midCellId].value;
        midValue !== void 0 &&
          (midValue > maxEndA &&
            (yield filterCandidatesAtCellChange(
              toDigitMask(iterateRangeInclusive(puzzleSpec.minDigit, midValue)),
              this.endPoints[1],
            )),
          midValue > maxEndB &&
            (yield filterCandidatesAtCellChange(
              toDigitMask(iterateRangeInclusive(puzzleSpec.minDigit, midValue)),
              this.endPoints[0],
            )),
          midValue < minEndA &&
            (yield filterCandidatesAtCellChange(
              toDigitMask(iterateRangeInclusive(midValue, puzzleSpec.maxDigit)),
              this.endPoints[1],
            )),
          midValue < minEndB &&
            (yield filterCandidatesAtCellChange(
              toDigitMask(iterateRangeInclusive(midValue, puzzleSpec.maxDigit)),
              this.endPoints[0],
            )));
      }
    }
    getIsDone({ cells: cells }) {
      return (
        cells[this.endPoints[0]].value !== void 0 &&
        cells[this.endPoints[1]].value !== void 0
      );
    }
  };
  NegativeBetweenComponent = applyClassDecorators25(
    [
      defineComponent(
        "NegativeBetween",
        "The digits on all {midPoints} must not be between the digits on the {endPoints}.",
        [
          ["endPoints", { type: ParamType.CellArray, amount: 2 }],
          ["midPoints", ParamType.CellArray],
        ],
      ),
    ],
    NegativeBetweenComponent,
  );
  var getOwnPropDescriptor26 = Object.getOwnPropertyDescriptor,
    applyClassDecorators26 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor26(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  const negativeDifferenceFriendTable = new FriendDigitTable(
    (differences, digit) => {
      const allowedDigits = sharedHelpers.digits.createFullDigitSet();
      for (const difference of differences)
        (allowedDigits.delete(digit + difference),
          allowedDigits.delete(digit - difference));
      return allowedDigits.valueOf();
    },
    FriendCacheKeyKind.Numbers,
  );
  let NegativeDifferenceComponent = class extends PairComponent {
    differences;
    constructor(name, differences, cellIdA, cellIdB) {
      (super(
        name,
        negativeDifferenceFriendTable.getFriends(differences),
        cellIdA,
        cellIdB,
      ),
        (this.differences = differences));
    }
    validate({ cells: cells }) {
      const valueA = cells[this.cellId1].value,
        valueB = cells[this.cellId2].value;
      if (valueA === void 0 || valueB === void 0) return ValidResult;
      for (const difference of this.differences)
        if (Math.abs(valueA - valueB) === difference)
          return {
            valid: !1,
            message: `${sharedHelpers.naming.getCellsDescription(this.cellIds)} are ${difference} different, which is not allowed`,
          };
      return ValidResult;
    }
  };
  NegativeDifferenceComponent = applyClassDecorators26(
    [
      defineComponent(
        "NegativeDifference",
        "The difference between the values of {cell1} and {cell2} must not be any of {differences}.",
        [
          ["differences", ParamType.NumberArray],
          ["cell1", ParamType.Cell],
          ["cell2", ParamType.Cell],
        ],
      ),
    ],
    NegativeDifferenceComponent,
  );
  var getOwnPropDescriptor27 = Object.getOwnPropertyDescriptor,
    applyClassDecorators27 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor27(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let NegativeIndexComponent = class extends ConstraintComponent {
    constructor(name, valueToNotIndex, indexerCellId, indexingCells) {
      (super(name, [indexerCellId, ...indexingCells]),
        (this.valueToNotIndex = valueToNotIndex),
        (this.indexerCellId = indexerCellId),
        (this.indexingCells = indexingCells));
    }
    *onValueSet(state, setCellId, setValue) {
      if (setCellId === this.indexerCellId)
        (this.indexingCells.length >= setValue &&
          (yield removeDigitFromCellChange(
            this.valueToNotIndex,
            this.indexingCells[setValue - 1],
          )),
          yield removeComponentChange());
      else if (setValue === this.valueToNotIndex) {
        const indexPosition = this.indexingCells.indexOf(setCellId) + 1;
        yield removeDigitFromCellChange(indexPosition, this.indexerCellId);
      }
    }
  };
  NegativeIndexComponent = applyClassDecorators27(
    [
      defineComponent(
        "NegativeIndex",
        "The value of {indexerCell} must **not** be the (1-based) index of {valueToNotIndex} in the sequence of cells {cells}.",
        [
          ["valueToNotIndex", ParamType.Number],
          ["indexerCell", ParamType.Cell],
          ["cells", ParamType.CellArray],
        ],
      ),
    ],
    NegativeIndexComponent,
  );
  var getOwnPropDescriptor28 = Object.getOwnPropertyDescriptor,
    applyClassDecorators28 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor28(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  const negativeRatioFriendTable = new FriendDigitTable((ratios, digit) => {
    const allowedDigits = sharedHelpers.digits.createFullDigitSet();
    for (const ratio of ratios)
      (digit % ratio === 0 && allowedDigits.delete(digit / ratio),
        digit * ratio <= puzzleSpec.maxDigit &&
          allowedDigits.delete(digit * ratio));
    return allowedDigits.valueOf();
  }, FriendCacheKeyKind.Numbers);
  let NegativeRatioComponent = class extends PairComponent {
    ratios;
    constructor(name, ratios, cellIdA, cellIdB) {
      ((ratios = ensureArray(ratios)),
        super(
          name,
          negativeRatioFriendTable.getFriends(ratios),
          cellIdA,
          cellIdB,
        ),
        (this.ratios = ratios));
    }
    validate({ cells: cells }) {
      const valueA = cells[this.cellId1].value,
        valueB = cells[this.cellId2].value;
      if (valueA === void 0 || valueB === void 0) return ValidResult;
      for (const ratio of this.ratios)
        if (valueA * ratio === valueB || valueB * ratio === valueA)
          return {
            valid: !1,
            message: `${sharedHelpers.naming.getCellsDescription(this.cellIds)} form a disallowed ratio of 1 : ${ratio}`,
          };
      return ValidResult;
    }
  };
  NegativeRatioComponent = applyClassDecorators28(
    [
      defineComponent(
        "NegativeRatio",
        "The ratio of the values of {cell1} and {cell2} (either way) must not be any of {ratios}.",
        [
          ["ratios", ParamType.NumberArray],
          ["cell1", ParamType.Cell],
          ["cell2", ParamType.Cell],
        ],
      ),
    ],
    NegativeRatioComponent,
  );
  class NegativeSumGroupComponent extends ConstraintComponent {
    sums;
    constructor(name, sums, cellIdList) {
      (super(name, cellIdList), (this.sums = sums));
    }
    get validateDuringSolve() {
      return !0;
    }
    validate({ cells: cells }) {
      if (!this.cellIds.every((cellId) => cells[cellId].value !== void 0))
        return ValidResult;
      let total = 0;
      for (const sumCellId of this.cellIds) total += cells[sumCellId].value;
      return this.sums.includes(total)
        ? {
            valid: !1,
            message: `${sharedHelpers.naming.getCellsDescription(this.cellIds)} must not sum to ${total}`,
          }
        : ValidResult;
    }
  }
  const negativeSumFriendTable = new FriendDigitTable((sums, digit) => {
    const allowedDigits = sharedHelpers.digits.createFullDigitSet();
    for (const sum of sums) sum >= digit && allowedDigits.delete(sum - digit);
    return allowedDigits.valueOf();
  }, FriendCacheKeyKind.Numbers);
  class NegativeSumPairComponent extends PairComponent {
    sums;
    constructor(name, sums, cellIdA, cellIdB) {
      (super(name, negativeSumFriendTable.getFriends(sums), cellIdA, cellIdB),
        (this.sums = sums));
    }
    validate({ cells: cells }) {
      const valueA = cells[this.cellId1].value,
        valueB = cells[this.cellId2].value;
      if (valueA === void 0 || valueB === void 0) return ValidResult;
      for (const sum of this.sums)
        if (valueA + valueB === sum)
          return {
            valid: !1,
            message: `${sharedHelpers.naming.getCellsDescription(this.cellIds)} must not sum to ${sum}`,
          };
      return ValidResult;
    }
  }
  var getOwnPropDescriptor29 = Object.getOwnPropertyDescriptor,
    applyClassDecorators29 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor29(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let NegativeSumComponent = class extends CompositeComponent {
    constructor(name, sums, cellIdList) {
      super(name, cellIdList, () =>
        cellIdList.length === 2
          ? new NegativeSumPairComponent(
              name,
              sums,
              cellIdList[0],
              cellIdList[1],
            )
          : new NegativeSumGroupComponent(name, sums, cellIdList),
      );
    }
  };
  NegativeSumComponent = applyClassDecorators29(
    [
      defineComponent(
        "NegativeSum",
        "The digits within {cells} must not sum to any of {sums}.",
        [
          ["sums", ParamType.NumberArray],
          ["cells", ParamType.CellArray],
        ],
      ),
    ],
    NegativeSumComponent,
  );
  class SingleProductComponent extends ConstraintComponent {
    product;
    constructor(name, product, cellIdList) {
      (super(name, cellIdList), (this.product = product));
    }
    *update(state) {
      const { cellIds: cellIdList, product: targetProduct } = this;
      let remainingProduct = targetProduct,
        minProduct = 1,
        maxProduct = 1;
      for (const filledCellId of cellIdList) {
        const filledValue = state.cells[filledCellId].value;
        if (filledValue !== void 0) {
          if (remainingProduct % filledValue !== 0) {
            yield abortSolverChange(
              `cannot satisfy ${this.name}`,
              this.cellIds,
            );
            return;
          }
          ((remainingProduct /= filledValue),
            (minProduct *= filledValue),
            (maxProduct = minProduct));
        }
      }
      const divisorDigits = sharedHelpers.digits.createFilteredDigitSet(
        (candidateDigit) => remainingProduct % candidateDigit === 0,
      );
      for (const openCellId of cellIdList) {
        if (state.cells[openCellId].value !== void 0) continue;
        let candidates = state.cells[openCellId].candidates;
        if (
          ((candidates &= +divisorDigits),
          yield filterCandidatesAtCellChange(candidates, openCellId),
          (minProduct *= smallestDigitInMask(candidates)),
          (maxProduct *= largestDigitInMask(candidates)),
          minProduct > targetProduct)
        ) {
          yield abortSolverChange(
            `${this.name} has a product of at least ${minProduct}`,
            this.cellIds,
          );
          return;
        }
      }
      maxProduct < targetProduct &&
        (yield abortSolverChange(
          `${this.name} has a product of at most ${maxProduct}`,
          this.cellIds,
        ));
    }
  }
  var getOwnPropDescriptor30 = Object.getOwnPropertyDescriptor,
    applyClassDecorators30 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor30(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let ProductComponent = class extends CompositeComponent {
    constructor(name, productOrProducts, cellIdList) {
      (super(name, cellIdList, () =>
        Array.isArray(productOrProducts)
          ? new MultiProductComponent(name, productOrProducts, cellIdList)
          : productOrProducts > 0
            ? new SingleProductComponent(name, productOrProducts, cellIdList)
            : new RequiredDigitsComponent(name, [0], cellIdList),
      ),
        (this.name = name),
        (this.productOrProducts = productOrProducts),
        (this.cellIds = cellIdList));
    }
  };
  ProductComponent = applyClassDecorators30(
    [
      defineComponent(
        "Product",
        "The product of the digits in {cells} must equal to {productOrProducts}.",
        [
          ["productOrProducts", ParamType.NumberOrNumberArray],
          ["cells", ParamType.CellArray],
        ],
      ),
    ],
    ProductComponent,
  );
  class MultiProductComponent extends ConstraintComponent {
    products;
    constructor(name, products, cellIdList) {
      (super(name, cellIdList), (this.products = products));
    }
    get validateDuringSolve() {
      return !0;
    }
    *initialize() {
      const allowedDigits = new SudokuDigitSet();
      allowedDigits.add(1);
      for (const product of this.products)
        for (
          let digit = puzzleSpec.minDigit;
          digit <= puzzleSpec.maxDigit;
          digit++
        )
          (product === 0 || product % digit === 0) && allowedDigits.add(digit);
      yield filterCandidatesAtCellsChange(+allowedDigits, this.cellIds);
    }
    validate({ cells: cells }) {
      if (!this.cellIds.every((cellId) => cells[cellId].value !== void 0))
        return ValidResult;
      let productTotal = 1;
      for (const productCellId of this.cellIds)
        productTotal *= cells[productCellId].value;
      return this.products.includes(productTotal)
        ? ValidResult
        : {
            valid: !1,
            message: `the product of ${sharedHelpers.naming.getCellsDescription(this.cellIds)} is ${productTotal} and is not allowed`,
          };
    }
  }
  var getOwnPropDescriptor31 = Object.getOwnPropertyDescriptor,
    applyClassDecorators31 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor31(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let SameDigitComponent = class extends ConstraintComponent {
    constructor(name, cellIdList) {
      super(name, cellIdList);
    }
    *initialize(state) {
      if (!this.validateConfiguration(state)) {
        yield abortSolverChange(
          `check ${this.name} - one or more cloned cells are seeing each other`,
          this.cellIds,
        );
        return;
      }
      const solvedCellId = this.cellIds.find(
        (cellId) => state.cells[cellId].value !== void 0,
      );
      solvedCellId !== void 0
        ? yield* this.onValueSet(
            state,
            solvedCellId,
            state.cells[solvedCellId].value,
          )
        : yield* this.update(state);
    }
    *onValueSet(state, setCellId, setValue) {
      for (const otherCellId of this.cellIds)
        otherCellId !== setCellId &&
          (yield setValueChange(setValue, otherCellId));
    }
    *update(state) {
      let sharedCandidates = allDigitsMask;
      for (const cellId of this.cellIds)
        sharedCandidates &= state.cells[cellId].candidates;
      yield filterCandidatesAtCellsChange(sharedCandidates, this.cellIds);
    }
    validate({ cells: cells }) {
      const filledCellIds = this.cellIds.filter(
        (cellId) => cells[cellId].value !== void 0,
      );
      if (filledCellIds.length === 0) return ValidResult;
      const firstCellId = filledCellIds[0],
        firstValue = cells[firstCellId].value,
        mismatchCellId = filledCellIds.find(
          (filledCellId) => cells[filledCellId].value !== firstValue,
        );
      return mismatchCellId !== void 0
        ? {
            valid: !1,
            message: `${sharedHelpers.naming.getCellName(mismatchCellId)} must have the same value as ${sharedHelpers.naming.getCellName(firstCellId)}, but it does not`,
          }
        : ValidResult;
    }
    validateConfiguration(state) {
      const seenCells = state.getCellsSeenByCell(this.cellIds[0]);
      return (
        this.cellIds.filter((cellId) => seenCells.has(cellId)).length === 0
      );
    }
  };
  SameDigitComponent = applyClassDecorators31(
    [
      defineComponent(
        "SameDigit",
        "Every cell of {cells} must have the same value.",
        [["cells", ParamType.CellArray]],
      ),
    ],
    SameDigitComponent,
  );
  var getOwnPropDescriptor32 = Object.getOwnPropertyDescriptor,
    applyClassDecorators32 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor32(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let SameGroupComponent = class extends ConstraintComponent {
    groups;
    constructor(name, groups, cellIdList) {
      (super(name, cellIdList), (this.groups = groups.map((group) => +group)));
    }
    *update({ cells: cells }) {
      const remainingGroups = new Set(this.groups);
      for (const cellId of this.cellIds) {
        const candidates = cells[cellId].candidates;
        for (const groupMask of remainingGroups)
          (candidates & groupMask) === 0 && remainingGroups.delete(groupMask);
      }
      let allowedMask = 0;
      for (const remainingGroupMask of remainingGroups)
        allowedMask |= remainingGroupMask;
      yield filterCandidatesAtCellsChange(allowedMask, this.cellIds);
    }
  };
  SameGroupComponent = applyClassDecorators32(
    [
      defineComponent(
        "SameGroup",
        `Every cell of {cells} must have a digit from the same group within {groups}. E.g. if the groups are the evens and the odds, then either every cell is even, or every cell is odd. 
**Note:** currently only works properly when the groups do not overlap.`,
        [
          ["groups", ParamType.DigitSetArray],
          ["cells", ParamType.CellArray],
        ],
      ),
    ],
    SameGroupComponent,
  );
  class WeightedSumCandidateUpdater {
    constructor(state, minimumSum, maximumSum, cellIdsAndWeights) {
      ((this.state = state),
        (this.minimumSum = minimumSum),
        (this.maximumSum = maximumSum),
        (this.cellIdsAndWeights = cellIdsAndWeights));
    }
    *updateCandidates() {
      const {
        state: state,
        minimumSum: minimumSum,
        maximumSum: maximumSum,
        cellIdsAndWeights: cellIdsAndWeights,
      } = this;
      let remainingMinSum = minimumSum,
        remainingMaxSum = maximumSum;
      const openCellWeights = new Map(cellIdsAndWeights);
      for (const [knownCellId, knownWeight] of cellIdsAndWeights) {
        const knownValue = state.cells[knownCellId].value;
        knownValue !== void 0 &&
          ((remainingMinSum -= knownValue * knownWeight),
          (remainingMaxSum -= knownValue * knownWeight),
          openCellWeights.delete(knownCellId));
      }
      for (const [cellId, weight] of openCellWeights) {
        const cell = state.cells[cellId],
          minOtherSum = this.getMinSum(state, openCellWeights, cellId),
          maxOtherSum = this.getMaxSum(state, openCellWeights, cellId);
        let removedMask = 0;
        for (const digit of digitsInMask(cell.candidates))
          (minOtherSum + digit * weight > remainingMaxSum ||
            maxOtherSum + digit * weight < remainingMinSum) &&
            (removedMask |= 1 << digit);
        yield removeCandidatesFromCellChange(removedMask, cellId);
      }
    }
    getMinSum({ cells: cells }, cellWeights, excludedCellId) {
      let minSum = 0;
      for (const [otherCellId, otherWeight] of cellWeights) {
        if (otherCellId === excludedCellId) continue;
        const otherCell = cells[otherCellId];
        minSum +=
          (otherCell.value ??
            (smallestDigitInMask(otherCell.candidates) || 0)) * otherWeight;
      }
      return minSum;
    }
    getMaxSum(state, cellWeights, excludedCellId) {
      let maxSum = 0;
      for (const [otherCellId, otherWeight] of cellWeights) {
        if (otherCellId === excludedCellId) continue;
        const otherCell = state.cells[otherCellId];
        maxSum +=
          (otherCell.value ?? (largestDigitInMask(otherCell.candidates) || 0)) *
          otherWeight;
      }
      return maxSum;
    }
  }
  const sumPairDistinctFriendTable = new FriendDigitTable((sums, digit) => {
      let friendMask = 0;
      for (const sum of sums) {
        const partnerDigit = sum - digit;
        partnerDigit !== digit &&
          partnerDigit <= puzzleSpec.maxDigit &&
          partnerDigit >= puzzleSpec.minDigit &&
          (friendMask |= 1 << partnerDigit);
      }
      return friendMask;
    }, FriendCacheKeyKind.Number),
    sumPairRepeatFriendTable = new FriendDigitTable((sums, digit) => {
      let friendMask = 0;
      for (const sum of sums) {
        const partnerDigit = sum - digit;
        partnerDigit <= puzzleSpec.maxDigit &&
          partnerDigit >= puzzleSpec.minDigit &&
          (friendMask |= 1 << partnerDigit);
      }
      return friendMask;
    }, FriendCacheKeyKind.Number);
  class SumPairComponent extends PairComponent {
    sums;
    constructor(name, sums, allowRepeats, cellIdA, cellIdB) {
      const friendDigits = allowRepeats
        ? sumPairRepeatFriendTable.getFriends(sums)
        : sumPairDistinctFriendTable.getFriends(sums);
      (super(name, friendDigits, cellIdA, cellIdB), (this.sums = sums));
    }
    validate({ cells: cells }) {
      const valueA = cells[this.cellId1].value,
        valueB = cells[this.cellId2].value;
      return valueA === void 0 ||
        valueB === void 0 ||
        this.sums.includes(valueA + valueB)
        ? ValidResult
        : {
            valid: !1,
            message: `unable to make ${sharedHelpers.naming.getCellsDescription(this.cellIds)} sum to ${joinWithConjunction(this.sums, "or")}`,
          };
    }
  }
  var getOwnPropDescriptor33 = Object.getOwnPropertyDescriptor,
    applyClassDecorators33 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor33(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let WeightedSumComponent = class extends ConstraintComponent {
    sums;
    cellWeightPairs;
    sumsDescription;
    minSum;
    maxSum;
    get validateDuringSolve() {
      return !0;
    }
    constructor(name, sumOrSums, cellWeightMapping) {
      (super(name, Array.from(cellWeightMapping.keys())),
        (this.sums = ensureArray(sumOrSums)),
        (this.cellWeightPairs = cellWeightMapping),
        (this.sumsDescription = joinWithConjunction(this.sums, "or")),
        (this.minSum = Math.min(...this.sums)),
        (this.maxSum = Math.max(...this.sums)));
    }
    *update(state) {
      yield* new WeightedSumCandidateUpdater(
        state,
        this.minSum,
        this.maxSum,
        this.cellWeightPairs,
      ).updateCandidates();
    }
    validate(state) {
      let total = 0;
      for (let index = 0; index < this.cellIds.length; index++) {
        const value = state.cells[this.cellIds[index]].value;
        if (value === void 0) return ValidResult;
        total += value * this.cellWeightPairs.get(this.cellIds[index]);
      }
      return this.sums.includes(total)
        ? ValidResult
        : {
            valid: !1,
            message: `${this.name} cannot sum to ${this.sumsDescription}`,
          };
    }
  };
  WeightedSumComponent = applyClassDecorators33(
    [
      defineComponent(
        "WeightedSum",
        `The sums of every value of cell X in {cellWeightMapping}, multiplied by {cellWeightMapping.get(X)}, must sum to (one of) {sumOrSums}.
**Note:** Currently only supports **positive** weights. To avoid floating point inaccuracies breaking this component, use whole numbers as weights. In case you want to do something like x+y/3=5, multiply it all such that you get 3x+y=15`,
        [
          ["sumOrSums", ParamType.NumberOrNumberArray],
          ["cellWeightMapping", "Map<CellId, number>"],
        ],
      ),
    ],
    WeightedSumComponent,
  );
  var getOwnPropDescriptor34 = Object.getOwnPropertyDescriptor,
    applyClassDecorators34 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var result =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor34(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (result = decorator(result) || result);
      return result;
    };
  let SumComponent = class extends CompositeComponent {
    constructor(name, sumOrSums, cells) {
      super(name, cells, (puzzle) => {
        if (((sumOrSums = ensureArray(sumOrSums)), hasDuplicates(cells))) {
          const occurrenceCounts = countOccurrencesByValue(cells),
            uniqueCells = withoutDuplicates(cells);
          return new WeightedSumComponent(
            name,
            sumOrSums,
            new Map(
              uniqueCells.map((uniqueCell) => [
                uniqueCell,
                occurrenceCounts.get(uniqueCell),
              ]),
            ),
          );
        }
        if (this.cellIds.length === 1)
          return new PredefinedCandidatesComponent(
            name,
            SudokuDigitSet.from(sumOrSums),
            cells,
          );
        const allowRepeats = !puzzle.getCellsSeeEachOther(cells);
        if (this.cellIds.length === 2)
          return new SumPairComponent(
            name,
            sumOrSums,
            allowRepeats,
            cells[0],
            cells[1],
          );
        const {
          min: minSum,
          max: maxSum,
          range: isContiguousRange,
        } = describeSumsAsContiguousRange(sumOrSums);
        return isContiguousRange
          ? new SumRangeComponent(name, minSum, maxSum, cells, allowRepeats)
          : new ExactSumComponent(name, sumOrSums, cells, allowRepeats);
      });
    }
  };
  SumComponent = applyClassDecorators34(
    [
      defineComponent(
        "Sum",
        "The digits in {cells} must sum to (one of) {sumOrSums}. If a cell appears N times in {cells}, the value in that cell is counted N times.",
        [
          ["sumOrSums", ParamType.NumberOrNumberArray],
          ["cells", ParamType.CellArray],
        ],
      ),
    ],
    SumComponent,
  );
  function describeSumsAsContiguousRange(sums) {
    const minSum = Math.min(...sums),
      maxSum = Math.max(...sums),
      sumSet = new Set(sums);
    for (let sumInRange = minSum; sumInRange <= maxSum; sumInRange++)
      if (!sumSet.has(sumInRange)) return { range: !1 };
    return { range: !0, min: minSum, max: maxSum };
  }
  var getOwnPropDescriptor35 = Object.getOwnPropertyDescriptor,
    applyClassDecorators35 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var descriptor =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor35(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (descriptor = decorator(descriptor) || descriptor);
      return descriptor;
    };
  let SameSumComponent = class extends ConstraintComponent {
    groups;
    constructor(name, groups) {
      (super(name, [...new Set(groups.map((group) => group.cells).flat())]),
        (this.groups = groups.map(normalizeSameSumGroup)));
    }
    get validateDuringSolve() {
      return !0;
    }
    *initialize(puzzleForInit) {
      for (const groupToInit of this.groups)
        "allowRepeats" in groupToInit.properties &&
          (groupToInit.properties.allowRepeats =
            !puzzleForInit.getCellsSeeEachOther(groupToInit.cells));
      yield* super.initialize(puzzleForInit);
    }
    *update(puzzle) {
      let maxOfMinimums = 0,
        minOfMaximums = 1 / 0;
      for (const group of this.groups) {
        const extremes = this.getExtremeValuesForGroup(puzzle, group);
        if (extremes === null) {
          yield abortSolverChange(
            `${group.name} has at least one repeated digit`,
            group.cells,
          );
          return;
        }
        const { minimum: minimum, maximum: maximum } = extremes;
        ((maxOfMinimums = Math.max(maxOfMinimums, minimum)),
          (minOfMaximums = Math.min(minOfMaximums, maximum)));
      }
      if (minOfMaximums === maxOfMinimums)
        yield* this.replaceWithSumConstraintComponents(puzzle, minOfMaximums);
      else if (maxOfMinimums <= minOfMaximums)
        for (const groupToRestrict of this.groups)
          yield* this.restrictGroup(
            puzzle,
            groupToRestrict,
            maxOfMinimums,
            minOfMaximums,
          );
      else
        yield abortSolverChange(
          `it’s not possible to satisfy equal sums for ${this.name}`,
          this.groups.flatMap((groupForCells) => groupForCells.cells),
        );
    }
    *replaceWithSumConstraintComponents(puzzle, sum) {
      const replacementComponents = [];
      for (const group of this.groups)
        if (
          !group.cells.every(
            (groupCellId) => puzzle.cells[groupCellId].value !== void 0,
          )
        )
          if (group.properties.type === "asNumber")
            yield* this.setNumberGroup(sum, group);
          else if (group.cells.length === 1) {
            const cellWeight =
              group.properties.type === "weighted"
                ? group.properties.weights.get(group.cells[0])
                : 1;
            if (sum % cellWeight !== 0) {
              yield abortSolverChange(
                `${sum / cellWeight} is not a valid digit`,
                group.cells,
              );
              return;
            }
            yield keepOnlyDigitAtCell(sum / cellWeight, group.cells[0]);
          } else
            group.properties.type === "weighted"
              ? replacementComponents.push(
                  new WeightedSumComponent(
                    group.name,
                    sum,
                    group.properties.weights,
                  ),
                )
              : replacementComponents.push(
                  new SumComponent(group.name, sum, group.cells),
                );
      yield replaceComponentChange(replacementComponents);
    }
    *setNumberGroup(numberValue, group) {
      for (const digitCellId of group.cells)
        (yield keepOnlyDigitAtCell(numberValue % 10, digitCellId),
          (numberValue = Math.floor(numberValue / 10)));
    }
    validate(puzzle) {
      let maxOfMinimums = 0,
        minOfMaximums = 1 / 0;
      for (const group of this.groups) {
        const extremes = this.getExtremeValuesForGroup(puzzle, group);
        if (extremes === null)
          return { valid: !1, message: `${group.name} has no values` };
        const { minimum: minimum, maximum: maximum } = extremes;
        ((maxOfMinimums = Math.max(maxOfMinimums, minimum)),
          (minOfMaximums = Math.min(minOfMaximums, maximum)));
      }
      return maxOfMinimums > minOfMaximums
        ? {
            valid: !1,
            message: `it’s not possible to satisfy equal sums for ${this.name}`,
          }
        : ValidResult;
    }
    getExtremeValuesForGroup(puzzle, group) {
      if (group.properties.type === "asNumber")
        return this.getExtremeValuesForNumberGroup(puzzle, group);
      {
        const weights =
          group.properties.type === "weighted"
            ? group.cells.map((weightCellId) =>
                group.properties.weights.get(weightCellId),
              )
            : void 0;
        if (group.properties.allowRepeats) {
          const extremesWithRepeat =
            sharedHelpers.sums.getExtremeSumsWithRepeat(
              group.cells.map(
                (cellIdWithRepeat) => puzzle.cells[cellIdWithRepeat].candidates,
              ),
              weights,
            );
          return {
            minimum: extremesWithRepeat.minSum,
            maximum: extremesWithRepeat.maxSum,
          };
        } else {
          const extremesWithoutRepeat =
            sharedHelpers.sums.getExtremeSumsWithoutRepeat(
              group.cells.map(
                (cellIdWithoutRepeat) =>
                  puzzle.cells[cellIdWithoutRepeat].candidates,
              ),
              weights,
            );
          return extremesWithoutRepeat === null
            ? null
            : {
                minimum: extremesWithoutRepeat.minSum,
                maximum: extremesWithoutRepeat.maxSum,
              };
        }
      }
    }
    getExtremeValuesForNumberGroup(puzzle, group) {
      let minimumValue = 0,
        maximumValue = 0;
      for (let digitIndex = 0; digitIndex < group.cells.length; digitIndex++) {
        const placeValue = 10 ** digitIndex,
          cellState = puzzle.cells[group.cells[digitIndex]],
          smallestDigit = smallestDigitInMask(cellState.candidates),
          largestDigit = largestDigitInMask(cellState.candidates);
        ((minimumValue += smallestDigit * placeValue),
          (maximumValue += largestDigit * placeValue));
      }
      return { minimum: minimumValue, maximum: maximumValue };
    }
    *restrictGroup(puzzle, group, minSum, maxSum) {
      if (group.properties.type === "asNumber")
        for (
          let digitIndex = group.cells.length - 1;
          digitIndex >= 0;
          digitIndex--
        ) {
          let lowestDigit, highestDigit;
          if (digitIndex === group.cells.length - 1) {
            const placeValue = 10 ** digitIndex;
            ((lowestDigit = Math.floor(minSum / placeValue)),
              (highestDigit = Math.floor(maxSum / placeValue)));
          } else
            ((lowestDigit = puzzleSpec.minDigit),
              (highestDigit = puzzleSpec.maxDigit));
          let digitMask = 0;
          for (let digit = lowestDigit; digit <= highestDigit; digit++)
            digitMask |= 1 << digit;
          yield filterCandidatesAtCellChange(
            digitMask,
            group.cells[digitIndex],
          );
        }
      else
        group.properties.type === "weighted"
          ? yield* new WeightedSumCandidateUpdater(
              puzzle,
              minSum,
              maxSum,
              group.properties.weights,
            ).updateCandidates()
          : yield* new SumCandidateUpdater(
              puzzle,
              minSum,
              maxSum,
              group.cells,
              group.name,
            ).updateCandidates(group.properties.allowRepeats);
    }
  };
  SameSumComponent = applyClassDecorators35(
    [
      defineComponent(
        "SameSum",
        "Every group of cells from {groups} must sum to the same value. Set {asNumber} to true, to interpret that group as a sequence that spells out a number (e.g. for arrows), where the least significant digit is at index 0. Use {weights} to set a custom weight for specific cells (see **WeightedSumComponent** for details)",
        [
          [
            "groups",
            {
              type: ParamType.ObjectArray,
              fields: {
                name: ParamType.String,
                cells: ParamType.CellArray,
                "weights?": "Map<CellId, number>",
                "asNumber?": ParamType.Boolean,
              },
            },
          ],
        ],
      ),
    ],
    SameSumComponent,
  );
  function normalizeSameSumGroup(group) {
    if (group.weights) {
      const weightedCells = withoutDuplicates(group.cells);
      return {
        name: group.name,
        cells: weightedCells,
        properties: {
          type: "weighted",
          allowRepeats: !0,
          weights: new Map(
            weightedCells.map((weightedCell) => [
              weightedCell,
              group.weights.get(weightedCell) ?? 1,
            ]),
          ),
        },
      };
    } else {
      if (group.asNumber)
        return {
          name: group.name,
          cells: group.cells,
          properties: { type: "asNumber" },
        };
      if (hasDuplicates(group.cells)) {
        const occurrenceCounts = countOccurrencesByValue(group.cells),
          dedupedCells = withoutDuplicates(group.cells);
        return {
          name: group.name,
          cells: dedupedCells,
          properties: {
            type: "weighted",
            allowRepeats: !0,
            weights: new Map(
              dedupedCells.map((dedupedCell) => [
                dedupedCell,
                occurrenceCounts.get(dedupedCell),
              ]),
            ),
          },
        };
      } else
        return {
          name: group.name,
          cells: group.cells,
          properties: { type: "list", allowRepeats: !0 },
        };
    }
  }
  function* iterateSubsetsSummingTo(
    digits,
    targetSum,
    chosenDigits = [],
    currentSum = 0,
  ) {
    if (
      (currentSum === targetSum && (yield chosenDigits),
      !(currentSum >= targetSum))
    )
      for (let digitIndex = 0; digitIndex < digits.length; digitIndex++) {
        const digit = digits[digitIndex],
          remainingDigits = digits.slice(digitIndex + 1);
        yield* iterateSubsetsSummingTo(
          remainingDigits,
          targetSum,
          chosenDigits.concat([digit]),
          currentSum + digit,
        );
      }
  }
  class SandwichSumInnerComponent extends ConstraintComponent {
    sum;
    sandwichDigits;
    combinations = [];
    minDistance;
    maxDistance;
    sandwichDigitsMask = 0;
    constructor(name, sum, sandwichDigits, cells) {
      if (
        (super(name, cells),
        (this.sum = sum),
        (this.sandwichDigits = sandwichDigits),
        this.sum > 0)
      ) {
        const innerDigitSet = sharedHelpers.digits.createFullDigitSet();
        for (const sandwichDigit of sandwichDigits)
          innerDigitSet.delete(sandwichDigit);
        ((this.combinations = [
          ...iterateSubsetsSummingTo([...innerDigitSet], this.sum),
        ]),
          (this.minDistance =
            this.combinations.reduce(
              (shortestLength, combinationForMin) =>
                Math.min(shortestLength, combinationForMin.length),
              1 / 0,
            ) + 1),
          (this.maxDistance =
            this.combinations.reduce(
              (longestLength, combinationForMax) =>
                Math.max(longestLength, combinationForMax.length),
              0,
            ) + 1));
      } else
        ((this.minDistance = 1),
          (this.maxDistance = sharedHelpers.digits.minDigit === 0 ? 2 : 1));
      this.sandwichDigitsMask =
        (1 << this.sandwichDigits[0]) | (1 << this.sandwichDigits[1]);
    }
    *initialize(puzzle) {
      if (this.minDistance === 1 / 0) {
        yield abortSolverChange(
          `${this.name} is impossible to satisfy`,
          this.cellIds,
        );
        return;
      }
      if (this.maxDistance > 1 && this.minDistance > this.cellIds.length / 2) {
        const middleCells = this.cellIds.slice(
          this.cellIds.length - this.minDistance,
          this.minDistance,
        );
        yield removeCandidatesFromCellsChange(
          this.sandwichDigitsMask,
          middleCells,
        );
      }
      yield* this.update(puzzle);
    }
    *update(puzzle) {
      (yield* this.updatePossibleCellsForSandwichDigits(
        puzzle,
        this.sandwichDigits[0],
        this.sandwichDigits[1],
      ),
        yield* this.updatePossibleCellsForSandwichDigits(
          puzzle,
          this.sandwichDigits[1],
          this.sandwichDigits[0],
        ),
        yield* this.updateCandidatesBetweenSandwichDigits(puzzle));
    }
    *updatePossibleCellsForSandwichDigits(puzzle, knownDigit, otherDigit) {
      const anchorIndex = this.cellIds.findIndex(
        (candidateCellId) =>
          puzzle.cells[candidateCellId].candidates === 1 << knownDigit,
      );
      if (anchorIndex === -1) return;
      const outOfRangeCells = [];
      for (let cellIndex = 0; cellIndex < this.cellIds.length; cellIndex++) {
        const distance = Math.abs(cellIndex - anchorIndex);
        (distance < this.minDistance || distance > this.maxDistance) &&
          outOfRangeCells.push(this.cellIds[cellIndex]);
      }
      yield removeDigitFromCellsChange(otherDigit, outOfRangeCells);
    }
    *updateCandidatesBetweenSandwichDigits(puzzle) {
      const sandwichIndices = this.getSandwichIndices(puzzle);
      if (sandwichIndices.length !== 2) return;
      const endpointMask =
        (puzzle.cells[this.cellIds[sandwichIndices[0]]].candidates |
          puzzle.cells[this.cellIds[sandwichIndices[1]]].candidates) &
        this.sandwichDigitsMask;
      if (countCandidatesInMask(endpointMask) !== 2) {
        yield abortSolverChange(
          `${this.name} cannot be satisfied`,
          sandwichIndices.map((sandwichIndex) => this.cellIds[sandwichIndex]),
        );
        return;
      }
      const innerCells = this.cellIds.slice(
        sandwichIndices[0] + 1,
        sandwichIndices[1],
      );
      yield replaceComponentChange(
        new SumComponent(this.name, this.sum, innerCells),
      );
    }
    getSandwichIndices(puzzle) {
      const indices = [];
      for (let cellIndex = 0; cellIndex < this.cellIds.length; cellIndex++) {
        const cellId = this.cellIds[cellIndex];
        (puzzle.cells[cellId].candidates | this.sandwichDigitsMask) ===
          this.sandwichDigitsMask && indices.push(cellIndex);
      }
      return indices;
    }
    validate({ cells: cells }) {
      let sandwichCount = 0,
        sumBetween = 0,
        unknownCount = 0;
      for (let cellIndex = 0; cellIndex < this.cellIds.length; cellIndex++) {
        const cellId = this.cellIds[cellIndex],
          cellValue = cells[cellId].value;
        if (cellValue !== void 0 && this.sandwichDigits.includes(cellValue)) {
          if ((sandwichCount++, sandwichCount === 2)) {
            if (unknownCount === 0 && sumBetween !== this.sum)
              return {
                valid: !1,
                message: `The digits between ${this.sandwichDigits[0]} and ${this.sandwichDigits[1]} for ${this.name} do not sum to ${this.sum}`,
              };
            break;
          }
        } else
          sandwichCount === 1 &&
            (cellValue !== void 0 ? (sumBetween += cellValue) : unknownCount++);
      }
      return ValidResult;
    }
  }
  var getOwnPropDescriptor36 = Object.getOwnPropertyDescriptor,
    applyClassDecorators36 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var descriptor =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor36(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (descriptor = decorator(descriptor) || descriptor);
      return descriptor;
    };
  let SandwichSumComponent = class extends CompositeComponent {
    constructor(name, sum, sandwichDigits, cells) {
      super(name, cells, () => [
        new RequiredDigitsComponent(name, sandwichDigits, cells),
        new SandwichSumInnerComponent(name, sum, sandwichDigits, cells),
      ]);
    }
  };
  SandwichSumComponent = applyClassDecorators36(
    [
      defineComponent(
        "SandwichSum",
        `Along {cells} there must be a sequence of values starting with one of {sandwichDigits}, then some values summing to {sum}, then another digit from {sandwichDigits}. 
**Note:** currently requires all cells to be different.`,
        [
          ["sum", ParamType.Number],
          ["sandwichDigits", { type: ParamType.NumberArray, amount: 2 }],
          ["cells", ParamType.CellArray],
        ],
      ),
    ],
    SandwichSumComponent,
  );
  const StandardHouseTypes = [
    HouseType.Row,
    HouseType.Column,
    HouseType.Region,
  ];
  class SelfCountingStateComponent extends ConstraintComponent {
    state;
    misc;
    constructor(name, cells, initialState, initialMisc) {
      (super(name, cells),
        (this.state = initialState),
        (this.misc = initialMisc));
    }
    *initialize(puzzle) {
      if (!this.state) {
        const houseComponents = [...puzzle.getHouseComponents()];
        let maxCircledCount = 0;
        const circledCellSet = new Set(this.cellIds),
          houseInfoByHouse = new Map();
        for (const house of houseComponents) {
          const circledCells = house.cellIds.filter((circledCandidateCell) =>
              circledCellSet.has(circledCandidateCell),
            ),
            uncircledCells = house.cellIds.filter(
              (uncircledCandidateCell) =>
                !circledCellSet.has(uncircledCandidateCell),
            );
          (houseInfoByHouse.set(house, {
            circled: circledCells,
            uncircled: uncircledCells,
          }),
            (maxCircledCount = Math.max(maxCircledCount, circledCells.length)));
        }
        const requiredComponentsByDigit = [];
        for (
          let digit = puzzleSpec.minDigit;
          digit <= puzzleSpec.maxDigit;
          digit++
        )
          requiredComponentsByDigit[digit] = new RequiredDigitsComponent(
            this.name,
            createFilledArray(digit, digit),
            this.cellIds,
          );
        ((this.misc = {
          initialHouses: houseComponents,
          housesByType: Map.groupBy(
            houseComponents,
            (houseForGrouping) => houseForGrouping.houseType,
          ),
          houseInfo: houseInfoByHouse,
          requiredComponentsFor: (digitSet) =>
            [...digitSet].map(
              (requiredDigit) => requiredComponentsByDigit[requiredDigit],
            ),
        }),
          (this.state = {
            required: new SudokuDigitSet(),
            forbidden: new SudokuDigitSet(),
            housed: new Map(
              StandardHouseTypes.map((houseType) => [
                houseType,
                new SudokuDigitSet(),
              ]),
            ),
            combinations: iterateCombinationsForSum(
              sharedHelpers.digits.createFilteredDigitSet(
                (filterDigit) => filterDigit > 0,
              ),
              this.cellIds.length,
              maxCircledCount,
              puzzleSpec.maxDigit,
            )
              .map((combination) => SudokuDigitSet.from(combination))
              .toArray(),
          }),
          yield* this.houseAnalysis(puzzle));
      }
      yield* this.update(puzzle);
    }
    *update(puzzle) {
      const currentState = this.state,
        misc = this.misc,
        candidatesUnion = this.getCandidatesUnion(puzzle, this.cellIds),
        singletonDigits = this.getSingletons(puzzle, this.cellIds),
        combinationsUnion = SudokuDigitSet.getUnion(currentState.combinations),
        combinationsIntersection = SudokuDigitSet.getIntersection(
          currentState.combinations,
        ),
        missingCandidates = sharedHelpers.digits
          .createFullDigitSet()
          .subtract(candidatesUnion),
        missingFromCombinations = sharedHelpers.digits
          .createFullDigitSet()
          .subtract(combinationsUnion),
        newRequired = singletonDigits.union(combinationsIntersection),
        newForbidden = missingCandidates.union(missingFromCombinations);
      if (
        newRequired.equals(currentState.required) &&
        newForbidden.equals(currentState.forbidden)
      ) {
        yield* this.houseAnalysis(puzzle);
        return;
      }
      (yield removeCandidatesFromCellsChange(+newForbidden, this.cellIds),
        yield replaceComponentChange([
          ...misc.requiredComponentsFor(
            new SudokuDigitSet(newRequired).subtract(currentState.required),
          ),
          this.transitionTo(newRequired, newForbidden, this.state.housed),
        ]));
    }
    *houseAnalysis(puzzle) {
      const {
          housesByType: housesByType,
          houseInfo: houseInfoByHouse,
          initialHouses: initialHouses,
        } = this.misc,
        circledCandidatesByHouse = new Map(),
        uncircledCandidatesByHouse = new Map();
      for (const house of initialHouses)
        (circledCandidatesByHouse.set(
          house,
          this.getCandidatesUnion(puzzle, houseInfoByHouse.get(house).circled),
        ),
          uncircledCandidatesByHouse.set(
            house,
            this.getCandidatesUnion(
              puzzle,
              houseInfoByHouse.get(house).uncircled,
            ),
          ));
      const housedByType = new Map(
          this.state.housed
            .entries()
            .map(([housedHouseType, housedDigits]) => [
              housedHouseType,
              new SudokuDigitSet(housedDigits),
            ]),
        ),
        newComponents = [];
      for (
        let digit = puzzleSpec.minDigit;
        digit <= puzzleSpec.maxDigit;
        digit++
      )
        if (!this.state.forbidden.has(digit))
          for (const houseType of StandardHouseTypes) {
            if (housedByType.get(houseType).has(digit)) continue;
            const housesOfType = housesByType.get(houseType);
            if (housesOfType === void 0) continue;
            if (
              housesOfType.filter((houseForCircledCheck) =>
                circledCandidatesByHouse.get(houseForCircledCheck).has(digit),
              ).length < digit
            ) {
              yield removeDigitFromCellsChange(digit, this.cellIds);
              break;
            }
            const housesRequiringDigit = housesOfType.filter(
                (houseForRequiredCheck) =>
                  !uncircledCandidatesByHouse
                    .get(houseForRequiredCheck)
                    .has(digit),
              ),
              housesWithUncircledDigit = housesOfType.filter(
                (houseForUncircledCheck) =>
                  uncircledCandidatesByHouse
                    .get(houseForUncircledCheck)
                    .has(digit),
              );
            housesRequiringDigit.length === digit &&
              (housedByType.get(houseType).add(digit),
              newComponents.push(
                ...housesRequiringDigit.map(
                  (houseNeedingCircle) =>
                    new RequiredDigitsComponent(
                      `circled ${digit} in ${houseNeedingCircle.name}`,
                      [digit],
                      houseInfoByHouse.get(houseNeedingCircle).circled,
                    ),
                ),
              ),
              yield removeDigitFromCellsChange(
                digit,
                housesWithUncircledDigit.flatMap(
                  (houseWithoutCircle) =>
                    houseInfoByHouse.get(houseWithoutCircle).circled,
                ),
              ));
          }
      newComponents.length > 0 &&
        (yield replaceComponentChange([
          ...newComponents,
          this.transitionTo(
            this.state.required,
            this.state.forbidden,
            housedByType,
          ),
        ]));
    }
    transitionTo(requiredDigits, forbiddenDigits, housedDigitsByType) {
      return new SelfCountingStateComponent(
        this.name,
        this.cellIds,
        {
          required: requiredDigits,
          forbidden: forbiddenDigits,
          housed: housedDigitsByType,
          combinations: this.state.combinations.filter(
            (combination) =>
              combination.isDisjointFrom(forbiddenDigits) &&
              combination.isSupersetOf(requiredDigits),
          ),
        },
        this.misc,
      );
    }
    getCandidatesUnion(puzzle, cellIdsToUnion) {
      const unionSet = new SudokuDigitSet();
      for (const cellId of cellIdsToUnion)
        unionSet.union(puzzle.cells[cellId].candidates);
      return unionSet;
    }
    getSingletons(puzzle, cellIdsToScan) {
      const singletonSet = new SudokuDigitSet();
      for (const cellId of cellIdsToScan)
        isSingleCandidateMask(puzzle.cells[cellId].candidates) &&
          singletonSet.union(puzzle.cells[cellId].candidates);
      return singletonSet;
    }
  }
  var getOwnPropDescriptor37 = Object.getOwnPropertyDescriptor,
    applyClassDecorators37 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var descriptor =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor37(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (descriptor = decorator(descriptor) || descriptor);
      return descriptor;
    };
  let SelfCountingComponent = class extends CompositeComponent {
    constructor(name, cells) {
      super(name, cells, () => {
        const components = [];
        for (const digit of sharedHelpers.digits.createFullDigitSet())
          components.push(
            new MaxDigitCountComponent(this.name, digit, digit, this.cellIds),
          );
        return (
          verboseSolvingEnabled
            ? components.push(new SelfCountingSumComponent(name, cells))
            : components.push(new SelfCountingStateComponent(name, cells)),
          components
        );
      });
    }
  };
  SelfCountingComponent = applyClassDecorators37(
    [
      defineComponent(
        "SelfCounting",
        "A digit X in a cell of {cells} means that digit is in exactly X cells of {cells} in total.",
        [["cells", ParamType.CellArray]],
      ),
    ],
    SelfCountingComponent,
  );
  var getOwnPropDescriptor38 = Object.getOwnPropertyDescriptor,
    applyClassDecorators38 = (
      decorators,
      target,
      propertyKey,
      decoratorKind,
    ) => {
      for (
        var descriptor =
            decoratorKind > 1
              ? void 0
              : decoratorKind
                ? getOwnPropDescriptor38(target, propertyKey)
                : target,
          decoratorIndex = decorators.length - 1,
          decorator;
        decoratorIndex >= 0;
        decoratorIndex--
      )
        (decorator = decorators[decoratorIndex]) &&
          (descriptor = decorator(descriptor) || descriptor);
      return descriptor;
    };
  let SequenceComponent = class extends CompositeComponent {
    constructor(name, cells) {
      super(name, cells, (puzzle) => {
        let minimumDifference = 0;
        for (const cellId of cells)
          for (const seenCellId of puzzle.getCellsSeenByCell(cellId))
            if (cells.includes(seenCellId)) {
              minimumDifference = 1;
              break;
            }
        return new SequenceStepComponent(name, cells, minimumDifference);
      });
    }
  };
  SequenceComponent = applyClassDecorators38(
    [
      defineComponent(
        "Sequence",
        "Digits along {cells} must increase or decrease by the same amount (or stay the same)",
        [["cells", ParamType.CellArray]],
      ),
    ],
    SequenceComponent,
  );
  class SequenceStepComponent extends ConstraintComponent {
    minimumDifference;
    constructor(name, cells, minimumDifference = 1) {
      (super(name, cells), (this.minimumDifference = minimumDifference));
    }
    *update(puzzle) {
      if (this.cellIds.length <= 2) return;
      const forwardMasks = this.getValidValuesForDirection(puzzle, !1),
        reverseMasks = this.getValidValuesForDirection(puzzle, !0);
      for (let cellIndex = 0; cellIndex < this.cellIds.length; cellIndex++)
        yield filterCandidatesAtCellChange(
          forwardMasks[cellIndex] | reverseMasks[cellIndex],
          this.cellIds[cellIndex],
        );
    }
    getValidValuesForDirection(puzzle, reversed = !1) {
      const startCellId = this.cellIds.at(reversed ? -1 : 0),
        endCellId = this.cellIds.at(reversed ? 0 : -1),
        startCandidates = puzzle.cells[startCellId].candidates,
        endCandidates = puzzle.cells[endCellId].candidates,
        maxSpan =
          largestDigitInMask(endCandidates) -
          smallestDigitInMask(startCandidates),
        resultMasks = this.cellIds.map(() => 0);
      if (maxSpan < 0) return [];
      const maxStep = Math.floor(maxSpan / (this.cellIds.length - 1)),
        stepOptions = [
          ...iterateRangeInclusive(this.minimumDifference, maxStep),
        ],
        sequenceDigits = Array.from(this.cellIds, (unusedSlot) => 0);
      for (const startDigit of digitsInMask(startCandidates)) {
        sequenceDigits[reversed ? this.cellIds.length - 1 : 0] = startDigit;
        e: for (const step of stepOptions) {
          for (let offset = 1; offset < this.cellIds.length; offset++) {
            const sequenceIndex = reversed
                ? this.cellIds.length - offset - 1
                : offset,
              digitAtOffset = startDigit + step * offset;
            if (
              !(
                (puzzle.cells[this.cellIds[sequenceIndex]].candidates &
                  (1 << digitAtOffset)) !==
                0
              )
            )
              continue e;
            sequenceDigits[sequenceIndex] = digitAtOffset;
          }
          for (let maskIndex = 0; maskIndex < resultMasks.length; maskIndex++)
            resultMasks[maskIndex] |= 1 << sequenceDigits[maskIndex];
        }
      }
      return resultMasks;
    }
  }
  var getOwnPropDescriptor39 = Object.getOwnPropertyDescriptor,
    applyClassDecorators39 = (decorators, target, propertyKey, kind) => {
      for (
        var result =
            kind > 1
              ? void 0
              : kind
                ? getOwnPropDescriptor39(target, propertyKey)
                : target,
          index = decorators.length - 1,
          decorator;
        index >= 0;
        index--
      )
        (decorator = decorators[index]) &&
          (result = decorator(result) || result);
      return result;
    };
  let SkyscraperComponent = class extends ConstraintComponent {
    amount;
    constructor(name, amount, cells) {
      (super(name, cells), (this.amount = amount));
    }
    get validateDuringSolve() {
      return !0;
    }
    *initialize(puzzle) {
      if (this.amount === 1 && puzzleSpec.minDigit === 1) {
        yield replaceComponentChange(
          this.cellIds
            .slice(1)
            .map(
              (cellId) =>
                new GreaterThanOrEqualsComponent(
                  this.name,
                  cellId,
                  this.cellIds[0],
                ),
            ),
        );
        return;
      }
      yield* super.initialize(puzzle);
    }
    *update(puzzle) {
      let highestMinimum = 0,
        maxAllowedDigit = puzzleSpec.maxDigit - this.amount + 1;
      for (let index = 0; index < this.cellIds.length; index++) {
        const cellId = this.cellIds[index];
        let allowedMask = 0;
        for (let digit = puzzleSpec.minDigit; digit <= maxAllowedDigit; digit++)
          allowedMask |= 1 << digit;
        yield filterCandidatesAtCellChange(allowedMask, cellId);
        const minCandidate = smallestDigitInMask(
          puzzle.cells[cellId].candidates,
        );
        minCandidate > highestMinimum && (highestMinimum = minCandidate);
        const maxCandidate = largestDigitInMask(
          puzzle.cells[cellId].candidates,
        );
        maxCandidate > 0 && maxCandidate >= highestMinimum && maxAllowedDigit++;
      }
    }
    validate({ cells: cells }) {
      let highestValue = 0,
        skyscraperCount = 0,
        hasEmptyCell = !1;
      for (const cellIdInLine of this.cellIds) {
        if (largestDigitInMask(cells[cellIdInLine].candidates) <= highestValue)
          continue;
        const value = cells[cellIdInLine].value;
        if (value === void 0) {
          hasEmptyCell = !0;
          break;
        } else
          value > highestValue && ((highestValue = value), skyscraperCount++);
      }
      return hasEmptyCell
        ? skyscraperCount > this.amount
          ? {
              valid: !1,
              message: `${this.name} sees at least ${skyscraperCount} skyscrapers`,
            }
          : ValidResult
        : skyscraperCount !== this.amount
          ? {
              valid: !1,
              message: `${this.name} sees exactly ${skyscraperCount} skyscrapers`,
            }
          : ValidResult;
    }
  };
  SkyscraperComponent = applyClassDecorators39(
    [
      defineComponent(
        "Skyscraper",
        "Digits along {cells} represent skyscrapers, blocking cells further along the sequence. The amount of skyscrapers seen from the start must equal {amount}.",
        [
          ["amount", ParamType.Number],
          ["cells", ParamType.CellArray],
        ],
      ),
    ],
    SkyscraperComponent,
  );
  var getOwnPropDescriptor40 = Object.getOwnPropertyDescriptor,
    applyClassDecorators40 = (decorators, target, propertyKey, kind) => {
      for (
        var result =
            kind > 1
              ? void 0
              : kind
                ? getOwnPropDescriptor40(target, propertyKey)
                : target,
          index = decorators.length - 1,
          decorator;
        index >= 0;
        index--
      )
        (decorator = decorators[index]) &&
          (result = decorator(result) || result);
      return result;
    };
  let WeakLinkComponent = class extends ConstraintComponent {
    constructor(name, cellId1, value1, cellId2, value2) {
      (super(name, [cellId1, cellId2]),
        (this.cellId1 = cellId1),
        (this.value1 = value1),
        (this.cellId2 = cellId2),
        (this.value2 = value2));
    }
    *onValueSet(puzzle, setCellId, setValue) {
      (setCellId === this.cellId1
        ? setValue === this.value1 &&
          (yield removeDigitFromCellChange(this.value2, this.cellId2))
        : setValue === this.value2 &&
          (yield removeDigitFromCellChange(this.value1, this.cellId1)),
        yield removeComponentChange());
    }
    validate({ cells: cells }) {
      return cells[this.cellId1].value === this.value1 &&
        cells[this.cellId2].value === this.value2
        ? { valid: !1, message: `unable to satisfy ${this.name}` }
        : ValidResult;
    }
  };
  WeakLinkComponent = applyClassDecorators40(
    [
      defineComponent(
        "WeakLink",
        "If {cell1} is set to {value1}, {cell2} must not be {value2}. Similarly, if {cell2} is set to {value2}, {cell1} cannot be {value1}.",
        [
          ["cell1", ParamType.Cell],
          ["value1", ParamType.Number],
          ["cell2", ParamType.Cell],
          ["value2", ParamType.Number],
        ],
      ),
    ],
    WeakLinkComponent,
  );
  var getOwnPropDescriptor41 = Object.getOwnPropertyDescriptor,
    applyClassDecorators41 = (decorators, target, propertyKey, kind) => {
      for (
        var result =
            kind > 1
              ? void 0
              : kind
                ? getOwnPropDescriptor41(target, propertyKey)
                : target,
          index = decorators.length - 1,
          decorator;
        index >= 0;
        index--
      )
        (decorator = decorators[index]) &&
          (result = decorator(result) || result);
      return result;
    };
  let WeakLinksComponent = class extends ConstraintComponent {
    cellIds1;
    cellIds2;
    values1;
    values2;
    constructor(name, cells1, values1, cells2, values2) {
      ((cells1 = ensureArray(cells1)),
        (cells2 = ensureArray(cells2)),
        super(name, [...cells1, ...cells2]),
        (this.cellIds1 = cells1),
        (this.cellIds2 = cells2),
        (this.values1 = +values1),
        (this.values2 = +values2));
    }
    *update(puzzle) {
      for (const cellIdInGroup1 of this.cellIds1)
        if (
          (puzzle.cells[cellIdInGroup1].candidates | this.values1) ===
          this.values1
        ) {
          (yield removeCandidatesFromCellsChange(this.values2, this.cellIds2),
            yield removeComponentChange());
          return;
        }
      for (const cellIdInGroup2 of this.cellIds2)
        if (
          (puzzle.cells[cellIdInGroup2].candidates | this.values2) ===
          this.values2
        ) {
          (yield removeCandidatesFromCellsChange(this.values1, this.cellIds1),
            yield removeComponentChange());
          return;
        }
    }
  };
  WeakLinksComponent = applyClassDecorators41(
    [
      defineComponent(
        "WeakLinks",
        "If any of {cells1} is set to one of {values1}, all of {cells2} cannot be any of {values2}. Similarly, if any of {cells2} is set to one of {values2}, all of {cells1} cannot be any of {values1}.",
        [
          ["cells1", ParamType.CellOrCellArray],
          ["value1", ParamType.DigitSet],
          ["cells2", ParamType.CellOrCellArray],
          ["value2", ParamType.DigitSet],
        ],
      ),
    ],
    WeakLinksComponent,
  );
  class XSumFullLineComponent extends ConstraintComponent {
    sum;
    possibilities;
    constructor(name, sum, cells) {
      const possibilities = [...sharedHelpers.xSums.getXSumPossibilities(sum)],
        maxX = possibilities.reduce(
          (maxSoFar, { x: xValue }) => Math.max(maxSoFar, xValue),
          0,
        );
      (super(name, cells.slice(0, maxX)),
        (this.sum = sum),
        (this.possibilities = possibilities));
    }
    *initialize(puzzle) {
      const xDigitMask = toDigitMask(
        this.possibilities.map((possibility) => possibility.x),
      );
      (yield filterCandidatesAtCellChange(xDigitMask, this.cellIds[0]),
        yield* this.update(puzzle));
    }
    *update({ cells: cells }) {
      const xDigits = digitsInMask(cells[this.cellIds[0]].candidates);
      xDigits.length === 1 &&
        (this.sum > xDigits[0]
          ? yield replaceComponentChange(
              new SumComponent(
                this.name,
                this.sum,
                this.cellIds.slice(0, xDigits[0]),
              ),
            )
          : yield removeComponentChange());
      const matchingPossibilities = this.possibilities.filter(
          (candidatePossibility) => xDigits.includes(candidatePossibility.x),
        ),
        unionMask = matchingPossibilities
          .map((possibilityForCombos) => possibilityForCombos.combinations)
          .flat()
          .reduce(
            (accUnionMask, combinationMask) => accUnionMask | combinationMask,
            0,
          ),
        intersectionMask = matchingPossibilities.reduce(
          (
            accIntersectMask,
            { x: possibilityX, combinations: combinations },
          ) => {
            for (const combination of combinations)
              accIntersectMask &= (1 << possibilityX) | combination;
            return accIntersectMask;
          },
          allDigitsMask,
        ),
        smallestX = xDigits[0],
        largestX = xDigits.at(-1);
      (yield filterCandidatesAtCellsChange(
        unionMask,
        this.cellIds.slice(1, smallestX),
      ),
        yield removeCandidatesFromCellsChange(
          intersectionMask,
          this.cellIds.slice(largestX),
        ));
    }
    validate({ cells: cells }) {
      if (this.possibilities.length === 0)
        return {
          valid: !1,
          message: `${this.sum} is an invalid value for an X-Sum`,
        };
      let runningSum = cells[this.cellIds[0]].value;
      if (runningSum === void 0) return ValidResult;
      const xValueTotal = runningSum;
      for (
        let offsetIndex = 1;
        offsetIndex < xValueTotal && !(offsetIndex >= this.cellIds.length);
        offsetIndex++
      ) {
        if (cells[this.cellIds[offsetIndex]].value === void 0)
          return ValidResult;
        runningSum += cells[this.cellIds[offsetIndex]].value;
      }
      return runningSum === this.sum
        ? ValidResult
        : {
            valid: !1,
            message: `the cells for ${this.name} are not summing to ${this.sum}`,
          };
    }
  }
  class XSumPrefixComponent extends ConstraintComponent {
    sum;
    xCellId;
    cellsToSum;
    constructor(name, sum, xCellId, cells) {
      (super(name, [xCellId, ...cells]),
        (this.sum = sum),
        (this.xCellId = xCellId),
        (this.cellsToSum = cells));
    }
    get validateDuringSolve() {
      return !0;
    }
    *initialize(puzzle) {
      if (this.sum === 0)
        (yield keepOnlyDigitAtCell(0, this.xCellId),
          yield removeComponentChange());
      else {
        const xDigitMask = toDigitMask(
          iterateRangeInclusive(1, this.cellsToSum.length),
        );
        (yield filterCandidatesAtCellChange(xDigitMask, this.xCellId),
          yield* super.initialize(puzzle));
      }
    }
    *update({ cells: cells }) {
      if (countCandidatesInMask(cells[this.xCellId].candidates) === 1) {
        const xValue = smallestDigitInMask(cells[this.xCellId].candidates);
        yield replaceComponentChange(
          new SumComponent(
            this.name,
            this.sum,
            this.cellsToSum.slice(0, xValue),
          ),
        );
      }
    }
    validate({ cells: cells }) {
      const xCount = smallestDigitInMask(cells[this.xCellId].candidates),
        prefixCells = this.cellsToSum.slice(0, xCount),
        { minSum: minSum } = sharedHelpers.sums.getExtremeSumsWithRepeat(
          prefixCells.map((prefixCellId) => cells[prefixCellId].candidates),
        );
      return minSum > this.sum
        ? {
            valid: !1,
            message: `the first ${xCount} cells of ${this.name} sum to at least ${minSum}`,
            cells: prefixCells,
          }
        : ValidResult;
    }
  }
  var getOwnPropDescriptor42 = Object.getOwnPropertyDescriptor,
    applyClassDecorators42 = (decorators, target, propertyKey, kind) => {
      for (
        var result =
            kind > 1
              ? void 0
              : kind
                ? getOwnPropDescriptor42(target, propertyKey)
                : target,
          index = decorators.length - 1,
          decorator;
        index >= 0;
        index--
      )
        (decorator = decorators[index]) &&
          (result = decorator(result) || result);
      return result;
    };
  let XSumComponent = class extends CompositeComponent {
    constructor(name, sum, xCellId, cells) {
      super(name, [xCellId, ...cells], (puzzle) =>
        puzzleSpec.minDigit === 1 &&
        xCellId === cells[0] &&
        cells.length === puzzleSpec.digitCount &&
        !puzzle.getCellsCanHaveRepeats(cells)
          ? new XSumFullLineComponent(name, sum, cells)
          : new XSumPrefixComponent(name, sum, xCellId, cells),
      );
    }
  };
  XSumComponent = applyClassDecorators42(
    [
      defineComponent(
        "XSum",
        "The first X digits along {cells} must sum to {sum}, where X is the value of {xCell}.",
        [
          ["sum", ParamType.Number],
          ["xCell", ParamType.Cell],
          ["cells", ParamType.CellArray],
        ],
      ),
    ],
    XSumComponent,
  );
  class Solver {
    constructor(state, parentSolver) {
      ((this.state = state),
        parentSolver
          ? ((this.depth = parentSolver.depth + 1),
            (this.logicSteps = parentSolver.logicSteps.map((logicStepToClone) =>
              logicStepToClone.clone(this.state),
            )),
            (this.useRandomness = parentSolver.useRandomness))
          : (this.depth = 0));
    }
    logicSteps = [];
    depth;
    useRandomness = !0;
    setLogicSteps(logicSteps) {
      this.logicSteps = logicSteps;
    }
    *findSolutions() {
      if (this.state.updateConstraintsAndValidate().type === "failed") return;
      let stepResult;
      for (;;) {
        if (((stepResult = this.step()), !stepResult.valid)) return;
        if (this.state.isSolved()) {
          yield serializeCellsToBuffer(this.state.cells);
          return;
        }
        if (stepResult.deductionResults) continue;
        const branchCell = new BranchCellRanking(
          this.state,
          this.useRandomness,
        ).getBestCell();
        for (const branchDigit of digitsInMask(branchCell.candidates)) {
          const branchState = this.state.clone();
          if (
            branchState.setValueAtCell(branchDigit, branchCell.id).type ===
            "failed"
          )
            continue;
          yield* new Solver(branchState, this).findSolutions();
        }
        break;
      }
    }
    singleLogicStep() {
      return this.step();
    }
    getDeductionProcessor(deduction) {
      return verboseSolvingEnabled
        ? new VerboseChangeApplier(this.state, deduction)
        : new ChangeApplier(this.state, deduction);
    }
    step() {
      for (const logicStep of this.logicSteps)
        for (const pendingDeduction of logicStep.execute()) {
          const changeApplier = this.getDeductionProcessor(pendingDeduction),
            applyResult = changeApplier.execute();
          if (applyResult.type === "failed")
            return {
              changed: !0,
              deductionResults:
                this.getDeductionResultsForTransport(changeApplier),
              valid: !1,
              erroneousCells: applyResult.cells,
              error: applyResult.message,
            };
          if (applyResult.type === "changed") {
            const constraintResult = this.state.updateConstraintsAndValidate();
            return constraintResult.type === "failed"
              ? {
                  changed: !0,
                  deductionResults:
                    this.getDeductionResultsForTransport(changeApplier),
                  valid: !1,
                  erroneousCells: constraintResult.cells,
                  error: constraintResult.message,
                }
              : {
                  changed: !0,
                  deductionResults:
                    this.getDeductionResultsForTransport(changeApplier),
                  valid: !0,
                };
          }
        }
      return { changed: !1, valid: !0 };
    }
    getDeductionResultsForTransport(applier) {
      return applier instanceof VerboseChangeApplier
        ? applier.getVerboseResults()
        : [];
    }
    log(message) {
      console.log(message.padStart(this.depth * 2, " "));
    }
  }
  function cloneCandidateSetInfo(setInfo) {
    return {
      candidate: setInfo.candidate,
      name: setInfo.name,
      houseType: setInfo.houseType,
      cells: setInfo.cells.slice(),
    };
  }
  class CandidateSetMap {
    map = [];
    constructor(sourceMap) {
      if (sourceMap)
        for (
          let digit = puzzleSpec.minDigit;
          digit <= puzzleSpec.maxDigit;
          digit++
        ) {
          const sets = sourceMap.map[digit];
          this.map[digit] = sets.map((setInfoToClone) =>
            cloneCandidateSetInfo(setInfoToClone),
          );
        }
      else
        for (
          let emptyDigit = puzzleSpec.minDigit;
          emptyDigit <= puzzleSpec.maxDigit;
          emptyDigit++
        )
          this.map[emptyDigit] = [];
    }
    addSet(setInfo) {
      const setsForDigit = this.map[setInfo.candidate];
      (setsForDigit.push(setInfo), this.sortSets(setsForDigit));
    }
    removeCandidate(digit, cellId) {
      const sets = this.map[digit];
      for (let setIndex = sets.length - 1; setIndex >= 0; setIndex--) {
        const setInfo = sets[setIndex];
        ((setInfo.cells = setInfo.cells.filter(
          (otherCellId) => otherCellId !== cellId,
        )),
          setInfo.cells.length === 0 && sets.splice(setIndex, 1));
      }
      this.sortSets(sets);
    }
    reduceCandidateSetsAt(digit, cellId) {
      const sets = this.map[digit];
      for (let setIndex = sets.length - 1; setIndex >= 0; setIndex--) {
        const setInfo = sets[setIndex];
        !setInfo.repeatCount && setInfo.cells.includes(cellId)
          ? sets.splice(setIndex, 1)
          : setInfo.repeatCount && setInfo.repeatCount--;
      }
    }
    getSets(digit) {
      return this.map[digit];
    }
    sortSets(sets) {
      sets.sort((setA, setB) => setA.cells.length - setB.cells.length);
    }
  }
  const BoxShapesByDigitCount = {
    4: { width: 2, height: 2 },
    6: { width: 3, height: 2 },
    8: { width: 4, height: 2 },
    9: { width: 3, height: 3 },
  };
  function hasStandardBoxShape({ width: boxWidth, height: boxHeight }) {
    return boxWidth === boxHeight && [4, 6, 8, 9].includes(boxWidth);
  }
  function groupCellIdsByRegionId(regionIdByCell) {
    const cellsByRegion = [];
    for (let cellId = 0; cellId < regionIdByCell.length; cellId++)
      regionIdByCell[cellId] !== -1 &&
        (cellsByRegion[regionIdByCell[cellId]] ||
          (cellsByRegion[regionIdByCell[cellId]] = []),
        cellsByRegion[regionIdByCell[cellId]].push(cellId));
    for (let regionIndex = 0; regionIndex < cellsByRegion.length; regionIndex++)
      cellsByRegion[regionIndex] || (cellsByRegion[regionIndex] = []);
    return cellsByRegion;
  }
  function getDefaultRegionLayout(spec) {
    const { width: width, height: height } = spec.size;
    if (spec.digitCount === width && spec.digitCount === height) {
      const standardLayout = getStandardBoxLayout({
        width: width,
        height: height,
      });
      if (standardLayout) return standardLayout;
    }
    const divisibleLayout = getDivisibleBoxLayout(spec);
    return (
      divisibleLayout ||
      (width === height && width <= 9
        ? Array.from({ length: width * height }, (unusedSlot, cellIndex) =>
            Math.floor(cellIndex / width),
          )
        : Array.from({ length: width * height }, () => -1))
    );
  }
  function getStandardBoxLayout(size) {
    if (hasStandardBoxShape(size))
      return buildRectangularBoxLayout(size, BoxShapesByDigitCount[size.width]);
  }
  function getDivisibleBoxLayout(spec) {
    if (!(
      (spec.size.width * spec.size.height) % spec.digitCount !== 0 ||
      (spec.size.width * spec.size.height) / spec.digitCount > 9
    ))
      for (
        let boxWidth = Math.ceil(Math.sqrt(spec.digitCount));
        boxWidth <= spec.digitCount;
        boxWidth++
      ) {
        if (spec.digitCount % boxWidth !== 0) continue;
        const boxHeight = spec.digitCount / boxWidth;
        if (
          spec.size.width % boxWidth === 0 &&
          spec.size.height % boxHeight === 0
        )
          return buildRectangularBoxLayout(spec.size, {
            width: boxWidth,
            height: boxHeight,
          });
        if (
          spec.size.width % boxHeight === 0 &&
          spec.size.height % boxWidth === 0
        )
          return buildRectangularBoxLayout(spec.size, {
            width: boxHeight,
            height: boxWidth,
          });
      }
  }
  function buildRectangularBoxLayout(size, boxSize) {
    const { width: width, height: height } = size,
      { width: boxWidth, height: boxHeight } = boxSize;
    return Array.from({ length: width * height }, (unusedSlot, cellIndex) => {
      const x = cellIndex % width,
        y = Math.floor(cellIndex / width),
        boxX = Math.floor(x / boxWidth),
        boxY = Math.floor(y / boxHeight);
      return boxX + boxY * (width / boxWidth);
    });
  }
  function regionsAreRectangularBoxes(
    { width: width, height: height },
    regionIdByCell,
  ) {
    for (let rowIndex = 0; rowIndex < height - 1; rowIndex++)
      for (let columnIndex = 0; columnIndex < width - 1; columnIndex++) {
        const topLeft = regionIdByCell[columnIndex + rowIndex * width],
          topRight = regionIdByCell[columnIndex + 1 + rowIndex * width],
          bottomLeft = regionIdByCell[columnIndex + (rowIndex + 1) * width],
          bottomRight =
            regionIdByCell[columnIndex + 1 + (rowIndex + 1) * width];
        if (
          !(topLeft === topRight && bottomLeft === bottomRight) &&
          !(topLeft === bottomLeft && topRight === bottomRight) &&
          !(
            topLeft !== bottomLeft &&
            topLeft !== topRight &&
            topLeft !== bottomRight &&
            bottomRight !== bottomLeft &&
            bottomRight !== topRight
          )
        )
          return !1;
      }
    return !0;
  }
  class EventEmitter {
    all = new Map();
    on(eventName, handler) {
      const handlers = this.all.get(eventName);
      handlers
        ? handlers.add(handler)
        : this.all.set(eventName, new Set([handler]));
    }
    off(eventName, handler) {
      const handlers = this.all.get(eventName);
      handlers && (handler ? handlers.delete(handler) : handlers.clear());
    }
    emit(eventName, payload) {
      const handlers = this.all.get(eventName);
      if (handlers) for (const handler of [...handlers]) handler(payload);
    }
  }
  class SolverState {
    cells;
    regions;
    regionsByCellId;
    clonedCellsMap;
    cloneComponentCount = 0;
    constraintComponents;
    houseConstraintComponents;
    constraintComponentByCell;
    candidateSetMap;
    componentEventBus = new EventEmitter();
    updateSet = new Set();
    requiredDigitsForComponent;
    static create() {
      return new SolverState();
    }
    constructor(sourceState) {
      if (
        ((this.cells = Array.from(
          { length: puzzleSpec.size.width * puzzleSpec.size.height },
          (ignoredEntry, index) => ({
            id: index,
            x: index % puzzleSpec.size.width,
            y: Math.floor(index / puzzleSpec.size.width),
            value: void 0,
            candidates: allDigitsMask,
          }),
        )),
        sourceState)
      ) {
        ((this.regions = sourceState.regions),
          (this.regionsByCellId = sourceState.regionsByCellId));
        for (
          let cellIndex = 0;
          cellIndex < sourceState.cells.length;
          cellIndex++
        )
          ((this.cells[cellIndex].value = sourceState.cells[cellIndex].value),
            (this.cells[cellIndex].candidates =
              sourceState.cells[cellIndex].candidates));
        ((this.constraintComponents = new Set(
          sourceState.constraintComponents,
        )),
          (this.houseConstraintComponents = new Set(
            sourceState.houseConstraintComponents,
          )),
          (this.constraintComponentByCell =
            sourceState.constraintComponentByCell.clone()),
          (this.candidateSetMap = new CandidateSetMap(
            sourceState.candidateSetMap,
          )),
          (this.clonedCellsMap = deepClone(sourceState.clonedCellsMap)),
          (this.cloneComponentCount = sourceState.cloneComponentCount),
          (this.requiredDigitsForComponent = new Map(
            sourceState.requiredDigitsForComponent.entries(),
          )));
      } else {
        ((this.regions = []),
          (this.regionsByCellId = []),
          (this.constraintComponents = new Set()),
          (this.houseConstraintComponents = new Set()),
          (this.constraintComponentByCell = new CloneableMap()),
          (this.candidateSetMap = new CandidateSetMap()),
          (this.requiredDigitsForComponent = new Map()),
          (this.clonedCellsMap = new Map()));
        for (
          let initCellIndex = 0;
          initCellIndex < puzzleSpec.size.width * puzzleSpec.size.height;
          initCellIndex++
        )
          (this.constraintComponentByCell.set(initCellIndex, new Set()),
            this.clonedCellsMap.set(initCellIndex, new Set([initCellIndex])));
      }
    }
    setRegions(regionIdByCellId) {
      ((this.regionsByCellId = regionIdByCellId),
        (this.regions = groupCellIdsByRegionId(regionIdByCellId)));
      const isBoxLayout = regionsAreRectangularBoxes(
        puzzleSpec.size,
        regionIdByCellId,
      );
      for (
        let regionIndex = 0;
        regionIndex < this.regions.length;
        regionIndex++
      ) {
        const regionCells = this.regions[regionIndex],
          regionName = isBoxLayout
            ? `box ${regionIndex + 1}`
            : `region ${regionIndex + 1}`;
        regionCells.length === puzzleSpec.maxDigit - puzzleSpec.minDigit + 1
          ? this.addConstraintComponent(
              new HouseComponent(regionName, regionCells, HouseType.Region),
            )
          : this.addConstraintComponent(
              new DifferentDigitsComponent(regionName, regionCells),
            );
      }
    }
    addConstraintComponent(component) {
      if (component instanceof HouseComponent)
        (this.houseConstraintComponents.add(component),
          this.markDigitsAsRequiredForComponent(allDigitsMask, component));
      else if (component instanceof SameDigitComponent) {
        for (const cloneCellId of component.cellIds)
          addAllToSet(this.clonedCellsMap.get(cloneCellId), component.cellIds);
        this.cloneComponentCount++;
      } else
        component instanceof RequiredDigitsComponent &&
          this.handleRequiredDigitsComponent(component);
      for (const memberCellId of component.cellIds)
        this.constraintComponentByCell.get(memberCellId).add(component);
      (this.constraintComponents.add(component),
        this.componentEventBus.emit("change", {
          type: "add",
          component: component,
        }));
    }
    handleRequiredDigitsComponent(requiredComponent) {
      const valuesMask = toDigitMask(requiredComponent.values);
      if (countCandidatesInMask(valuesMask) === requiredComponent.values.length)
        this.markDigitsAsRequiredForComponent(valuesMask, requiredComponent);
      else
        for (const requiredValue of requiredComponent.values)
          this.markDigitsAsRequiredForComponent(
            1 << requiredValue,
            requiredComponent,
            requiredComponent.cellIds,
            requiredComponent.repeatCounts.get(requiredValue),
          );
    }
    removeConstraintComponent(component) {
      if (
        (component.cellIds.forEach((cellId) => {
          this.constraintComponentByCell.get(cellId).delete(component);
        }),
        this.constraintComponents.delete(component),
        component instanceof HouseComponent)
      )
        this.houseConstraintComponents.delete(component);
      else if (component instanceof SameDigitComponent) {
        this.cloneComponentCount--;
        for (const cloneCellId of component.cellIds) {
          const cloneSet = this.clonedCellsMap.get(cloneCellId);
          (cloneSet.clear(), cloneSet.add(cloneCellId));
          for (const otherComponent of this.getConstraintComponentsAt(
            cloneCellId,
          ))
            otherComponent instanceof SameDigitComponent &&
              addAllToSet(cloneSet, otherComponent.cellIds);
        }
      }
      this.componentEventBus.emit("change", {
        type: "delete",
        component: component,
      });
    }
    getConstraintComponents() {
      return this.constraintComponents;
    }
    getHouseComponents() {
      return this.houseConstraintComponents;
    }
    getConstraintComponentsAt(cellId) {
      return this.constraintComponentByCell.get(cellId);
    }
    addComponentListener(listener) {
      this.componentEventBus.on("change", listener);
    }
    getRegions() {
      return this.regions;
    }
    getRegionIdAt(cellId) {
      return this.regionsByCellId[cellId] ?? -1;
    }
    hasRegions() {
      return this.regions.length > 0;
    }
    getCellsSeenByCell(cellId, includeClones = !0) {
      const sourceCells = new Set([cellId]);
      includeClones && this.addClonedCells(sourceCells);
      const seenCells = new Set();
      for (const sourceCell of sourceCells)
        for (const component of this.constraintComponentByCell.get(sourceCell))
          for (const exclusionCell of component.getExclusionGroup(sourceCell))
            exclusionCell !== sourceCell && seenCells.add(exclusionCell);
      return (
        includeClones &&
          this.cloneComponentCount > 0 &&
          this.addClonedCells(seenCells),
        seenCells
      );
    }
    *initializeComponent(component) {
      for (const change of component.initialize(this))
        if (
          (yield* this.processChange(component, change),
          this.isTerminalChange(change))
        )
          break;
    }
    getCellsSeenByCells(cellIds, includeClones = !0) {
      let commonSeenCells;
      for (const cellId of cellIds)
        if (
          (commonSeenCells
            ? retainIntersectionInSet(
                commonSeenCells,
                this.getCellsSeenByCell(cellId, includeClones),
              )
            : (commonSeenCells = this.getCellsSeenByCell(
                cellId,
                includeClones,
              )),
          commonSeenCells.size === 0)
        )
          return commonSeenCells;
      return commonSeenCells || new Set();
    }
    getCellsSeeEachOther(cellsInput) {
      const cellIdList = Array.isArray(cellsInput)
        ? cellsInput
        : [...cellsInput];
      return cellIdList.every((cellId) => {
        const seenCells = this.getCellsSeenByCell(cellId);
        return cellIdList.every(
          (otherCellId) => otherCellId === cellId || seenCells.has(otherCellId),
        );
      });
    }
    getCellsCanHaveRepeats(cellsInput) {
      const cellIdList = Array.isArray(cellsInput)
        ? cellsInput
        : [...cellsInput];
      return (
        hasDuplicates(cellIdList) || !this.getCellsSeeEachOther(cellsInput)
      );
    }
    setValueAtCell(digit, cellId, skipIfUnchanged = !0) {
      const cell = this.cells[cellId];
      if (skipIfUnchanged && cell.value === digit) return UnchangedResult;
      const filterResult = this.filterCandidatesAtCell(1 << digit, cellId);
      if (filterResult.type === "failed") return filterResult;
      (this.candidateSetMap.reduceCandidateSetsAt(digit, cellId),
        (cell.value = digit));
      let result = ChangedResult;
      for (const seenCellId of this.getCellsSeenByCell(cellId, !1))
        if (
          ((result = mergeDeductionResults(
            result,
            this.removeCandidatesFromCell(1 << digit, seenCellId),
          )),
          !verboseSolvingEnabled && result.type === "failed")
        )
          return result;
      this.updateSet.add(cellId);
      const componentsAtCell = this.constraintComponentByCell.get(cell.id);
      for (const component of componentsAtCell)
        for (const change of component.onValueSet(this, cell.id, cell.value)) {
          for (const changeResult of this.processChange(component, change))
            if (
              ((result = mergeDeductionResults(result, changeResult)),
              !verboseSolvingEnabled && result.type === "failed")
            )
              return result;
          if (this.isTerminalChange(change)) break;
        }
      return result;
    }
    removeCandidatesFromCell(digitMask, cellId) {
      const cell = this.cells[cellId],
        removedMask = cell.candidates & digitMask;
      if (removedMask === 0) return UnchangedResult;
      cell.candidates -= removedMask;
      for (const removedDigit of digitsInMask(removedMask))
        this.candidateSetMap.removeCandidate(removedDigit, cellId);
      const result = cell.candidates
        ? ChangedResult
        : createFailedResultForCell(cellId);
      return (this.updateSet.add(cellId), result);
    }
    *removeCandidatesFromCells(digitMask, cellIds) {
      for (const cellId of cellIds)
        yield this.removeCandidatesFromCell(digitMask, cellId);
    }
    filterCandidatesAtCell(digitMask, cellId) {
      const cell = this.cells[cellId],
        previousCandidates = cell.candidates;
      cell.candidates &= digitMask;
      const removedMask = previousCandidates - cell.candidates;
      if (removedMask === 0) return UnchangedResult;
      for (const removedDigit of digitsInMask(removedMask))
        this.candidateSetMap.removeCandidate(removedDigit, cellId);
      const result = cell.candidates
        ? ChangedResult
        : createFailedResultForCell(cellId);
      return (this.updateSet.add(cellId), result);
    }
    *filterCandidatesAtCells(digitMask, cellIds) {
      for (const cellId of cellIds)
        yield this.filterCandidatesAtCell(digitMask, cellId);
    }
    markDigitsAsRequiredForCells(
      digitMask,
      componentName,
      cellIds,
      { repeatCount: repeatCount, houseType: houseType } = { repeatCount: 0 },
    ) {
      const requirementKey = `${componentName}_${cellIds}`;
      let newDigitsMask;
      if (!this.requiredDigitsForComponent.has(requirementKey))
        (this.requiredDigitsForComponent.set(requirementKey, digitMask),
          (newDigitsMask = digitMask));
      else {
        const existingMask =
            this.requiredDigitsForComponent.get(requirementKey),
          combinedMask = existingMask | digitMask;
        (this.requiredDigitsForComponent.set(requirementKey, combinedMask),
          (newDigitsMask = combinedMask - existingMask));
      }
      for (const digit of digitsInMask(newDigitsMask)) {
        let placedCount = 0;
        const candidateCells = [];
        for (const candidateCellId of cellIds)
          this.cells[candidateCellId].value === digit
            ? placedCount++
            : this.cells[candidateCellId].value === void 0 &&
              (this.cells[candidateCellId].candidates & (1 << digit)) > 0 &&
              candidateCells.push(candidateCellId);
        placedCount >= repeatCount + 1 ||
          candidateCells.length === 0 ||
          this.candidateSetMap.addSet({
            candidate: digit,
            name: componentName,
            cells: candidateCells,
            houseType: houseType,
            repeatCount: repeatCount,
          });
      }
      return newDigitsMask !== 0;
    }
    markDigitsAsRequiredForComponent(
      digitMask,
      component,
      cellIds = component.cellIds,
      repeatCount = 0,
    ) {
      return component instanceof HouseComponent
        ? this.markDigitsAsRequiredForCells(
            digitMask,
            component.name,
            cellIds,
            {
              repeatCount: repeatCount,
              houseType: component.houseType,
            },
          )
        : this.markDigitsAsRequiredForCells(
            digitMask,
            component.name,
            cellIds,
            { repeatCount: repeatCount },
          );
    }
    getSetsForCandidate(digit) {
      return this.candidateSetMap.getSets(digit);
    }
    getCloneSet(cellId) {
      return this.clonedCellsMap.get(cellId);
    }
    addClonedCells(cellSet) {
      for (const cellId of [...cellSet])
        addAllToSet(cellSet, this.clonedCellsMap.get(cellId));
      return cellSet;
    }
    updateConstraints() {
      const runPass = () => {
        let passResult = UnchangedResult;
        const dirtyCells = this.updateSet;
        this.updateSet = new Set();
        for (const component of this.constraintComponents)
          if (setHasSomeOf(dirtyCells, component.cellIds)) {
            for (const change of component.update(this)) {
              for (const changeResult of this.processChange(component, change))
                if (
                  ((passResult = mergeDeductionResults(
                    passResult,
                    changeResult,
                  )),
                  passResult.type === "failed")
                )
                  return (
                    verboseSolvingEnabled &&
                      !passResult.message &&
                      (passResult.message = `unable to satisfy ${component.name}`),
                    passResult
                  );
              if (this.isTerminalChange(change)) break;
            }
            component.getIsDone(this) &&
              this.removeConstraintComponent(component);
          }
        return passResult;
      };
      let totalResult = UnchangedResult;
      for (;;) {
        const iterationResult = runPass();
        if (iterationResult.type === "failed") return iterationResult;
        if (
          ((totalResult = mergeDeductionResults(totalResult, iterationResult)),
          iterationResult.type === "unchanged")
        )
          return totalResult;
      }
    }
    validate() {
      for (const component of this.constraintComponents) {
        if (!component.validateDuringSolve) continue;
        const validationResult = component.validate(this);
        if (!validationResult.valid) return validationResult;
      }
      return ValidResult;
    }
    isSolved() {
      return this.cells.every((cell) => cell.value !== void 0);
    }
    updateConstraintsAndValidate() {
      const updateResult = this.updateConstraints();
      if (updateResult.type === "failed") return updateResult;
      const validationResult = this.validate();
      return validationResult.valid
        ? updateResult
        : {
            type: "failed",
            cells: validationResult.cells || [],
            message: validationResult.message,
          };
    }
    clone() {
      return new SolverState(this);
    }
    *processChange(component, change) {
      switch (change.type) {
        case ChangeType.AbortSolver:
          return yield createFailedResultForCells(change.cells, change.message);
        case ChangeType.SetValue:
          return yield this.setValueAtCell(change.value, change.cell);
        case ChangeType.FilterCandidatesAtCell:
          return yield this.filterCandidatesAtCell(change.value, change.cell);
        case ChangeType.FilterCandidatesAtCells:
          return yield* this.filterCandidatesAtCells(
            change.value,
            change.cells,
          );
        case ChangeType.RemoveCandidatesFromCell:
          return yield this.removeCandidatesFromCell(change.value, change.cell);
        case ChangeType.RemoveCandidatesFromCells:
          return yield* this.removeCandidatesFromCells(
            change.value,
            change.cells,
          );
        case ChangeType.ReplaceComponent: {
          this.removeConstraintComponent(component);
          for (const replacementComponent of change.with) {
            this.addConstraintComponent(replacementComponent);
            for (const initChange of replacementComponent.initialize(this)) {
              if (
                (yield* this.processChange(replacementComponent, initChange),
                initChange.type === ChangeType.AbortSolver)
              )
                return;
              if (initChange.type === ChangeType.ReplaceComponent) break;
            }
          }
        }
      }
    }
    isTerminalChange(change) {
      return (
        change.type === ChangeType.ReplaceComponent ||
        change.type === ChangeType.AbortSolver
      );
    }
  }
  class RegionAwareGeometryHelper extends GeometryHelper {
    constructor(
      sudokuState,
      cellIdHelper,
      edgeIdHelper,
      cornerIdHelper,
      outerCellIdHelper,
    ) {
      (super(cellIdHelper, edgeIdHelper, cornerIdHelper, outerCellIdHelper),
        (this.sudoku = sudokuState));
    }
    getSubsetsPerRegion(cellIds) {
      const cellsByRegionId = new Map();
      for (const cellId of new Set(cellIds)) {
        const regionId = this.sudoku.getRegionIdAt(cellId);
        (cellsByRegionId.has(regionId) || cellsByRegionId.set(regionId, []),
          cellsByRegionId.get(regionId).push(cellId));
      }
      return cellsByRegionId;
    }
  }
  class LinesHelper {
    getLineEnds(lineCells) {
      return [lineCells[0], lineCells.at(-1)];
    }
    getCellsBetweenLineEnds(lineCells) {
      return lineCells.slice(1, lineCells.length - 1);
    }
    *getAllPairsAlongLines(lines) {
      for (const lineCells of lines)
        for (let index = 0; index < lineCells.length - 1; index++)
          yield [lineCells[index], lineCells[index + 1]];
    }
  }
  class MiscHelper {
    constructor(
      cellIdHelper,
      edgeIdHelper,
      outerCellIdHelper,
      cornerIdHelper,
      geometryHelper,
    ) {
      ((this.cellIdHelper = cellIdHelper),
        (this.edgeIdHelper = edgeIdHelper),
        (this.outerCellIdHelper = outerCellIdHelper),
        (this.cornerIdHelper = cornerIdHelper),
        (this.geometryHelper = geometryHelper),
        (this.spec = cellIdHelper.spec));
    }
    spec;
    *getEdgesForNegativeConstraint(existingClues) {
      const usedEdgeIds = new Set();
      for (const clue of existingClues) usedEdgeIds.add(clue.edge);
      const { width: width, height: height } = this.spec.size;
      for (let rowIndex = 0; rowIndex < height; rowIndex++)
        for (let columnIndex = 0; columnIndex < width; columnIndex++) {
          if (columnIndex < width - 1) {
            const verticalEdgeId = this.edgeIdHelper.getIdFromCoords({
              x: columnIndex + 1,
              y: rowIndex + 0.5,
            });
            usedEdgeIds.has(verticalEdgeId) || (yield verticalEdgeId);
          }
          if (rowIndex < height - 1) {
            const horizontalEdgeId = this.edgeIdHelper.getIdFromCoords({
              x: columnIndex + 0.5,
              y: rowIndex + 1,
            });
            usedEdgeIds.has(horizontalEdgeId) || (yield horizontalEdgeId);
          }
        }
    }
    getCellGroupsFromLines(lines) {
      const cellGroups = [],
        lineGraph = new LineGraph(lines),
        remainingPoints = new Set(lineGraph.getPoints());
      for (; remainingPoints.size > 0;) {
        const startPoint = takeOneFromSet(remainingPoints),
          componentPoints = lineGraph
            .getComponentContainingPoint(startPoint)
            .getPoints();
        cellGroups.push(componentPoints);
        for (const point of componentPoints) remainingPoints.delete(point);
      }
      return cellGroups;
    }
  }
  function createExtendedHelpers(spec, sudokuState) {
    const baseHelpers = createHelpers(spec);
    return {
      ...baseHelpers,
      geometry: new RegionAwareGeometryHelper(
        sudokuState,
        baseHelpers.cellIds,
        baseHelpers.edgeIds,
        baseHelpers.cornerIds,
        baseHelpers.outerCellIds,
      ),
      lines: new LinesHelper(),
      misc: new MiscHelper(
        baseHelpers.cellIds,
        baseHelpers.edgeIds,
        baseHelpers.outerCellIds,
        baseHelpers.cornerIds,
        baseHelpers.geometry,
      ),
    };
  }
  class PuzzleAccessorBase {
    spec;
    state;
    helpers;
    constructor(spec, state, helpers) {
      ((this.spec = spec), (this.state = state), (this.helpers = helpers));
    }
    get puzzleType() {
      return this.spec.type;
    }
    get size() {
      return this.spec.size.width;
    }
    get width() {
      return this.spec.size.width;
    }
    get height() {
      return this.spec.size.height;
    }
    get maxDigit() {
      return this.spec.maxDigit;
    }
    get minDigit() {
      return this.spec.minDigit;
    }
    get digitCount() {
      return this.spec.digitCount;
    }
    hasRegions() {
      return this.state.hasRegions();
    }
    getRegions() {
      return this.state.getRegions();
    }
    getRegion(cellId) {
      return this.state.getRegionIdAt(cellId);
    }
    getRegionCells(regionId) {
      return this.state.getRegions()[regionId];
    }
    getRegionAt(x, y) {
      return this.state.getRegionIdAt(this.unsafeGetCellAt(x, y));
    }
    getY(cellId) {
      return this.helpers.cellIds.getY(cellId);
    }
    getX(cellId) {
      return this.helpers.cellIds.getX(cellId);
    }
    getRow(cellId) {
      return this.helpers.cellIds.getY(cellId);
    }
    getColumn(cellId) {
      return this.helpers.cellIds.getX(cellId);
    }
    getCellAt(x, y) {
      return this.helpers.cellIds.getIdFromCoordsSafe({ x: x, y: y });
    }
    unsafeGetCellAt(x, y) {
      return this.helpers.cellIds.getIdFromCoords({ x: x, y: y });
    }
    *getCellsOrthogonallyAdjacentToCell(cellId) {
      yield* this.helpers.geometry.getOrthogonallyAdjacentCells(cellId);
    }
    *getCellsOrthogonallyAdjacentToCoords(x, y) {
      yield* this.getCellsOrthogonallyAdjacentToCell(
        this.helpers.cellIds.getIdFromCoords({ x: x, y: y }),
      );
    }
    *getCellsDiagonallyAdjacentToCell(cellId) {
      yield* this.helpers.geometry.getDiagonallyAdjacentCells(cellId);
    }
    *getCellsDiagonallyAdjacentToCoords(x, y) {
      yield* this.getCellsDiagonallyAdjacentToCell(
        this.helpers.cellIds.getIdFromCoords({ x: x, y: y }),
      );
    }
    getFriendlyDigitsForCell(cellId) {
      const regionId = this.state.getRegionIdAt(cellId),
        regionBit = regionId >= 0 ? 1 << (regionId + 1) : 0;
      return new SudokuDigitSet(
        (1 << (this.helpers.cellIds.getX(cellId) + 1)) |
          (1 << (this.helpers.cellIds.getY(cellId) + 1)) |
          regionBit,
      );
    }
    getCellsSeeEachOther(cells) {
      return this.state.getCellsSeeEachOther(cells);
    }
    getCellsSeenByCell(cellId, includeClones) {
      return this.state.getCellsSeenByCell(cellId, includeClones);
    }
    getCellsCanHaveRepeats(cells) {
      return this.state.getCellsCanHaveRepeats(cells);
    }
  }
  class PuzzleSetupView extends PuzzleAccessorBase {
    constructor(spec, state, helpers) {
      super(spec, state, helpers);
    }
    setRegions(regionIdByCellId) {
      this.state.setRegions(regionIdByCellId);
    }
    addConstraintComponent(component) {
      this.state.addConstraintComponent(component);
    }
    removeConstraintComponent(component) {
      this.state.removeConstraintComponent(component);
    }
    getConstraintComponentsAt(cellId) {
      return this.state.getConstraintComponentsAt(cellId);
    }
  }
  var ValidationSeverity = ((severityEnum) => (
    (severityEnum[(severityEnum.Valid = 0)] = "Valid"),
    (severityEnum[(severityEnum.Error = 1)] = "Error"),
    (severityEnum[(severityEnum.Warning = 2)] = "Warning"),
    (severityEnum[(severityEnum.Info = 3)] = "Info"),
    severityEnum
  ))(ValidationSeverity || {});
  class ConstraintHandlerRegistry {
    map = new Map();
    register(constraintType, handler) {
      ((handler.priority = handler.priority || 0),
        this.map.set(constraintType, handler));
    }
    setupPuzzle(spec, state, constraints) {
      const helpers = createExtendedHelpers(spec, state),
        puzzleView = new PuzzleSetupView(spec, state, helpers);
      ((constraints = constraints.filter((constraint) =>
        this.map.has(constraint.config.type),
      )),
        (constraints = constraints
          .slice()
          .sort(
            (constraintA, constraintB) =>
              this.map.get(constraintA.config.type).priority -
              this.map.get(constraintB.config.type).priority,
          )));
      for (const { config: registerConfig } of constraints)
        this.map
          .get(registerConfig.type)
          .register({
            puzzle: puzzleView,
            constraints: constraints,
            input: registerConfig,
            helpers: helpers,
          });
      for (const { config: postRegisterConfig } of constraints)
        this.map
          .get(postRegisterConfig.type)
          .postRegister?.({
            puzzle: puzzleView,
            constraints: constraints,
            input: postRegisterConfig,
            helpers: helpers,
          });
    }
    validate(input, puzzle) {
      const validateFn = this.map.get(input.type)?.validate;
      if (!validateFn) return { type: 0 };
      const validationResult = validateFn({ puzzle: puzzle, input: input });
      return typeof validationResult == "string"
        ? validationResult === ""
          ? { type: 0 }
          : { type: 1, message: validationResult }
        : validationResult;
    }
  }
  const constraintHandlerRegistry = new ConstraintHandlerRegistry();
  function registerConstraintHandler(constraintType, handler) {
    constraintHandlerRegistry.register(constraintType, handler);
  }
  var ConstraintType = ((constraintTypes) => (
      (constraintTypes[(constraintTypes.Givens = 0)] = "Givens"),
      (constraintTypes[(constraintTypes.Regions = 1)] = "Regions"),
      (constraintTypes[(constraintTypes.DiagonalMinus = 10)] = "DiagonalMinus"),
      (constraintTypes[(constraintTypes.DiagonalPlus = 11)] = "DiagonalPlus"),
      (constraintTypes[(constraintTypes.Antiking = 12)] = "Antiking"),
      (constraintTypes[(constraintTypes.Antiknight = 13)] = "Antiknight"),
      (constraintTypes[(constraintTypes.DisjointGroups = 14)] =
        "DisjointGroups"),
      (constraintTypes[(constraintTypes.Nonconsecutive = 15)] =
        "Nonconsecutive"),
      (constraintTypes[(constraintTypes.GlobalEntropy = 16)] = "GlobalEntropy"),
      (constraintTypes[(constraintTypes.Even = 100)] = "Even"),
      (constraintTypes[(constraintTypes.Odd = 101)] = "Odd"),
      (constraintTypes[(constraintTypes.Maximum = 102)] = "Maximum"),
      (constraintTypes[(constraintTypes.Minimum = 103)] = "Minimum"),
      (constraintTypes[(constraintTypes.Difference = 200)] = "Difference"),
      (constraintTypes[(constraintTypes.Ratio = 201)] = "Ratio"),
      (constraintTypes[(constraintTypes.XV = 202)] = "XV"),
      (constraintTypes[(constraintTypes.Thermometer = 300)] = "Thermometer"),
      (constraintTypes[(constraintTypes.KillerCages = 301)] = "KillerCages"),
      (constraintTypes[(constraintTypes.Clone = 302)] = "Clone"),
      (constraintTypes[(constraintTypes.Quadruple = 303)] = "Quadruple"),
      (constraintTypes[(constraintTypes.LookAndSayCages = 304)] =
        "LookAndSayCages"),
      (constraintTypes[(constraintTypes.DifferentValues = 305)] =
        "DifferentValues"),
      (constraintTypes[(constraintTypes.CountingCircles = 306)] =
        "CountingCircles"),
      (constraintTypes[(constraintTypes.Renban = 400)] = "Renban"),
      (constraintTypes[(constraintTypes.Whisper = 401)] = "Whisper"),
      (constraintTypes[(constraintTypes.Palindrome = 402)] = "Palindrome"),
      (constraintTypes[(constraintTypes.BetweenLines = 403)] = "BetweenLines"),
      (constraintTypes[(constraintTypes.RegionSumLine = 404)] =
        "RegionSumLine"),
      (constraintTypes[(constraintTypes.Sequence = 405)] = "Sequence"),
      (constraintTypes[(constraintTypes.EntropyLines = 406)] = "EntropyLines"),
      (constraintTypes[(constraintTypes.LockoutLines = 407)] = "LockoutLines"),
      (constraintTypes[(constraintTypes.Arrow = 408)] = "Arrow"),
      (constraintTypes[(constraintTypes.DoubleArrow = 409)] = "DoubleArrow"),
      (constraintTypes[(constraintTypes.LittleKillers = 500)] =
        "LittleKillers"),
      (constraintTypes[(constraintTypes.SandwichSums = 501)] = "SandwichSums"),
      (constraintTypes[(constraintTypes.XSums = 502)] = "XSums"),
      (constraintTypes[(constraintTypes.Skyscrapers = 503)] = "Skyscrapers"),
      (constraintTypes[(constraintTypes.NumberedRooms = 504)] =
        "NumberedRooms"),
      (constraintTypes[(constraintTypes.RowIndexer = 600)] = "RowIndexer"),
      (constraintTypes[(constraintTypes.ColumnIndexer = 601)] =
        "ColumnIndexer"),
      (constraintTypes[(constraintTypes.Custom = 1e3)] = "Custom"),
      (constraintTypes[(constraintTypes.CosmeticLine = 2e3)] = "CosmeticLine"),
      (constraintTypes[(constraintTypes.CosmeticCage = 2001)] = "CosmeticCage"),
      (constraintTypes[(constraintTypes.CosmeticSymbol = 2002)] =
        "CosmeticSymbol"),
      (constraintTypes[(constraintTypes.SudokuRules = 2003)] = "SudokuRules"),
      (constraintTypes[(constraintTypes.FogLights = 4e3)] = "FogLights"),
      (constraintTypes[(constraintTypes.FogTriggers = 4001)] = "FogTriggers"),
      constraintTypes
    ))(ConstraintType || {}),
    CellRelationScope = ((relationScopes) => (
      (relationScopes[(relationScopes.Self = 0)] = "Self"),
      (relationScopes[(relationScopes.OrthogonalNeighbors = 1)] =
        "OrthogonalNeighbors"),
      (relationScopes[(relationScopes.DiagonalNeighbors = 2)] =
        "DiagonalNeighbors"),
      (relationScopes[(relationScopes.KnightsMoves = 3)] = "KnightsMoves"),
      (relationScopes[(relationScopes.Row = 4)] = "Row"),
      (relationScopes[(relationScopes.Column = 5)] = "Column"),
      relationScopes
    ))(CellRelationScope || {});
  const EdgeClueConstraintTypes = [
    ConstraintType.Difference,
    ConstraintType.Ratio,
    ConstraintType.XV,
  ];
  (ConstraintType.Minimum,
    ConstraintType.Maximum,
    ConstraintType.CosmeticSymbol,
    ConstraintType.CosmeticLine,
    ConstraintType.CosmeticCage);
  const PalindromeLineColor = "#bbbbbb",
    GreyLineColor = "#cccccc",
    TranslucentBlackColor = "#00000033",
    DiagonalLineColor = "#34bbe6ff",
    RenbanLineColor = "#f067f0",
    WhisperLineColor = "#67f067",
    RegionSumLineColor = "#2ecbff",
    EntropyLineColor = "#ffccaa",
    CosmeticLineColor = "#ff6666";
  let nextConstraintIdCounter = 0;
  function getNextConstraintId() {
    return nextConstraintIdCounter++;
  }
  function createDefaultConstraintConfig({
    type: type,
    spec: spec,
    otherConstraints: otherConstraints = [],
  }) {
    const makeUniqueName = (candidateName) => {
      for (const otherConstraint of otherConstraints)
        if (
          otherConstraint.config.type === ConstraintType.Custom &&
          otherConstraint.config.definition.name === candidateName
        ) {
          let nextName = candidateName.replace(/\d+$/, (trailingDigits) =>
            String(Number(trailingDigits) + 1),
          );
          return (
            nextName.match(/\d+$/) || (nextName += " 2"),
            makeUniqueName(nextName)
          );
        }
      return candidateName;
    };
    switch (type) {
      case ConstraintType.Antiking:
      case ConstraintType.Antiknight:
      case ConstraintType.DisjointGroups:
      case ConstraintType.Givens:
      case ConstraintType.Nonconsecutive:
        return { type: type };
      case ConstraintType.Arrow:
        return {
          type: type,
          bulbsWithArrows: [],
          style: {
            bulb: {
              size: 0.8,
              fill: "#ffffff",
              stroke: { thickness: 0.02, color: "#aaaaaa" },
            },
            arrow: { thickness: 0.05, color: "#aaaaaa", headSize: 0.35 },
          },
        };
      case ConstraintType.DoubleArrow:
        return {
          type: type,
          lines: [],
          style: {
            lines: { thickness: 0.05, color: "#aaaaaa" },
            endPoints: {
              size: 0.8,
              fill: "#ffffff",
              stroke: { thickness: 0.02, color: "#aaaaaa" },
            },
          },
        };
      case ConstraintType.BetweenLines:
        return {
          type: type,
          lines: [],
          style: {
            lines: { thickness: 0.1, color: "#aaaaaa" },
            endPoints: {
              size: 0.8,
              fill: "#ffffff80",
              stroke: { thickness: 0.02, color: "#aaaaaa" },
            },
          },
        };
      case ConstraintType.ColumnIndexer:
        return { type: type, cells: [], style: { color: "#f9000055" } };
      case ConstraintType.RowIndexer:
        return { type: type, cells: [], style: { color: "#0080f955" } };
      case ConstraintType.CountingCircles:
        return {
          type: type,
          cells: [],
          style: {
            size: 0.75,
            fill: "#ffffffff",
            stroke: { thickness: 0.02, color: "#000000ff" },
          },
        };
      case ConstraintType.Clone:
        return {
          type: type,
          groups: [],
          style: { color: TranslucentBlackColor },
        };
      case ConstraintType.Custom:
        return {
          type: type,
          definition: {
            name: makeUniqueName("New constraint"),
            input: [],
            backend: { type: "code", code: "" },
            components: [],
          },
          input: {},
          style: {},
        };
      case ConstraintType.DiagonalPlus:
      case ConstraintType.DiagonalMinus:
        return {
          type: type,
          style: { color: DiagonalLineColor, thickness: 0.02 },
        };
      case ConstraintType.Difference:
        return {
          type: type,
          clues: [],
          negative: [],
          overrideNegativeRatios: !0,
        };
      case ConstraintType.EntropyLines:
        return {
          type: type,
          lines: [],
          groups: [],
          style: { color: EntropyLineColor, thickness: 0.15 },
        };
      case ConstraintType.Even:
        return {
          type: type,
          cells: [],
          style: { color: TranslucentBlackColor, size: 0.8 },
        };
      case ConstraintType.DifferentValues:
        return {
          type: type,
          cells: [],
          style: { color: TranslucentBlackColor, offset: 0.1 },
        };
      case ConstraintType.GlobalEntropy:
        return { type: type, groups: [] };
      case ConstraintType.KillerCages:
        return {
          type: type,
          cages: [],
          style: { text: { color: "#000000" }, cage: { color: "#000000" } },
        };
      case ConstraintType.LittleKillers:
        return {
          type: type,
          clues: [],
          style: { text: { color: "#000000" }, arrow: { color: "#000000" } },
        };
      case ConstraintType.LockoutLines:
        return {
          type: type,
          lines: [],
          style: {
            lines: { color: "#aabeefff", thickness: 0.1 },
            endPoints: {
              size: 0.8,
              stroke: { color: "#0000ff80", thickness: 0.05 },
              fill: "#e7e6ff80",
            },
          },
        };
      case ConstraintType.LookAndSayCages:
        return {
          type: type,
          cages: [],
          style: { cage: { color: "#000000" }, text: { color: "#000000" } },
        };
      case ConstraintType.Maximum:
      case ConstraintType.Minimum:
        return {
          type: type,
          cells: [],
          style: { color: TranslucentBlackColor },
        };
      case ConstraintType.NumberedRooms:
        return { type: type, clues: [], style: { color: "#000000" } };
      case ConstraintType.Odd:
        return {
          type: type,
          cells: [],
          style: { color: TranslucentBlackColor, size: 0.8 },
        };
      case ConstraintType.Palindrome:
        return {
          type: type,
          lines: [],
          style: { color: PalindromeLineColor, thickness: 0.15 },
        };
      case ConstraintType.Quadruple:
        return { type: type, clues: [], style: { singleLine: !1 } };
      case ConstraintType.Ratio:
        return {
          type: type,
          clues: [],
          negative: [],
          overrideNegativeDifferences: !0,
        };
      case ConstraintType.Renban:
        return {
          type: type,
          lines: [],
          style: { color: RenbanLineColor, thickness: 0.15 },
        };
      case ConstraintType.RegionSumLine:
        return {
          type: type,
          lines: [],
          singleRegionTotals: !1,
          style: { color: RegionSumLineColor, thickness: 0.15 },
        };
      case ConstraintType.Regions: {
        const regions = getDefaultRegionLayout(spec);
        return { type: type, regions: regions || [] };
      }
      case ConstraintType.SandwichSums:
        return { type: type, clues: [], style: { color: "#000000ff" } };
      case ConstraintType.Sequence:
        return {
          type: type,
          lines: [],
          style: { color: GreyLineColor, thickness: 0.15 },
        };
      case ConstraintType.Skyscrapers:
        return { type: type, clues: [], style: { color: "#000000ff" } };
      case ConstraintType.Thermometer:
        return {
          type: type,
          slow: !1,
          thermometers: [],
          style: { color: GreyLineColor, thickness: 0.3, bulbRadius: 0.4 },
        };
      case ConstraintType.Whisper:
        return {
          type: type,
          lines: [],
          minDifference: 5,
          style: { color: WhisperLineColor, thickness: 0.15 },
        };
      case ConstraintType.XSums:
        return { type: type, clues: [], style: { color: "#000000" } };
      case ConstraintType.XV:
        return { type: type, clues: [], negative: [] };
      case ConstraintType.CosmeticLine:
        return {
          type: type,
          lines: [],
          style: { thickness: 0.15, color: CosmeticLineColor },
        };
      case ConstraintType.CosmeticCage:
        return {
          type: type,
          cages: [],
          style: { text: { color: "#000000" }, cage: { color: "#000000" } },
        };
      case ConstraintType.CosmeticSymbol:
        return { type: type, symbols: [] };
      case ConstraintType.SudokuRules:
        return { type: type };
      case ConstraintType.FogLights:
        return { type: type, lightCells: [] };
      case ConstraintType.FogTriggers: {
        const hasFogTriggers = otherConstraints.some(
          (existingConstraint) =>
            existingConstraint.config.type === ConstraintType.FogTriggers &&
            existingConstraint.enabled,
        );
        return {
          type: type,
          patterns: hasFogTriggers ? [] : [CellRelationScope.Self],
          triggers: [],
          effects: [],
          overrides: [],
          editor: { defaultDisabling: !1 },
        };
      }
    }
  }
  function createConstraint({
    id: id = getNextConstraintId(),
    type: type,
    spec: spec,
    otherConstraints: otherConstraints = [],
  }) {
    return {
      id: id,
      name: void 0,
      enabled: !0,
      solverIgnored: !1,
      config: createDefaultConstraintConfig({
        type: type,
        spec: spec,
        otherConstraints: otherConstraints,
      }),
    };
  }
  var PuzzleKind = ((puzzleKinds) => (
    (puzzleKinds.Sudoku = "sudoku"),
    (puzzleKinds.Custom = "custom"),
    puzzleKinds
  ))(PuzzleKind || {});
  (registerConstraintHandler(ConstraintType.Antiking, {
    register: ({ puzzle: puzzle, helpers: helpers }) => {
      for (const cellPair of helpers.geometry.getAllKingsMovePairs())
        if (!puzzle.getCellsSeeEachOther(cellPair)) {
          const componentName = `the anti-king between ${helpers.naming.getCellsDescription(cellPair)}`;
          puzzle.addConstraintComponent(
            new DifferentDigitsComponent(componentName, cellPair),
          );
        }
    },
  }),
    registerConstraintHandler(ConstraintType.Antiknight, {
      register: ({ puzzle: puzzle, helpers: helpers }) => {
        for (const cellPair of helpers.geometry.getAllKnightMovePairs())
          if (!puzzle.getCellsSeeEachOther(cellPair)) {
            const componentName = `the anti-knight between ${helpers.naming.getCellsDescription(cellPair)}`;
            puzzle.addConstraintComponent(
              new DifferentDigitsComponent(componentName, cellPair),
            );
          }
      },
    }),
    registerConstraintHandler(ConstraintType.Arrow, {
      register: registerArrowConstraint,
      cluesProperty: "bulbsWithArrows",
    }));
  function registerArrowConstraint({
    puzzle: puzzle,
    input: input,
    helpers: helpers,
  }) {
    for (const bulbWithArrows of input.bulbsWithArrows) {
      const arrowPaths = bulbWithArrows.arrows.map((arrowWithBulb) =>
          arrowWithBulb.slice(1),
        ),
        singleCellArrows = arrowPaths.filter(
          (arrowPathSingle) => arrowPathSingle.length === 1,
        ),
        multiCellArrows = arrowPaths.filter(
          (arrowPathMulti) => arrowPathMulti.length > 1,
        );
      singleCellArrows.length > 0 &&
        (bulbWithArrows.bulbCells.length === 1
          ? puzzle.addConstraintComponent(
              new SameDigitComponent(
                `the stubby arrow at ${helpers.naming.getCellName(bulbWithArrows.bulbCells[0])}`,
                [
                  ...singleCellArrows.map((stubbyArrow) => stubbyArrow[0]),
                  bulbWithArrows.bulbCells[0],
                ],
              ),
            )
          : multiCellArrows.push(...singleCellArrows));
      const arrowName =
        arrowPaths.length === 1
          ? `the arrow at ${helpers.naming.getCellName(bulbWithArrows.bulbCells[0])}`
          : `the arrows at ${helpers.naming.getCellName(bulbWithArrows.bulbCells[0])}`;
      if (multiCellArrows.length > 0) {
        const bulbCells = bulbWithArrows.bulbCells;
        puzzle.addConstraintComponent(
          new SameSumComponent(arrowName, [
            ...multiCellArrows.map((arrowCells) => ({
              name: `the arrow at ${helpers.naming.getCellName(arrowCells[0])}`,
              cells: arrowCells,
            })),
            {
              name: `the bulb at ${helpers.naming.getCellName(bulbWithArrows.bulbCells[0])}`,
              cells: bulbCells.slice().sort((cellA, cellB) => cellB - cellA),
              asNumber: !0,
            },
          ]),
        );
      }
    }
  }
  registerConstraintHandler(ConstraintType.BetweenLines, {
    register: registerBetweenLinesConstraint,
    cluesProperty: "lines",
  });
  function registerBetweenLinesConstraint({
    puzzle: puzzle,
    input: input,
    helpers: helpers,
  }) {
    for (const line of input.lines) {
      if (line.length < 3) continue;
      const cellsBetweenEnds = helpers.lines.getCellsBetweenLineEnds(line),
        lineEnds = helpers.lines.getLineEnds(line),
        lineName = helpers.naming.getLineName("between-line", line);
      puzzle.addConstraintComponent(
        new BetweenComponent(lineName, lineEnds, cellsBetweenEnds),
      );
    }
  }
  (registerConstraintHandler(ConstraintType.Clone, {
    register({ puzzle: puzzle, input: input, helpers: helpers }) {
      for (const cloneGroup of input.groups) {
        const componentName = `the clones at ${helpers.naming.getCellsDescription(cloneGroup)}`;
        puzzle.addConstraintComponent(
          new SameDigitComponent(componentName, cloneGroup),
        );
      }
    },
    validate({ input: input }) {
      return input.groups.some((cloneGroup) => cloneGroup.length < 2)
        ? {
            type: ValidationSeverity.Warning,
            message: "some marked cells do not have any clones",
          }
        : { type: ValidationSeverity.Valid };
    },
    cluesProperty: "groups",
  }),
    registerConstraintHandler(ConstraintType.CountingCircles, {
      register({ puzzle: puzzle, input: input, helpers: helpers }) {
        const componentName = `the counting circles constraint containing ${helpers.naming.getCellName(input.cells[0])}`;
        puzzle.addConstraintComponent(
          new SelfCountingComponent(componentName, input.cells),
        );
      },
      cluesProperty: "cells",
    }));
  function getSolverEnvironment() {
    return { verboseSolving: verboseSolvingEnabled };
  }
  function logConstraintError({ context: context, error: error }) {
    console.error(error);
  }
  class SolverPuzzleView extends PuzzleAccessorBase {
    constructor(instance, spec, state, helpers) {
      (super(spec, state, helpers), (this.instance = instance));
    }
    getValue(cellId) {
      return this.state.cells[cellId].value;
    }
    hasValue(cellId) {
      return this.state.cells[cellId].value !== void 0;
    }
    getCandidates(cellId) {
      return new SudokuDigitSet(this.state.cells[cellId].candidates);
    }
    getCandidatesBitMask(cellId) {
      return this.state.cells[cellId].candidates;
    }
    getCellsAreFilled(cells) {
      for (const cellId of cells) if (!this.hasValue(cellId)) return !1;
      return !0;
    }
    getFriendlyCandidates(cellId) {
      const friendlyDigits = this.getFriendlyDigitsForCell(cellId);
      return (
        friendlyDigits.intersect(this.getCandidates(cellId)),
        friendlyDigits
      );
    }
    removeCandidateFromCell(digit, cellId) {
      return removeDigitFromCellChange(digit, cellId);
    }
    removeCandidatesFromCell(digitMask, cellId) {
      return removeCandidatesFromCellChange(digitMask, cellId);
    }
    filterCandidatesInCell(digitMask, cellId) {
      return filterCandidatesAtCellChange(digitMask, cellId);
    }
    removeCandidateFromCells(digit, cells) {
      return removeDigitFromCellsChange(digit, cells);
    }
    removeCandidatesFromCells(digitMask, cells) {
      return removeCandidatesFromCellsChange(digitMask, cells);
    }
    filterCandidatesInCells(digitMask, cells) {
      return filterCandidatesAtCellsChange(digitMask, cells);
    }
    removeComponent() {
      return removeComponentChange();
    }
    replaceComponent(component, replacement) {
      return replaceComponentChange(replacement ?? component);
    }
    stop(message, cells) {
      return abortSolverChange(
        message || `unable to satisfy ${this.instance.name}`,
        cells,
      );
    }
  }
  function getCustomConstraintGlobals() {
    return {
      MathUtils: MathUtils,
      Vector2Funcs: Vector2Funcs,
      CombinatoricUtils: CombinatoricUtils,
      ArrayUtils: ArrayUtils,
      SetUtils: SetUtils,
      IterationUtils: IterationUtils,
      SudokuDigitSet: SudokuDigitSet,
      SmallNumberSet: SmallNumberSet,
      DigitSet: SudokuDigitSet,
      DiagonalType: DiagonalType,
      OuterPosition: OuterPosition,
    };
  }
  function runCustomCodeWithGlobals(code, globals) {
    new Function(...Object.keys(globals), code)(...Object.values(globals));
  }
  function compileCustomComponentClass(componentDefinition, customComponents) {
    const escapedName = componentDefinition.name
        .replaceAll("\\", "\\\\")
        .replaceAll("'", "\\'"),
      helpers = createHelpers(puzzleSpec),
      injectedFunctions = {
        getAffectedCells(...affectedCellsArgs) {
          return affectedCellsArgs[0];
        },
        setParams(componentInstance, ...paramArgs) {},
      };
    class CustomComponent extends ConstraintComponent {
      cells;
      constructor(componentName = "", ...constructorArgs) {
        const affectedCells = injectedFunctions.getAffectedCells(
          ...constructorArgs,
        );
        (super(
          componentName ||
            `the custom constraint containing ${helpers.naming.getCellsDescription(affectedCells)}`,
          affectedCells,
        ),
          (this.cells = affectedCells),
          injectedFunctions.setParams(this, ...constructorArgs));
      }
    }
    return (
      runCustomCodeWithGlobals(
        `
    ${componentDefinition.code}

    if (typeof getAffectedCells === 'function') {
      __injectedFunctions.getAffectedCells = getAffectedCells
    }

    if (typeof setParams === 'function') {
      __injectedFunctions.setParams = setParams
    }

    if (typeof initialize === 'function') {
      const superInitialize = __component__.initialize
      __component__.initialize = function*(__input) {
        try {
          yield* initialize(this, __getFacade(this, __input))
          yield* superInitialize.call(this, __input)
        } catch (error) {
          __error({ context: 'Error while initializing custom constraint ${escapedName}', error })
        }
      }
    }
    if (typeof update === 'function') {
      __component__.update = function*(__input) {
        try {
          yield* update(this, __getFacade(this, __input))
        } catch (error) {
          __error({ context: 'Error while updating custom constraint ${escapedName}', error })
        }
      }
    }
    if (typeof validate === 'function') {
      __component__.__defineGetter__('validateDuringSolve', function() { return true })

      __component__.validate = function (__input) {
        const validateWrapper = () => {
          try {
            return validate(this, __getFacade(this, __input))
          } catch (error) {
            __error({ context: 'Error while validating custom constraint ${escapedName}', error })
            return false
          }
        }
        return validateWrapper() ? __VALID : { valid: false, message: \`unable to satisfy \${this.name}\` }
      }
    }`,
        {
          ...getCustomConstraintGlobals(),
          env: getSolverEnvironment(),
          helpers: helpers,
          customComponents: customComponents,
          ...Object.fromEntries(getComponentConstructorsByName()),
          __injectedFunctions: injectedFunctions,
          __component__: CustomComponent.prototype,
          __getFacade: (componentForFacade, solverState) =>
            new SolverPuzzleView(
              componentForFacade,
              puzzleSpec,
              solverState,
              helpers,
            ),
          __VALID: ValidResult,
          __error: logConstraintError,
        },
      ),
      CustomComponent
    );
  }
  function compileCustomComponents(componentDefinitions) {
    const compiledComponents = {};
    for (const componentDefinition of componentDefinitions) {
      const compiledClass = compileCustomComponentClass(
        componentDefinition,
        compiledComponents,
      );
      compiledClass &&
        (compiledComponents[componentDefinition.name] = compiledClass);
    }
    return compiledComponents;
  }
  registerConstraintHandler(ConstraintType.Custom, {
    register: registerCustomConstraint,
  });
  function registerCustomConstraint({
    puzzle: puzzle,
    input: input,
    helpers: helpers,
  }) {
    let compiledComponents;
    try {
      compiledComponents = compileCustomComponents(input.definition.components);
    } catch (compileError) {
      logConstraintError({
        context: `Registering custom components for '${input.definition.name}' failed`,
        error: compileError,
      });
      return;
    }
    try {
      const { backend: backend } = input.definition;
      if (backend.type !== "code") return;
      runCustomCodeWithGlobals(backend.code, {
        ...getCustomConstraintGlobals(),
        env: getSolverEnvironment(),
        puzzle: puzzle,
        sudoku: puzzle,
        input: input.input,
        helpers: helpers,
        ...Object.fromEntries(getComponentConstructorsByName()),
        ...compiledComponents,
      });
    } catch (registerError) {
      logConstraintError({
        context: `Registering custom constraint '${input.definition.name}' failed`,
        error: registerError,
      });
    }
  }
  (registerConstraintHandler(ConstraintType.DiagonalMinus, {
    register: registerDiagonalConstraint,
  }),
    registerConstraintHandler(ConstraintType.DiagonalPlus, {
      register: registerDiagonalConstraint,
    }));
  function registerDiagonalConstraint({
    puzzle: puzzle,
    input: input,
    helpers: helpers,
  }) {
    const isPositiveDiagonal = !(input.type === ConstraintType.DiagonalMinus),
      diagonalName = isPositiveDiagonal
        ? "the positive diagonal"
        : "the negative diagonal",
      diagonalCells = helpers.geometry.getCellsInDiagonal(
        isPositiveDiagonal
          ? DiagonalType.PositiveDiagonal
          : DiagonalType.NegativeDiagonal,
      ),
      houseType = isPositiveDiagonal
        ? HouseType.DiagonalPlus
        : HouseType.DiagonalMinus;
    puzzle.spec.digitCount === puzzle.spec.size.width
      ? puzzle.addConstraintComponent(
          new HouseComponent(diagonalName, [...diagonalCells], houseType),
        )
      : puzzle.addConstraintComponent(
          new DifferentDigitsComponent(diagonalName, [...diagonalCells]),
        );
  }
  function isEdgeClueConstraint(constraint) {
    return EdgeClueConstraintTypes.includes(constraint.config.type);
  }
  function validateEdgeCluesNotObstructed({ puzzle: puzzle, input: input }) {
    const cluedEdges = new Set(input.clues.map((clue) => clue.edge)),
      constraintIndex = puzzle.constraints.findIndex(
        (constraint) => constraint.config === input,
      ),
      laterEdgeConstraints = puzzle.constraints
        .slice(constraintIndex + 1)
        .filter(isEdgeClueConstraint);
    for (const otherConstraint of laterEdgeConstraints)
      if (
        otherConstraint.config.clues.some((otherClue) =>
          cluedEdges.has(otherClue.edge),
        )
      ) {
        const obstructorLabel = {
          [ConstraintType.Difference]: "difference kropki dots",
          [ConstraintType.Ratio]: "ratio kropki dots",
          [ConstraintType.XV]: "X/V clues",
        }[otherConstraint.config.type];
        return {
          type: ValidationSeverity.Warning,
          message: `one or more clues are obstructed by ${obstructorLabel}`,
        };
      }
    return { type: ValidationSeverity.Valid };
  }
  (registerConstraintHandler(ConstraintType.Difference, {
    register({ puzzle: puzzle, input: input, helpers: helpers }) {
      if (input.negative.length > 0)
        for (const edge of helpers.misc.getEdgesForNegativeConstraint(
          input.clues,
        )) {
          const componentName = helpers.naming.getEdgeClueName(
              "negative differences constraint",
              edge,
            ),
            [cellA, cellB] = helpers.geometry.getCellsTouchingEdge(edge);
          puzzle.addConstraintComponent(
            new NegativeDifferenceComponent(
              componentName,
              input.negative,
              cellA,
              cellB,
            ),
          );
        }
      for (const clue of input.clues) {
        const [firstCell, secondCell] = helpers.geometry.getCellsTouchingEdge(
            clue.edge,
          ),
          clueName = helpers.naming.getEdgeClueName("kropki dot", clue.edge);
        puzzle.addConstraintComponent(
          new DifferenceComponent(clueName, clue.value, firstCell, secondCell),
        );
      }
    },
    postRegister({ puzzle: puzzle, input: input, helpers: helpers }) {
      for (const clue of input.clues) {
        const edgeCells = helpers.geometry.getCellsTouchingEdge(clue.edge);
        for (const component of puzzle.getConstraintComponentsAt(edgeCells[0]))
          ((component instanceof NegativeDifferenceComponent &&
            clue.value === 1 &&
            component.cellIds.includes(edgeCells[1]) &&
            component.differences.includes(clue.value)) ||
            (input.overrideNegativeRatios &&
              component instanceof NegativeRatioComponent &&
              component.cellIds.includes(edgeCells[1]))) &&
            puzzle.removeConstraintComponent(component);
      }
    },
    validate: validateEdgeCluesNotObstructed,
    cluesProperty: "clues",
  }),
    registerConstraintHandler(ConstraintType.DifferentValues, {
      register({ puzzle: puzzle, input: input, helpers: helpers }) {
        if (input.cells.length < 2) return;
        const componentName =
          input.cells.length === puzzle.digitCount
            ? `the extra region that includes ${helpers.naming.getCellName(input.cells[0])}`
            : `the set of ${input.cells.length} different cells that includes ${helpers.naming.getCellName(input.cells[0])}`;
        puzzle.addConstraintComponent(
          new DifferentDigitsComponent(componentName, input.cells),
        );
      },
      validate({ input: input, puzzle: puzzle }) {
        const digitCount = puzzle.spec.digitCount;
        return input.cells.length > digitCount
          ? `an extra region cannot be more than ${digitCount} cells large`
          : "";
      },
      cluesProperty: "cells",
    }),
    registerConstraintHandler(ConstraintType.Regions, {
      register({ puzzle: puzzle, input: input }) {
        puzzle.setRegions(input.regions);
      },
      validate: validateRegionsInput,
      priority: -1e3,
    }));
  function validateRegionsInput({ input: input, puzzle: puzzle }) {
    const gridSize = puzzle.spec.size.width;
    if (puzzle.spec.type === PuzzleKind.Custom) return "";
    const regionSizes = createFilledArray(gridSize + 1, 0);
    for (const regionId of input.regions) {
      if (regionId < 0 || regionId >= gridSize)
        return "not all cells are part of a valid region";
      if ((regionSizes[regionId]++, regionSizes[regionId] > gridSize))
        return `there are not ${gridSize} regions of size ${gridSize}`;
    }
    return "";
  }
  (registerConstraintHandler(ConstraintType.DisjointGroups, {
    register({ puzzle: puzzle }) {
      const regions = puzzle.getRegions(),
        regionSize = regions[0].length;
      if (!(regions.length <= 1))
        for (
          let positionIndex = 0;
          positionIndex < regionSize;
          positionIndex++
        ) {
          const groupName = `group ${positionIndex + 1}`,
            groupCells = Array.from(
              { length: regions.length },
              (unusedRegion, regionIndex) =>
                regions[regionIndex][positionIndex],
            );
          puzzle.addConstraintComponent(
            new DifferentDigitsComponent(groupName, groupCells),
          );
        }
    },
    validate({ puzzle: puzzle }) {
      const regionsConstraint = puzzle.constraints.find(
        (constraint) => constraint.config.type === ConstraintType.Regions,
      );
      if (
        !regionsConstraint ||
        validateRegionsInput({
          input: regionsConstraint.config,
          puzzle: puzzle,
        }) !== ""
      )
        return "there must be an active, valid regions constraint.";
      const regionCellGroups = groupCellIdsByRegionId(
        regionsConstraint.config.regions,
      );
      return regionCellGroups.length === 0 ||
        !arraysAreSameLength(...regionCellGroups) ||
        regionCellGroups.length > puzzle.spec.digitCount
        ? "there must be an active, valid regions constraint."
        : "";
    },
  }),
    registerConstraintHandler(ConstraintType.DoubleArrow, {
      register({ puzzle: puzzle, input: input, helpers: helpers }) {
        for (const line of input.lines) {
          if (line.length < 3) continue;
          const middleCells = helpers.lines.getCellsBetweenLineEnds(line),
            endCells = helpers.lines.getLineEnds(line),
            lineName = helpers.naming.getLineName("double arrow", line),
            bulbsName = `the double arrow bulbs ${helpers.naming.getCellsDescription(endCells)}`,
            middleName = helpers.naming.getLineName("double arrow line", line);
          puzzle.addConstraintComponent(
            new SameSumComponent(lineName, [
              { name: bulbsName, cells: endCells },
              { name: middleName, cells: middleCells },
            ]),
          );
        }
      },
      cluesProperty: "lines",
    }));
  function describeDigitGroupsAsText(groups) {
    return groups
      .map((groupMask) => digitsInMask(groupMask).join(""))
      .sort()
      .join(" ");
  }
  function groupsPartitionAllDigits(groups, spec) {
    if (groups.length === 0) return !1;
    const remainingDigits = new DigitsHelper(spec).createFullDigitSet();
    for (const groupMask of groups)
      if (remainingDigits.isSupersetOf(groupMask))
        remainingDigits.subtract(groupMask);
      else return !1;
    return !0;
  }
  function groupsAreParityPair(groups, spec) {
    if (groups.length !== 2) return !1;
    const digitsHelper = new DigitsHelper(spec);
    return (
      groups.includes(+digitsHelper.createEvensDigitSet()) &&
      groups.includes(+digitsHelper.createOddsDigitSet())
    );
  }
  function groupsAreModularClasses(groups, classCount, spec) {
    if (groups.length !== classCount) return !1;
    const classSets = Array.from(groups, () => new SudokuDigitSet());
    for (let digit = spec.minDigit; digit <= spec.maxDigit; digit++)
      classSets[digit % classCount].add(digit);
    return groups.every((groupMask) =>
      classSets.some((classSet) => classSet.valueOf() === groupMask),
    );
  }
  function groupsArePolarityPair(groups, spec) {
    if (groups.length !== 2) return !1;
    const midpoint = (spec.maxDigit + spec.minDigit) / 2,
      digitsHelper = new DigitsHelper(spec),
      lowMask = +digitsHelper.createFilteredDigitSet(
        (digitForLow) => digitForLow < midpoint,
      ),
      highMask = +digitsHelper.createFilteredDigitSet(
        (digitForHigh) => digitForHigh < midpoint,
      );
    return groups.includes(lowMask) && groups.includes(highMask);
  }
  function groupsAreEntropySets(groups, spec) {
    const rangeKey = `${spec.minDigit}_${spec.maxDigit}`,
      groupsText = describeDigitGroupsAsText(groups);
    return [
      "1_6|12 34 56",
      "0_5|01 23 45",
      "1_7|12 345 67",
      "0_6|01 234 56",
      "1_8|12 34 56 78",
      "0_7|01 23 45 67",
      "1_9|123 456 789",
      "0_8|012 345 678",
    ].includes(`${rangeKey}|${groupsText}`);
  }
  function describeDigitGroupKind({
    groups: groups,
    spec: spec,
    short: short,
    adjective: adjective,
  }) {
    return groupsAreParityPair(groups, spec)
      ? short
        ? "parity"
        : "parity (odd/even)"
      : groupsAreModularClasses(groups, 3, spec)
        ? adjective
          ? "3-modular"
          : "modulo-3"
        : groupsAreModularClasses(groups, 4, spec)
          ? adjective
            ? "4-modular"
            : "modulo-4"
          : groupsArePolarityPair(groups, spec)
            ? short
              ? "polarity"
              : "polarity (low/high)"
            : groupsAreEntropySets(groups, spec)
              ? adjective
                ? "entropic"
                : "entropy"
              : groups
                  .map((groupMask) => digitsInMask(groupMask).join(""))
                  .sort()
                  .join("/") || "???";
  }
  function getEntropyLineDisplayName(groups, spec) {
    return `${describeDigitGroupKind({ groups: groups, spec: spec, adjective: !0 })} line`;
  }
  (registerConstraintHandler(ConstraintType.EntropyLines, {
    register({ puzzle: puzzle, input: input, helpers: helpers }) {
      if (input.groups.length === 0) return;
      const lineKindName = getEntropyLineDisplayName(input.groups, puzzle.spec),
        groupCount = input.groups.length;
      for (const line of input.lines) {
        const lineName = `the ${lineKindName} at ${helpers.naming.getCellName(line[0])}`;
        for (
          let startIndex = 0;
          startIndex <= Math.max(0, line.length - groupCount);
          startIndex++
        )
          puzzle.addConstraintComponent(
            new DiverseGroupsComponent(
              lineName,
              input.groups,
              line.slice(startIndex, startIndex + groupCount),
            ),
          );
      }
    },
    validate({ input: input, puzzle: puzzle }) {
      if (input.groups.length === 0) return "no groups are specified";
      if (
        input.groups.length > 2 &&
        !new LineGraph(input.lines).isSimpleLines()
      )
        return "lines must not branch";
      if (!groupsPartitionAllDigits(input.groups, puzzle.spec))
        return "one or more digits belong to multiple groups";
      for (const line of input.lines)
        if (
          line[0] === line.at(-1) &&
          (line.length - 1) % input.groups.length !== 0
        )
          return `all looping lines must be of a length that is a multiple of ${input.groups.length}`;
      return "";
    },
    cluesProperty: "lines",
  }),
    registerConstraintHandler(ConstraintType.Even, {
      register: registerOddEvenConstraint,
      cluesProperty: "cells",
    }),
    registerConstraintHandler(ConstraintType.Odd, {
      register: registerOddEvenConstraint,
      cluesProperty: "cells",
    }));
  function registerOddEvenConstraint({
    puzzle: puzzle,
    input: input,
    helpers: helpers,
  }) {
    const allowedMask = input.type === ConstraintType.Odd ? 682 : 341,
      parityWord = input.type === ConstraintType.Odd ? "odd" : "even";
    for (const cell of input.cells) {
      const componentName = `the ${parityWord} constraint at ${helpers.naming.getCellName(cell)}`;
      puzzle.addConstraintComponent(
        new PredefinedCandidatesComponent(componentName, allowedMask, cell),
      );
    }
  }
  (registerConstraintHandler(ConstraintType.Givens, {
    register: () => {},
    validate(context) {
      const fogLightConstraints = context.puzzle.constraints.filter(
          (lightConstraint) =>
            lightConstraint.config.type === ConstraintType.FogLights,
        ),
        fogTriggerConstraints = context.puzzle.constraints.filter(
          (triggerConstraint) =>
            triggerConstraint.config.type === ConstraintType.FogTriggers,
        );
      if (fogLightConstraints.length + fogTriggerConstraints.length === 0)
        return "";
      const lightCells = new Set(
        fogLightConstraints.flatMap(
          (fogConstraint) => fogConstraint.config.lightCells,
        ),
      );
      return context.puzzle.cells.some(
        (cellState, cellIndex) => cellState.given && !lightCells.has(cellIndex),
      )
        ? {
            type: ValidationSeverity.Info,
            message:
              "when publishing this puzzle, givens will be hidden beneath the fog.",
          }
        : "";
    },
  }),
    registerConstraintHandler(ConstraintType.GlobalEntropy, {
      register({ puzzle: puzzle, input: input, helpers: helpers }) {
        for (const quadCells of helpers.geometry.getAllQuadruples()) {
          const componentName = `the 2x2 at ${helpers.naming.getCellName(quadCells[0])}`;
          puzzle.addConstraintComponent(
            new DiverseGroupsComponent(componentName, input.groups, quadCells),
          );
        }
      },
      validate({ input: input, puzzle: puzzle }) {
        return input.groups.length === 0
          ? "no groups are specified"
          : groupsPartitionAllDigits(input.groups, puzzle.spec)
            ? ""
            : "one or more digits belong to multiple groups";
      },
    }),
    registerConstraintHandler(ConstraintType.RowIndexer, {
      register: registerIndexerConstraint,
      cluesProperty: "cells",
    }),
    registerConstraintHandler(ConstraintType.ColumnIndexer, {
      register: registerIndexerConstraint,
      cluesProperty: "cells",
    }));
  function registerIndexerConstraint({
    puzzle: puzzle,
    input: input,
    helpers: helpers,
  }) {
    const isRowIndexer = input.type === ConstraintType.RowIndexer;
    for (const cell of input.cells) {
      const { x: columnIndex, y: rowIndex } =
          helpers.cellIds.getCoordsFromId(cell),
        indexValue = isRowIndexer ? rowIndex + 1 : columnIndex + 1,
        houseName = isRowIndexer
          ? helpers.naming.getColumnName(columnIndex)
          : helpers.naming.getRowName(rowIndex),
        componentName = `the ${indexValue} indexer in ${houseName}`,
        houseCells = [
          ...(isRowIndexer
            ? helpers.geometry.getCellsInColumn(columnIndex)
            : helpers.geometry.getCellsInRow(rowIndex)),
        ];
      puzzle.addConstraintComponent(
        new IndexComponent(componentName, indexValue, cell, houseCells),
      );
    }
  }
  registerConstraintHandler(ConstraintType.KillerCages, {
    register({ puzzle: puzzle, input: input, helpers: helpers }) {
      for (const cage of input.cages) {
        const cageName = helpers.naming.getCageName(
          cage.value > 0 ? "killer cage" : "cage",
          cage.cells,
        );
        (puzzle.addConstraintComponent(
          new DifferentDigitsComponent(cageName, cage.cells),
        ),
          killerCageSumIsInformative(cage, puzzle.spec) &&
            puzzle.addConstraintComponent(
              new SumComponent(cageName, cage.value, cage.cells),
            ));
      }
    },
    cluesProperty: "cages",
  });
  function killerCageSumIsInformative(cage, spec) {
    return cage.value
      ? cage.cells.length === spec.digitCount
        ? cage.value !== triangularNumber(spec.maxDigit)
        : !0
      : !1;
  }
  (registerConstraintHandler(ConstraintType.LittleKillers, {
    register({ puzzle: puzzle, input: input, helpers: helpers }) {
      for (const clue of input.clues) {
        const {
          value: sumValue,
          outerCell: outerCell,
          diagonal: diagonal,
        } = clue;
        if (sumValue === void 0) continue;
        const clueName = helpers.naming.getOuterClueName(
            `${sumValue} little killer`,
            outerCell,
          ),
          diagonalCells = helpers.geometry.getCellsPointedAtByOuterClue(
            outerCell,
            diagonal,
          );
        puzzle.addConstraintComponent(
          new SumComponent(clueName, sumValue, [...diagonalCells]),
        );
      }
    },
    cluesProperty: "clues",
  }),
    registerConstraintHandler(ConstraintType.LockoutLines, {
      register({ puzzle: puzzle, input: input, helpers: helpers }) {
        for (const line of input.lines) {
          if (line.length < 2) continue;
          const middleCells = helpers.lines.getCellsBetweenLineEnds(line),
            endCells = helpers.lines.getLineEnds(line),
            lineName = helpers.naming.getLineName("lockout-line", line),
            endsName = `the lockout-line ends ${helpers.naming.getCellsDescription(endCells)}`;
          if (middleCells.length > 0) {
            puzzle.addConstraintComponent(
              new NegativeBetweenComponent(lineName, endCells, middleCells),
            );
            for (const middleCell of middleCells)
              (puzzle.addConstraintComponent(
                new DifferentDigitsComponent(lineName, [
                  endCells[0],
                  middleCell,
                ]),
              ),
                puzzle.addConstraintComponent(
                  new DifferentDigitsComponent(lineName, [
                    middleCell,
                    endCells[1],
                  ]),
                ));
          }
          puzzle.addConstraintComponent(
            new MinimumDifferenceComponent(
              endsName,
              Math.floor(puzzle.spec.digitCount / 2),
              endCells[0],
              endCells[1],
            ),
          );
        }
      },
      cluesProperty: "lines",
    }),
    registerConstraintHandler(ConstraintType.LookAndSayCages, {
      register({ puzzle: puzzle, input: input, helpers: helpers }) {
        for (const cage of input.cages) {
          const cageName = helpers.naming.getCageName(
              `“${cage.value}” cage`,
              cage.cells,
            ),
            pairMatches = [...cage.value.matchAll(/\d\d/g)],
            zeroPairs = pairMatches.filter(
              (pairMatch) => pairMatch[0][0] === "0",
            );
          if (zeroPairs.length > 0) {
            const forbiddenSet = SudokuDigitSet.from(
              zeroPairs.map((zeroPair) => Number(zeroPair[0][1])),
            );
            puzzle.addConstraintComponent(
              new ForbiddenCandidatesComponent(
                cageName,
                +forbiddenSet,
                cage.cells,
              ),
            );
          }
          const requiredDigits = [],
            countedPairs = pairMatches.filter(
              (pairEntry) => pairEntry[0][0] !== "0",
            );
          for (const countedPair of countedPairs) {
            const repeatCount = Number(countedPair[0][0]),
              digitValue = Number(countedPair[0][1]);
            for (let repeatIndex = 0; repeatIndex < repeatCount; repeatIndex++)
              requiredDigits.push(digitValue);
            puzzle.addConstraintComponent(
              new MaxDigitCountComponent(
                cageName,
                digitValue,
                repeatCount,
                cage.cells,
              ),
            );
          }
          requiredDigits.length > 0 &&
            puzzle.addConstraintComponent(
              new RequiredDigitsComponent(cageName, requiredDigits, cage.cells),
            );
        }
      },
      validate({ input: input }) {
        return input.cages.some((cage) => {
          if (cage.value.length % 2 === 1) return !0;
          const seenDigits = new Set();
          for (let charIndex = 1; charIndex < cage.value.length; charIndex += 2)
            seenDigits.add(cage.value[charIndex]);
          return seenDigits.size !== cage.value.length / 2;
        })
          ? "one or more cage values are invalid"
          : "";
      },
      cluesProperty: "cages",
    }),
    registerConstraintHandler(ConstraintType.Minimum, {
      register: registerFortressConstraint,
      validate: validateFortressOverlap,
      cluesProperty: "cells",
    }),
    registerConstraintHandler(ConstraintType.Maximum, {
      register: registerFortressConstraint,
      validate: validateFortressOverlap,
      cluesProperty: "cells",
    }));
  function registerFortressConstraint({
    puzzle: puzzle,
    input: input,
    helpers: helpers,
  }) {
    const isMaximum = input.type === ConstraintType.Maximum,
      addGreaterThan = (smallerCell, largerCell) => {
        const smallerName = helpers.naming.getCellName(smallerCell),
          largerName = helpers.naming.getCellName(largerCell);
        puzzle.addConstraintComponent(
          new GreaterThanComponent(
            `${smallerName} < ${largerName}`,
            smallerCell,
            largerCell,
          ),
        );
      };
    for (const fortressCell of input.cells)
      for (const neighborCell of helpers.geometry.getOrthogonallyAdjacentCells(
        fortressCell,
      ))
        input.cells.includes(neighborCell) ||
          (isMaximum
            ? addGreaterThan(neighborCell, fortressCell)
            : addGreaterThan(fortressCell, neighborCell));
  }
  function fortressConstraintsConflict(configA, configB) {
    return (configA.type !== ConstraintType.Minimum &&
      configA.type !== ConstraintType.Maximum) ||
      (configB.type !== ConstraintType.Minimum &&
        configB.type !== ConstraintType.Maximum)
      ? !1
      : configA.type !== configB.type &&
          ArrayUtils.includesSome(configA.cells, configB.cells);
  }
  function validateFortressOverlap({ puzzle: puzzle, input: input }) {
    return puzzle.constraints.some((constraint) =>
      fortressConstraintsConflict(constraint.config, input),
    )
      ? {
          type: ValidationSeverity.Error,
          message: `one or more cells overlap with ‘${input.type === ConstraintType.Minimum ? "maximum" : "minimum"}’ fortress cells`,
        }
      : "";
  }
  (registerConstraintHandler(ConstraintType.Nonconsecutive, {
    priority: -1,
    register({ puzzle: puzzle, helpers: helpers }) {
      for (const domino of helpers.geometry.getAllDominoes()) {
        const componentName = `the nonconsecutive constraint between ${helpers.naming.getCellsDescription(domino)}`;
        puzzle.addConstraintComponent(
          new NegativeDifferenceComponent(
            componentName,
            [1],
            domino[0],
            domino[1],
          ),
        );
      }
    },
  }),
    registerConstraintHandler(ConstraintType.NumberedRooms, {
      register({ puzzle: puzzle, input: input, helpers: helpers }) {
        for (const clue of input.clues) {
          if (clue.value === void 0) continue;
          const clueName = helpers.naming.getOuterClueName(
              `${clue.value} numbered room clue`,
              clue.outerCell,
            ),
            roomCells = [
              ...helpers.geometry.getCellsPointedAtByOuterClue(clue.outerCell),
            ];
          puzzle.addConstraintComponent(
            new IndexComponent(clueName, clue.value, roomCells[0], roomCells),
          );
        }
      },
      cluesProperty: "clues",
    }),
    registerConstraintHandler(ConstraintType.Palindrome, {
      register({ puzzle: puzzle, input: input, helpers: helpers }) {
        for (const line of input.lines) {
          const lineName = helpers.naming.getLineName("palindrome", line);
          for (let headIndex = 0; headIndex < line.length / 2; headIndex++) {
            const tailIndex = line.length - 1 - headIndex;
            puzzle.addConstraintComponent(
              new SameDigitComponent(lineName, [
                line[headIndex],
                line[tailIndex],
              ]),
            );
          }
        }
      },
      cluesProperty: "lines",
    }),
    registerConstraintHandler(ConstraintType.Quadruple, {
      register({ puzzle: puzzle, input: input, helpers: helpers }) {
        for (const clue of input.clues) {
          if (clue.digits.length === 0) continue;
          const cornerCells = [
              ...helpers.geometry.getCellsTouchingCorner(clue.corner),
            ],
            anchorCell = cornerCells.at(-1);
          puzzle.addConstraintComponent(
            new RequiredDigitsComponent(
              `the ${clue.digits} quadruple at ${helpers.naming.getCellName(anchorCell)}`,
              clue.digits,
              cornerCells,
            ),
          );
        }
      },
      cluesProperty: "clues",
    }),
    registerConstraintHandler(ConstraintType.Ratio, {
      register({ puzzle: puzzle, input: input, helpers: helpers }) {
        if (input.negative.length > 0)
          for (const edge of helpers.misc.getEdgesForNegativeConstraint(
            input.clues,
          )) {
            const componentName = helpers.naming.getEdgeClueName(
                "negative ratio constraint",
                edge,
              ),
              [cellA, cellB] = helpers.geometry.getCellsTouchingEdge(edge);
            puzzle.addConstraintComponent(
              new NegativeRatioComponent(
                componentName,
                input.negative,
                cellA,
                cellB,
              ),
            );
          }
        for (const clue of input.clues) {
          const [firstCell, secondCell] = helpers.geometry.getCellsTouchingEdge(
              clue.edge,
            ),
            clueName = helpers.naming.getEdgeClueName("kropki dot", clue.edge);
          puzzle.addConstraintComponent(
            new RatioComponent(clueName, clue.value, firstCell, secondCell),
          );
        }
      },
      postRegister({ puzzle: puzzle, input: input, helpers: helpers }) {
        for (const clue of input.clues) {
          const edgeCells = helpers.geometry.getCellsTouchingEdge(clue.edge);
          if (input.overrideNegativeDifferences)
            for (const component of puzzle.getConstraintComponentsAt(
              edgeCells[0],
            ))
              component.cellIds.includes(edgeCells[1]) &&
                ratioClueSupersedesNegativeDifference(
                  puzzle.spec.maxDigit,
                  clue.value,
                  component,
                ) &&
                puzzle.removeConstraintComponent(component);
        }
      },
      validate: validateEdgeCluesNotObstructed,
      cluesProperty: "clues",
    }));
  function ratioClueSupersedesNegativeDifference(maxDigit, ratio, component) {
    if (!(component instanceof NegativeDifferenceComponent)) return !1;
    for (let multiplier = 1; multiplier <= maxDigit / ratio; multiplier++)
      if (component.differences.includes(multiplier * (ratio - 1))) return !0;
    return !1;
  }
  (registerConstraintHandler(ConstraintType.RegionSumLine, {
    register({ puzzle: puzzle, input: input, helpers: helpers }) {
      if (puzzle.hasRegions())
        if (input.singleRegionTotals)
          for (const lineCells of new LineGraph(
            input.lines,
          ).getConnectedPointSets()) {
            const regionParts = [];
            for (const [
              regionIndex,
              regionCells,
            ] of helpers.geometry.getSubsetsPerRegion(lineCells))
              regionParts.push({
                name: `the part of the region sum line in region ${regionIndex + 1}`,
                cells: regionCells,
              });
            if (regionParts.length <= 1) continue;
            const lineName = helpers.naming.getBranchingLineName(
              "region sum line",
              regionParts[0].cells,
            );
            puzzle.addConstraintComponent(
              new SameSumComponent(lineName, regionParts),
            );
          }
        else
          for (const lineComponent of new LineGraph(
            input.lines,
          ).getAllComponents()) {
            const allPoints = lineComponent.getPoints();
            for (const edge of lineComponent.getEdges())
              puzzle.getRegion(edge[0]) !== puzzle.getRegion(edge[1]) &&
                lineComponent.removeEdge(edge[0], edge[1]);
            const regionParts = [];
            for (const subComponent of lineComponent.getAllComponents()) {
              const subPoints = subComponent.getPoints(),
                regionIndex = puzzle.getRegion(subPoints[0]);
              regionParts.push({
                name: `the part of the region sum line in region ${regionIndex + 1}`,
                cells: subPoints,
              });
            }
            for (const point of allPoints)
              lineComponent.hasPoint(point) ||
                regionParts.push({
                  name: `${helpers.naming.getCellName(point)} of the region sum line`,
                  cells: [point],
                });
            if (regionParts.length <= 1) continue;
            const lineName = helpers.naming.getBranchingLineName(
              "region sum line",
              regionParts[0].cells,
            );
            puzzle.addConstraintComponent(
              new SameSumComponent(lineName, regionParts),
            );
          }
    },
    validate({ puzzle: puzzle }) {
      const regionsConstraint = puzzle.constraints.find(
        (constraint) => constraint.config.type === ConstraintType.Regions,
      );
      return !regionsConstraint ||
        validateRegionsInput({
          input: regionsConstraint.config,
          puzzle: puzzle,
        }) !== ""
        ? "there must be an active, valid regions constraint."
        : "";
    },
    cluesProperty: "lines",
  }),
    registerConstraintHandler(ConstraintType.Renban, {
      register({ puzzle: puzzle, input: input, helpers: helpers }) {
        const lines = input.lines,
          cellGroups = helpers.misc.getCellGroupsFromLines(lines);
        for (const cellGroup of cellGroups) {
          const lineName = helpers.naming.getBranchingLineName(
            "renban line",
            cellGroup,
          );
          puzzle.addConstraintComponent(
            new ConsecutiveDigitsSetComponent(lineName, cellGroup),
          );
        }
      },
      cluesProperty: "lines",
    }),
    registerConstraintHandler(ConstraintType.SandwichSums, {
      register({ puzzle: puzzle, input: input, helpers: helpers }) {
        for (const clue of input.clues) {
          if (clue.value === void 0) continue;
          const clueName = helpers.naming.getOuterClueName(
            `${clue.value} sandwich sum`,
            clue.outerCell,
          );
          puzzle.addConstraintComponent(
            new SandwichSumComponent(
              clueName,
              clue.value,
              [puzzle.minDigit, puzzle.maxDigit],
              [
                ...helpers.geometry.getCellsPointedAtByOuterClue(
                  clue.outerCell,
                ),
              ],
            ),
          );
        }
      },
      validate({ input: input, puzzle: puzzle }) {
        for (const clue of input.clues)
          if (
            clue.value !== void 0 &&
            !isPossibleSandwichSum(clue.value, puzzle.spec)
          )
            return `${clue.value} is not a valid sandwich sum value`;
        return "";
      },
      cluesProperty: "clues",
    }));
  const ImpossibleSandwichSumsByDigitRange = {
    "1_4": [1, 4, 6, 7, 8, 9, 10],
    "1_5": [1, 8, 10, 11, 12, 13, 14, 15],
    "1_6": [1, 13, 15, 16, 17, 18, 19, 20, 21],
    "1_7": [1, 19, 21, 22, 23, 24, 25, 26, 27, 28],
    "1_8": [1, 26, 28, 29, 30, 31, 32, 33, 34, 35, 36],
    "1_9": [1, 34, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45],
  };
  function isPossibleSandwichSum(sumValue, spec) {
    const rangeKey = `${spec.minDigit}_${spec.maxDigit}`;
    return rangeKey in ImpossibleSandwichSumsByDigitRange
      ? !ImpossibleSandwichSumsByDigitRange[rangeKey].includes(sumValue)
      : !0;
  }
  (registerConstraintHandler(ConstraintType.Sequence, {
    register({ puzzle: puzzle, input: input, helpers: helpers }) {
      for (const lineCells of input.lines) {
        if (lineCells.length < 3) continue;
        const lineName = helpers.naming.getLineName("sequence line", lineCells);
        puzzle.addConstraintComponent(
          new SequenceComponent(lineName, lineCells),
        );
      }
    },
    cluesProperty: "lines",
  }),
    registerConstraintHandler(ConstraintType.Skyscrapers, {
      register({ puzzle: puzzle, input: input, helpers: helpers }) {
        for (const clue of input.clues) {
          if (clue.value === void 0) continue;
          const clueName = helpers.naming.getOuterClueName(
            `${clue.value} skyscraper`,
            clue.outerCell,
          );
          puzzle.addConstraintComponent(
            new SkyscraperComponent(clueName, clue.value, [
              ...helpers.geometry.getCellsPointedAtByOuterClue(clue.outerCell),
            ]),
          );
        }
      },
      cluesProperty: "clues",
    }),
    registerConstraintHandler(ConstraintType.SudokuRules, {
      register: ({ puzzle: puzzle, helpers: helpers }) => {
        const { width: width, height: height } = puzzle,
          { digitCount: digitCount } = puzzle;
        for (let rowIndex = 0; rowIndex < height; rowIndex++) {
          const rowName = `row ${rowIndex + 1}`,
            rowCells = [...helpers.geometry.getCellsInRow(rowIndex)];
          digitCount === width
            ? puzzle.addConstraintComponent(
                new HouseComponent(rowName, rowCells, HouseType.Row),
              )
            : puzzle.addConstraintComponent(
                new DifferentDigitsComponent(rowName, rowCells),
              );
        }
        for (let columnIndex = 0; columnIndex < width; columnIndex++) {
          const columnName = `column ${columnIndex + 1}`,
            columnCells = [...helpers.geometry.getCellsInColumn(columnIndex)];
          digitCount === height
            ? puzzle.addConstraintComponent(
                new HouseComponent(columnName, columnCells, HouseType.Column),
              )
            : puzzle.addConstraintComponent(
                new DifferentDigitsComponent(columnName, columnCells),
              );
        }
      },
      priority: -999999,
    }));
  class DirectedLineGraph {
    points = new Set();
    pointsAfter = new Map();
    pointsBefore = new Map();
    constructor(lines = []) {
      for (const line of lines) this.addLine(line);
    }
    addLine(line) {
      for (let index = 0; index < line.length - 1; index++)
        this.addEdge(line[index], line[index + 1]);
      return this;
    }
    addEdge(fromPoint, toPoint) {
      return (
        (fromPoint = internStructuredValue(fromPoint)),
        (toPoint = internStructuredValue(toPoint)),
        this.pointsAfter.has(fromPoint) ||
          this.pointsAfter.set(fromPoint, new Set()),
        this.pointsBefore.has(toPoint) ||
          this.pointsBefore.set(toPoint, new Set()),
        this.pointsAfter.get(fromPoint).add(toPoint),
        this.pointsBefore.get(toPoint).add(fromPoint),
        this.points.add(fromPoint),
        this.points.add(toPoint),
        this
      );
    }
    removeEdge(fromPoint, toPoint) {
      return (
        (fromPoint = internStructuredValue(fromPoint)),
        (toPoint = internStructuredValue(toPoint)),
        this.pointsAfter.get(fromPoint)?.delete(toPoint),
        this.pointsAfter.get(fromPoint)?.size === 0 &&
          this.pointsAfter.delete(fromPoint),
        this.pointsBefore.get(toPoint)?.delete(fromPoint),
        this.pointsBefore.get(toPoint)?.size === 0 &&
          this.pointsBefore.delete(toPoint),
        !this.pointsAfter.get(fromPoint)?.size &&
          !this.pointsBefore.get(fromPoint)?.size &&
          this.points.delete(fromPoint),
        !this.pointsAfter.get(toPoint)?.size &&
          !this.pointsBefore.get(toPoint)?.size &&
          this.points.delete(toPoint),
        this
      );
    }
    removePoint(point) {
      if (((point = internStructuredValue(point)), !this.points.has(point)))
        return this;
      if (this.pointsAfter.has(point))
        for (const afterPoint of this.pointsAfter.get(point))
          this.removeEdge(point, afterPoint);
      if (this.pointsBefore.has(point))
        for (const beforePoint of this.pointsBefore.get(point))
          this.removeEdge(beforePoint, point);
      return this;
    }
    hasEdge(fromPoint, toPoint) {
      return (
        (fromPoint = internStructuredValue(fromPoint)),
        (toPoint = internStructuredValue(toPoint)),
        !!this.pointsAfter.get(fromPoint)?.has(toPoint)
      );
    }
    hasPoint(point) {
      return ((point = internStructuredValue(point)), this.points.has(point));
    }
    getPoints() {
      return [...this.points];
    }
    getPointsBefore(point) {
      return this.pointsBefore.get(point) || new Set();
    }
    getPointsAfter(point) {
      return this.pointsAfter.get(point) || new Set();
    }
    getPointCount() {
      return this.points.size;
    }
    isEmpty() {
      return this.points.size === 0;
    }
    *getEdges() {
      for (const [fromPoint, afterPoints] of this.pointsAfter)
        for (const toPoint of afterPoints) yield [fromPoint, toPoint];
    }
    hasMergePoints() {
      for (const beforePoints of this.pointsBefore.values())
        if (beforePoints.size > 1) return !0;
      return !1;
    }
    hasBranchPoints() {
      for (const afterPoints of this.pointsAfter.values())
        if (afterPoints.size > 1) return !0;
      return !1;
    }
    hasCycles() {
      const visited = new Set(),
        inStack = new Set(),
        visit = (point) => {
          if (!visited.has(point)) {
            (visited.add(point), inStack.add(point));
            const afterPoints = this.pointsAfter.get(point);
            if (afterPoints) {
              for (const nextPoint of afterPoints)
                if (
                  (!visited.has(nextPoint) && visit(nextPoint)) ||
                  inStack.has(nextPoint)
                )
                  return !0;
            }
          }
          return (inStack.delete(point), !1);
        };
      for (const startPoint of this.getPoints())
        if (!visited.has(startPoint) && visit(startPoint)) return !0;
      return !1;
    }
    getComponentsContainingPoints(points) {
      points = [...points].map((point) => internStructuredValue(point));
      const remaining = new Set(points),
        components = [];
      for (; remaining.size > 0;) {
        const seedPoint = takeOneFromSet(remaining),
          componentPoints = [...this.getPointsConnectedTo(seedPoint)];
        (deleteAllFromSet(remaining, componentPoints),
          components.push(componentPoints));
      }
      const subGraph = new DirectedLineGraph();
      for (const component of components)
        for (const fromPoint of component)
          if (this.pointsAfter.has(fromPoint))
            for (const toPoint of this.pointsAfter.get(fromPoint))
              subGraph.addEdge(fromPoint, toPoint);
      return subGraph;
    }
    getPointsConnectedTo(startPoint) {
      startPoint = internStructuredValue(startPoint);
      const connected = new Set(),
        walkBackward = () => {
          const backwardQueue = new Set([startPoint]);
          for (; backwardQueue.size > 0;) {
            const backwardPoint = takeOneFromSet(backwardQueue);
            if (
              !connected.has(backwardPoint) &&
              (connected.add(backwardPoint),
              this.pointsBefore.has(backwardPoint))
            )
              for (const beforePoint of this.pointsBefore.get(backwardPoint))
                backwardQueue.add(beforePoint);
          }
        },
        walkForward = () => {
          const forwardQueue = new Set([startPoint]);
          for (; forwardQueue.size > 0;) {
            const forwardPoint = takeOneFromSet(forwardQueue);
            if (
              !connected.has(forwardPoint) &&
              (connected.add(forwardPoint), this.pointsAfter.has(forwardPoint))
            )
              for (const afterPoint of this.pointsAfter.get(forwardPoint))
                forwardQueue.add(afterPoint);
          }
        };
      return (walkBackward(), walkForward(), connected);
    }
    toArrays() {
      const graph = this.clone(),
        pickStartPoint = () => {
          for (const candidatePoint of graph.pointsAfter.keys())
            if (
              !graph.pointsBefore.get(candidatePoint) ||
              graph.pointsBefore.get(candidatePoint)
            )
              return candidatePoint;
          return getFirstOfIterable(graph.pointsAfter.keys());
        };
      let stepCount = 0;
      function takePath() {
        const visited = new Set(),
          path = [];
        let currentPoint = pickStartPoint();
        for (;;) {
          if ((stepCount++, stepCount > 1e3))
            throw new Error("This should never happen");
          if ((path.push(currentPoint), visited.has(currentPoint))) return path;
          visited.add(currentPoint);
          const afterPoints = graph.pointsAfter.get(currentPoint),
            nextPoint = afterPoints ? getFirstOfIterable(afterPoints) : void 0;
          if (nextPoint === void 0) return path;
          (graph.removeEdge(currentPoint, nextPoint),
            (currentPoint = nextPoint));
        }
      }
      const paths = [];
      for (; graph.getPointCount() > 0;) paths.push(takePath());
      return paths;
    }
    clone() {
      return new DirectedLineGraph(this.getEdges());
    }
  }
  registerConstraintHandler(ConstraintType.Thermometer, {
    register({ puzzle: puzzle, input: input, helpers: helpers }) {
      for (const thermometer of input.thermometers)
        for (let index = 0; index < thermometer.length - 1; index++) {
          const cellName = helpers.naming.getCellName(thermometer[index]),
            nextCellName = helpers.naming.getCellName(thermometer[index + 1]);
          if (input.slow) {
            const slowName = `${cellName} <= ${nextCellName}`;
            puzzle.addConstraintComponent(
              new GreaterThanOrEqualsComponent(
                slowName,
                thermometer[index],
                thermometer[index + 1],
              ),
            );
          } else {
            const strictName = `${cellName} < ${nextCellName}`;
            puzzle.addConstraintComponent(
              new GreaterThanComponent(
                strictName,
                thermometer[index],
                thermometer[index + 1],
              ),
            );
          }
        }
      if (!input.slow) {
        const thermoGraph = new DirectedLineGraph(input.thermometers);
        for (const pathCells of getAllPathsThroughDirectedGraph(thermoGraph)) {
          if (puzzle.getCellsSeeEachOther(pathCells)) continue;
          const thermoName = `the thermometer starting at ${helpers.naming.getCellName(pathCells[0])} and ending at ${helpers.naming.getCellName(pathCells.at(-1))}`;
          puzzle.addConstraintComponent(
            new DifferentDigitsComponent(thermoName, pathCells),
          );
        }
      }
    },
    cluesProperty: "thermometers",
  });
  function getAllPathsThroughDirectedGraph(graph) {
    if (graph.hasCycles()) return [];
    const paths = [];
    function walk(point, path) {
      const afterPoints = graph.getPointsAfter(point);
      if (afterPoints.size === 0) {
        paths.push(path.slice());
        return;
      }
      for (const nextPoint of afterPoints)
        (path.push(nextPoint), walk(nextPoint, path), path.pop());
    }
    for (const startPoint of graph.getPoints())
      graph.getPointsBefore(startPoint).size || walk(startPoint, [startPoint]);
    return paths;
  }
  (registerConstraintHandler(ConstraintType.Whisper, {
    register({ puzzle: puzzle, input: input, helpers: helpers }) {
      for (const [cellA, cellB] of helpers.lines.getAllPairsAlongLines(
        input.lines,
      )) {
        const componentName = `the minimum difference of ${input.minDifference} between ${helpers.naming.getCellsDescription([cellA, cellB])}`;
        puzzle.addConstraintComponent(
          new MinimumDifferenceComponent(
            componentName,
            input.minDifference,
            cellA,
            cellB,
          ),
        );
      }
    },
    cluesProperty: "lines",
  }),
    registerConstraintHandler(ConstraintType.XSums, {
      register({ puzzle: puzzle, input: input, helpers: helpers }) {
        for (const clue of input.clues) {
          if (clue.value === void 0) continue;
          const clueName = helpers.naming.getOuterClueName(
              `${clue.value} X-sum`,
              clue.outerCell,
            ),
            pointedCells = [
              ...helpers.geometry.getCellsPointedAtByOuterClue(
                clue.outerCell,
                clue.diagonal,
              ),
            ];
          puzzle.addConstraintComponent(
            new XSumComponent(
              clueName,
              clue.value,
              pointedCells[0],
              pointedCells,
            ),
          );
        }
      },
      validate({ input: input, puzzle: puzzle }) {
        for (const clue of input.clues)
          if (
            clue.value !== void 0 &&
            !isPossibleXSumValue(clue.value, puzzle.spec)
          )
            return `${clue.value} is not a valid X-sum value`;
        return "";
      },
      cluesProperty: "clues",
    }));
  const ImpossibleXSumValuesByMaxDigit = {
    4: [2, 4, 7],
    5: [2, 4, 11],
    6: [2, 4],
    7: [2, 4],
    8: [2, 4],
    9: [2, 4],
  };
  function isPossibleXSumValue(xSumValue, spec) {
    return spec.type === PuzzleKind.Sudoku
      ? !ImpossibleXSumValuesByMaxDigit[spec.maxDigit].includes(xSumValue)
      : !0;
  }
  registerConstraintHandler(ConstraintType.XV, {
    register({ puzzle: puzzle, input: input, helpers: helpers }) {
      if (input.negative.length > 0) {
        const negativeName = "negative XV pair";
        for (const edge of helpers.misc.getEdgesForNegativeConstraint(
          input.clues,
        )) {
          const edgeCells = helpers.geometry.getCellsTouchingEdge(edge);
          puzzle.addConstraintComponent(
            new NegativeSumComponent(negativeName, input.negative, edgeCells),
          );
        }
      }
      for (const clue of input.clues) {
        if (clue.value !== 10 && clue.value !== 5) continue;
        const clueCells = helpers.geometry.getCellsTouchingEdge(clue.edge),
          clueName = helpers.naming.getEdgeClueNameFromDomino(
            `${clue.value === 10 ? "X" : "V"} pair`,
            clueCells,
          );
        puzzle.addConstraintComponent(
          new SumComponent(clueName, clue.value, clueCells),
        );
      }
    },
    validate: validateEdgeCluesNotObstructed,
    cluesProperty: "clues",
  });
  function buildSolverStateFromPuzzle({
    spec: spec,
    constraints: constraints,
  }) {
    setPuzzleSpec(spec);
    const state = SolverState.create();
    return (
      spec.type === PuzzleKind.Sudoku &&
        (constraints = [
          createConstraint({ type: ConstraintType.SudokuRules, spec: spec }),
        ].concat(constraints)),
      constraintHandlerRegistry.setupPuzzle(spec, state, constraints),
      state
    );
  }
  onmessage = (event) => {
    const message = event.data;
    switch (message.type) {
      case "start":
        handleStartMessage(message);
        break;
      case "step":
        handleStepMessage();
        break;
      case "findNext":
        handleFindNextMessage();
        break;
      case "findAll":
        handleFindAllMessage();
        break;
    }
  };
  let initialGridSnapshot, activeSolver, solutionIterator;
  function applyInitialGridToState(state, gridBuffer) {
    for (let cellIndex = 0; cellIndex < state.cells.length; cellIndex++)
      if (gridBuffer[cellIndex * 2] !== EmptyValueSentinel) {
        const setResult = state.setValueAtCell(
          gridBuffer[cellIndex * 2],
          cellIndex,
          !1,
        );
        if (setResult.type === "failed") return setResult;
      } else if (gridBuffer[cellIndex * 2 + 1]) {
        const filterResult = state.filterCandidatesAtCell(
          gridBuffer[cellIndex * 2 + 1],
          cellIndex,
        );
        if (filterResult.type === "failed") return filterResult;
      }
    let mergedResult = UnchangedResult;
    for (const component of state.getConstraintComponents())
      for (const initResult of state.initializeComponent(component))
        if (
          ((mergedResult = mergeDeductionResults(mergedResult, initResult)),
          initResult.type === "failed")
        )
          return initResult;
    const validateResult = state.updateConstraintsAndValidate();
    return (
      (mergedResult = mergeDeductionResults(mergedResult, validateResult)),
      mergedResult.type === "failed"
        ? mergedResult
        : { changed: mergedResult.type === "changed" }
    );
  }
  async function handleStartMessage({
    spec: spec,
    grid: grid,
    constraints: constraints,
    strategy: strategy,
    verbose: verbose,
  }) {
    (verbose || disableVerboseSolving(), (initialGridSnapshot = grid));
    const state = buildSolverStateFromPuzzle({
        spec: spec,
        constraints: constraints,
      }),
      initResult = applyInitialGridToState(state, grid);
    if (!("changed" in initResult)) {
      postMessage({ type: "init", changed: !1, error: initResult.message });
      return;
    }
    ((activeSolver = new Solver(state)),
      spec.type === PuzzleKind.Sudoku
        ? new StandardLogicStepsGenerator(strategy).setLogicSteps(activeSolver)
        : spec.type === PuzzleKind.Custom &&
          new CustomLogicStepsGenerator(strategy).setLogicSteps(activeSolver));
    const cellsBuffer = serializeCellsToBuffer(state.cells);
    postMessage(
      { type: "init", changed: initResult.changed, sudoku: cellsBuffer },
      [cellsBuffer.buffer],
    );
  }
  function handleStepMessage() {
    if (!activeSolver) {
      postMessage({ type: "error" });
      return;
    }
    const stepResult = activeSolver.singleLogicStep();
    ((stepResult.sudokuData = serializeCellsToBuffer(activeSolver.state.cells)),
      postMessage({ type: "update", ...stepResult }, [
        stepResult.sudokuData.buffer,
      ]));
  }
  function handleFindNextMessage() {
    if (!activeSolver) {
      postMessage({ type: "error" });
      return;
    }
    solutionIterator || (solutionIterator = activeSolver.findSolutions());
    let solutionData;
    ((solutionData = solutionIterator.next().value),
      solutionData
        ? postMessage(
            {
              type: "update",
              changed: initialGridSnapshot.some(
                (initialValue, index) => solutionData[index] !== initialValue,
              ),
              valid: !0,
              sudokuData: solutionData,
            },
            [solutionData.buffer],
          )
        : postMessage({
            type: "update",
            changed: !1,
            valid:
              activeSolver.state.isSolved() &&
              activeSolver.state.validate().valid,
          }));
  }
  function handleFindAllMessage() {
    if (!activeSolver) {
      postMessage({ type: "error" });
      return;
    }
    solutionIterator || (solutionIterator = activeSolver.findSolutions());
    for (const solutionData of solutionIterator)
      postMessage(
        { type: "update", changed: !0, valid: !0, sudokuData: solutionData },
        [solutionData.buffer],
      );
    postMessage({ type: "update", changed: !1, valid: !0 }, []);
  }
})();
