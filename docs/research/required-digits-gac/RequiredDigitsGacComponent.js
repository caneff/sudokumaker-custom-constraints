/* eslint-disable no-unused-vars -- setParams/update/getAffectedCells/validate are the component API SudokuMaker calls by name, not dead code */
//! A drop-in replacement for the built-in RequiredDigits, filtered to full
//! strength. Same constructor as the built-in:
//!
//!   puzzle.addConstraintComponent(new RequiredDigitsGacComponent(name, values, cells))
//!
//! Every digit of `values` must be assigned its own cell of `cells`; a digit
//! listed twice wants two cells.
//!
//! What the built-in does instead (bundle.claude.js:3234, read in
//! docs/research/bundle-api-reference.md:2648): its `update` subtracts the
//! FILLED digits from a copy of `values` and only filters when the number of
//! unfilled cells exactly equals the number of unplaced values. It reads no
//! candidates, so it prunes nothing until the group is nearly full, and its
//! `validate` is a greedy strike-off rather than a matching, so it passes
//! states where no assignment exists.
//!
//! The rule here. Take any set S of the required digits, and let N(S) be the
//! cells that can still hold a digit of S. Write need(S) for how many cells S
//! wants -- the sum of its digits' repeat counts.
//!   - |N(S)| < need(S): the digits do not fit. The branch is dead.
//!   - |N(S)| == need(S): the digits of S fill exactly those cells between
//!     them, so no cell of N(S) may hold any digit outside S.
//! Checking every S is Hall's condition on the value side. S of one digit with
//! one candidate cell is the hidden single; S of all the values is the
//! built-in's own rule, run on candidates instead of on fills.
//!
//! Sound: the true solution gives S's digits need(S) distinct cells, and every
//! one of them can hold a digit of S, so it lies in N(S). No group pools fewer
//! cells than it needs, and a group that pools exactly need(S) uses all of them.
//!
//! Completeness. `soundness-harness.mjs` next to this file compares every
//! removal against a brute-force oracle (pin a candidate, ask whether a system
//! of distinct representatives still exists). On 4- and 6-cell instances,
//! bare, in a house, and with a repeated digit, the two agree exactly across
//! 16,000 random states -- no candidate the oracle removes is missed. That is
//! a measurement, not a proof: removing a REQUIRED digit from a cell can in
//! general need the Dulmage-Mendelsohn refinement on maximum matchings, which
//! this does not do. It also does not notice that two copies of one digit need
//! two cells that may hold the same digit beyond the cheap check in
//! `repeatsFit` below, and the walk runs on the candidates it started with
//! (see the staleness note in `update`). The solver re-runs `update` to a
//! fixpoint, so a deduction that only opens after a removal lands next pass.
//!
//! Three kinds of bitmask, kept apart by name:
//!   - a DIGIT mask: bit d is digit d, the app's own candidate mask;
//!   - a SUBSET index: bit i is the i-th DISTINCT required digit, so counting
//!     1 to 2^k-1 visits every S exactly once;
//!   - a CELL mask: bit i is cells[i].

//! Cell masks stay inside a 32-bit int. A larger group is a registration
//! mistake, refused at setup where the author sees it.
const MAX_CELLS = 24
//! 2^k subsets per call; k is the number of DISTINCT required digits, so 9 on
//! a normal board. The cap keeps a mis-registration from walking 2^30 subsets.
const MAX_DISTINCT = 12

function getAffectedCells (values, cells) {
  return cells
}

function setParams (instance, values, cells) {
  if (cells.length > MAX_CELLS) {
    throw new RangeError(`${instance.name}: RequiredDigitsGacComponent takes at most ${MAX_CELLS} cells, got ${cells.length}`)
  }
  //! Distinct required digits, and how many cells each one wants.
  const wanted = new Map()
  for (const value of values) wanted.set(value, (wanted.get(value) ?? 0) + 1)
  if (wanted.size > MAX_DISTINCT) {
    throw new RangeError(`${instance.name}: RequiredDigitsGacComponent takes at most ${MAX_DISTINCT} distinct digits, got ${wanted.size}`)
  }
  if (values.length > cells.length) {
    throw new RangeError(`${instance.name}: ${values.length} required digits cannot fit in ${cells.length} cells`)
  }
  instance.digits = [...wanted.keys()]
  instance.wantedCells = [...wanted.values()]
  instance.hasRepeats = instance.wantedCells.some(count => count > 1)
  instance.cells = cells
}

function lowestBit (bits) {
  return bits & -bits
}

function withoutLowestBit (bits) {
  return bits & (bits - 1)
}

//! The index of a single set bit: 1 -> 0, 2 -> 1, 4 -> 2, ...
function positionOf (singleBit) {
  return 31 - Math.clz32(singleBit)
}

function countBits (bits) {
  let count = 0
  for (; bits !== 0; bits = withoutLowestBit(bits)) count++
  return count
}

