/* eslint-disable no-unused-vars -- setParams/update/getAffectedCells/validate are the component API SudokuMaker calls by name, not dead code */
//! A drop-in replacement for the built-in RequiredDigits, filtered to full
//! strength. Same constructor as the built-in:
//!
//!   puzzle.addConstraintComponent(new RequiredDigitsGacComponent(name, values, cells))
//!
//! Every digit of `values` must take a cell of `cells` of its own; a digit
//! listed twice wants two cells.
//!
//! What the built-in does instead (bundle.claude.js:3234, read in
//! docs/research/bundle-api-reference.md:2648): its `update` subtracts the
//! FILLED digits from a copy of `values` and filters only when the number of
//! unfilled cells exactly equals the number of unplaced values. It reads no
//! candidates, so it prunes nothing until the group is nearly full, and its
//! `validate` is a greedy strike-off rather than a matching, so it passes
//! states where no assignment exists.
//!
//! The rule. Take any set S of the required digits. Let N(S) be the cells that
//! can still hold a digit of S, and need(S) the number of cells S wants -- its
//! digits' counts added up.
//!   - Fewer cells in N(S) than need(S): the digits do not fit. The branch is
//!     dead.
//!   - Exactly need(S) cells: S's digits fill those cells between them, so no
//!     cell of N(S) may hold a digit from outside S.
//! Checking every S is Hall's condition on the digit side.
//!
//! Sound: in the true solution S's digits sit in need(S) different cells, each
//! able to hold a digit of S, so each lies in N(S). No S pools fewer cells than
//! it needs, and an S that pools exactly need(S) takes all of them.
//!
//! Completeness is measured, not proved. `soundness-harness.mjs` beside this
//! file checks every removal against a brute-force oracle -- pin a candidate,
//! ask whether a system of distinct representatives still exists. On 4- and
//! 6-cell instances, bare, in a house, and with a repeated digit, the two agree
//! exactly across 20,000 random states. Two known gaps: removing a REQUIRED
//! digit from a cell can need the Dulmage-Mendelsohn refinement on maximum
//! matchings, which this does not do, and `repeatsFit` below only half-checks
//! that a repeated digit has cells that may repeat. Both make it weaker, never
//! unsound.
//!
//! Three kinds of bitmask, kept apart by name:
//!   - a DIGIT mask: bit d is digit d, the app's own candidate mask;
//!   - a CELL mask: bit i is cells[i];
//!   - a SUBSET index: bit i is the i-th DISTINCT required digit. There are
//!     2^k subsets over k distinct digits, numbered 1 to 2^k - 1, and counting
//!     up visits each one exactly once.
//!
//! Why counting up is cheap. A subset without its lowest digit is a smaller
//! number, so it has already been visited and its three totals are on record.
//! A subset's totals are that record plus one digit's contribution: subset 7
//! (digits 0,1,2) reads slot 6 (digits 1,2) and folds in digit 0.

//! Cell masks stay inside a 32-bit int. A larger group is a registration
//! mistake, refused at setup where the author sees it.
const MAX_CELLS = 24
//! 2^k subsets per call, k being the number of DISTINCT required digits -- at
//! most 9 on a normal board. The cap keeps a mis-registration from walking
//! 2^30 subsets.
const MAX_DISTINCT = 12

//! Memo, three parallel slots per subset: the cells that can hold one of its
//! digits, how many cells it wants, and which digits it is. Shared between
//! calls, as HouseGacComponent shares `pooledDigitsOf`: the walk fills slot s
//! before anything reads it, and it never yields, so no other component can
//! run in the middle of it. Allocating these per call was measurable
//! (docs/research/required-digits-gac/bench-required-digits.mjs).
const cellsOfSubset = new Int32Array(2 ** MAX_DISTINCT)
const cellsWantedBySubset = new Int32Array(2 ** MAX_DISTINCT)
const digitsOfSubset = new Int32Array(2 ** MAX_DISTINCT)

function getAffectedCells (values, cells) {
  return cells
}

function setParams (instance, values, cells) {
  if (cells.length > MAX_CELLS) {
    throw new RangeError(`${instance.name}: RequiredDigitsGacComponent takes at most ${MAX_CELLS} cells, got ${cells.length}`)
  }
  const wantedCellsByDigit = new Map()
  for (const value of values) {
    wantedCellsByDigit.set(value, (wantedCellsByDigit.get(value) ?? 0) + 1)
  }
  if (wantedCellsByDigit.size > MAX_DISTINCT) {
    throw new RangeError(`${instance.name}: RequiredDigitsGacComponent takes at most ${MAX_DISTINCT} distinct digits, got ${wantedCellsByDigit.size}`)
  }
  if (values.length > cells.length) {
    throw new RangeError(`${instance.name}: ${values.length} required digits cannot fit in ${cells.length} cells`)
  }
  instance.requiredDigits = [...wantedCellsByDigit.keys()]
  instance.cellsWantedByDigit = [...wantedCellsByDigit.values()]
  instance.hasRepeats = instance.cellsWantedByDigit.some(count => count > 1)
  instance.cells = cells
}

// #include ../_shared/bit-helpers.js