//! Per distinct required digit, the cells that can still hold it, as a cell
//! mask. A placed cell has one candidate left, so it shows up for that digit
//! alone: placements need no pass of their own.
function cellsHoldingEachDigit (instance, candidates) {
  return instance.digits.map(digit => {
    const digitBit = 1 << digit
    let cellMask = 0
    for (let position = 0; position < candidates.length; position++) {
      if (candidates[position] & digitBit) cellMask |= 1 << position
    }
    return cellMask
  })
}

//! Walk every subset S of the distinct required digits, lowest digit last in.
//! `visit(cellsInS, needOfS, digitsInS)` returns a string to stop the branch,
//! or nothing to carry on. The three memo arrays are the same trick as
//! HouseGacComponent: a subset without its lowest digit is a smaller number,
//! so it has already been visited and its totals are on record.
function walkSubsets (instance, cellsHoldingDigit, visit) {
  const wholeSet = (2 ** instance.digits.length) - 1
  const cellsOf = new Int32Array(wholeSet + 1)
  const neededBy = new Int32Array(wholeSet + 1)
  const digitsOf = new Int32Array(wholeSet + 1)

  for (let subset = 1; subset <= wholeSet; subset++) {
    const newestDigitBit = lowestBit(subset)
    const newestIndex = positionOf(newestDigitBit)
    const rest = withoutLowestBit(subset)

    const cellsInSubset = cellsOf[rest] | cellsHoldingDigit[newestIndex]
    const neededBySubset = neededBy[rest] + instance.wantedCells[newestIndex]
    const digitsInSubset = digitsOf[rest] | (1 << instance.digits[newestIndex])
    cellsOf[subset] = cellsInSubset
    neededBy[subset] = neededBySubset
    digitsOf[subset] = digitsInSubset

    const failure = visit(cellsInSubset, neededBySubset, digitsInSubset)
    if (failure !== undefined) return failure
  }
  return undefined
}

//! A digit wanted twice needs two cells that the app allows to repeat. Hall
//! counting cannot see that: to it, two cells of a row are two cells. Asked of
//! the puzzle rather than assumed, and only when some digit actually repeats.
function repeatsFit (instance, puzzle, cellsHoldingDigit) {
  for (let index = 0; index < instance.digits.length; index++) {
    if (instance.wantedCells[index] < 2) continue
    const holders = []
    for (let rest = cellsHoldingDigit[index]; rest !== 0; rest = withoutLowestBit(rest)) {
      holders.push(instance.cells[positionOf(lowestBit(rest))])
    }
    //! Cheap necessary condition, not the full one: the holders must be able to
    //! repeat among themselves at all. Two cells that may repeat and a third
    //! that may not is still counted as fitting.
    if (!puzzle.getCellsCanHaveRepeats(holders)) return false
  }
  return true
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

  //! `cellsHoldingDigit` is built once, before any removal below, so a later
  //! subset can be judged on candidates that have already shrunk. That is
  //! sound: the N(S) on record is a superset of the live one, so a subset that
  //! looks tight on the record is tight or already unsatisfiable now, and both
  //! justify the filter. It is what makes this one pass and not a fixpoint
  //! loop; the solver re-runs `update` after the removals anyway.
  const failure = walkSubsets(instance, cellsHoldingDigit, (cellsInSubset, neededBySubset, digitsInSubset) => {
    const holderCount = countBits(cellsInSubset)
    if (holderCount < neededBySubset) {
      return `${instance.name} has nowhere left to put the digits it requires`
    }
    if (holderCount === neededBySubset) {
      //! Those cells are used up by those digits: nothing else may sit there.
      for (let rest = cellsInSubset; rest !== 0; rest = withoutLowestBit(rest)) {
        candidates[positionOf(lowestBit(rest))] &= digitsInSubset
      }
    }
    return undefined
  })

  if (failure !== undefined) {
    //! puzzle.stop fails the search node being tried, so the solver backs up
    //! and tries the next candidate elsewhere on the board.
    yield puzzle.stop(failure, cells)
    return
  }

  //! Hand the removals to the app, one change per cell that shrank. The walk
  //! only clears bits, so the snapshot minus the working mask is the whole
  //! difference. Yielding after the walk and not inside it keeps the walk
  //! reading one consistent board: a yield lets the solver run other updates.
  for (let position = 0; position < cells.length; position++) {
    if (candidates[position] !== startingCandidates[position]) {
      const removedDigits = startingCandidates[position] & ~candidates[position]
      yield puzzle.removeCandidatesFromCell(new SudokuDigitSet(removedDigits), cells[position])
    }
  }
}

//! Backstop, and the fix for the built-in's greedy `validate`: greedy
//! strike-off accepts states with no valid assignment, Hall's condition does
//! not. Same walk, failure test only, no removals.
function validate (instance, puzzle) {
  const candidates = instance.cells.map(cell => puzzle.getCandidatesBitMask(cell))
  const cellsHoldingDigit = cellsHoldingEachDigit(instance, candidates)
  if (instance.hasRepeats && !repeatsFit(instance, puzzle, cellsHoldingDigit)) return false
  const failure = walkSubsets(instance, cellsHoldingDigit, (cellsInSubset, neededBySubset) =>
    countBits(cellsInSubset) < neededBySubset ? 'no' : undefined)
  return failure === undefined
}