function countBits (bits) {
  let counted = bits - ((bits >> 1) & 0x55555555)
  counted = (counted & 0x33333333) + ((counted >> 2) & 0x33333333)
  counted = (counted + (counted >> 4)) & 0x0f0f0f0f
  return Math.imul(counted, 0x01010101) >> 24
}

function cellsHoldingEachDigit (instance, candidates) {
  return instance.requiredDigits.map(digit => {
    const digitBit = 1 << digit
    let cellMask = 0
    for (let position = 0; position < candidates.length; position++) {
      if (candidates[position] & digitBit) cellMask |= 1 << position
    }
    return cellMask
  })
}

//! A digit wanted twice needs two cells the app allows to repeat. Hall counting
//! cannot see that -- to it, two cells of a row are two cells.
function repeatsFit (instance, puzzle, cellsHoldingDigit) {
  for (let index = 0; index < instance.requiredDigits.length; index++) {
    if (instance.cellsWantedByDigit[index] < 2) continue
    const holders = []
    for (let rest = cellsHoldingDigit[index]; rest !== 0; rest = withoutLowestBit(rest)) {
      holders.push(instance.cells[positionOf(lowestBit(rest))])
    }
    //! A necessary condition, not the full one: the holders must be able to
    //! repeat among themselves at all. Two cells that may repeat plus a third
    //! that may not still counts as fitting.
    if (!puzzle.getCellsCanHaveRepeats(holders)) return false
  }
  return true
}

function walkSubsets (instance, cellsHoldingDigit, visit) {
  const requiredDigits = instance.requiredDigits
  const cellsWantedByDigit = instance.cellsWantedByDigit
  const wholeSet = (2 ** requiredDigits.length) - 1
  for (let subset = 1; subset <= wholeSet; subset++) {
    const newestDigit = positionOf(lowestBit(subset))
    const alreadyWalked = withoutLowestBit(subset)
    const cellsInSubset = cellsOfSubset[alreadyWalked] | cellsHoldingDigit[newestDigit]
    const cellsWanted = cellsWantedBySubset[alreadyWalked] + cellsWantedByDigit[newestDigit]
    const digitsInSubset = digitsOfSubset[alreadyWalked] | (1 << requiredDigits[newestDigit])
    cellsOfSubset[subset] = cellsInSubset
    cellsWantedBySubset[subset] = cellsWanted
    digitsOfSubset[subset] = digitsInSubset
    if (visit(cellsInSubset, cellsWanted, digitsInSubset)) return true
  }
  return false
}

function * update (instance, puzzle) {
  const cells = instance.cells
  const candidates = cells.map(cell => puzzle.getCandidatesBitMask(cell))
  const startingCandidates = candidates.slice()
  const cellsHoldingDigit = cellsHoldingEachDigit(instance, candidates)

  if (instance.hasRepeats && !repeatsFit(instance, puzzle, cellsHoldingDigit)) {
    yield puzzle.stop(`${instance.name} cannot repeat a digit it requires twice`, cells)
    return
  }

  //! `cellsHoldingDigit` is read once, before any removal below, so a later
  //! subset is judged on candidates an earlier one may already have shrunk.
  //! That is sound: the N(S) on record is a superset of the live one, so a
  //! subset that looks tight on the record is tight or already unsatisfiable
  //! now, and both justify the filter. It is what makes this one pass rather
  //! than a fixpoint loop; the solver re-runs `update` after the removals.
  const doesNotFit = walkSubsets(instance, cellsHoldingDigit, (cellsInSubset, cellsWanted, digitsInSubset) => {
    const cellsAvailable = countBits(cellsInSubset)
    if (cellsAvailable < cellsWanted) return true
    if (cellsAvailable === cellsWanted) {
      for (let rest = cellsInSubset; rest !== 0; rest = withoutLowestBit(rest)) {
        candidates[positionOf(lowestBit(rest))] &= digitsInSubset
      }
    }
    return false
  })

  if (doesNotFit) {
    yield puzzle.stop(`${instance.name} has nowhere left to put the digits it requires`, cells)
    return
  }

  //! Yield only after the walk: a yield lets the solver run another component,
  //! which would overwrite the shared memo mid-walk.
  for (let position = 0; position < cells.length; position++) {
    if (candidates[position] !== startingCandidates[position]) {
      const removedDigits = startingCandidates[position] & ~candidates[position]
      yield puzzle.removeCandidatesFromCell(new SudokuDigitSet(removedDigits), cells[position])
    }
  }
}

//! The fix for the built-in's greedy `validate`: greedy strike-off accepts
//! states with no valid assignment, Hall's condition does not.
function validate (instance, puzzle) {
  const candidates = instance.cells.map(cell => puzzle.getCandidatesBitMask(cell))
  const cellsHoldingDigit = cellsHoldingEachDigit(instance, candidates)
  if (instance.hasRepeats && !repeatsFit(instance, puzzle, cellsHoldingDigit)) return false
  const doesNotFit = walkSubsets(instance, cellsHoldingDigit,
    (cellsInSubset, cellsWanted) => countBits(cellsInSubset) < cellsWanted)
  return !doesNotFit
}
