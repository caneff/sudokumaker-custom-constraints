/* eslint-disable no-unused-vars -- setParams/update/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! All-different at full strength (generalized arc consistency) over one house
//! of at most 9 cells, one instance per house.
//!
//! A candidate survives only if some filling of the whole house with different
//! digits uses it. The app's own `HouseComponent` and `DifferentDigitsComponent`
//! stop short of that: neither finds a Hall set.
//!
//! The rule. Take any group of k cells in the house. Pool every digit those
//! cells could still hold.
//!   - Fewer than k digits: the k cells cannot all be different. The house has
//!     no answer, so the branch is dead.
//!   - Exactly k digits: those k cells use up those k digits between them, so
//!     no other cell in the house may hold any of them.
//! Checking every group removes exactly the candidates that no all-different
//! filling of the house can use (Hall's theorem;
//! docs/research/all-different-gac.md). Every group means every size up to
//! n-1 for removals: stopping at 4 cells misses a quarter of all states.
//!
//! Sound: the true filling gives k true cells k different digits, so no group
//! pools fewer than k, and a group that pools exactly k holds all k itself.
//!
//! Two kinds of bitmask. A set of DIGITS: bit d is digit d, the app's own
//! candidate mask. A GROUP of cells: bit i is the i-th FREE cell of the
//! house, in house order. There are 2^n groups over n free cells, numbered 1
//! to 2^n - 1, and counting up visits each once.
//!
//! Why counting up is cheap. A group without its lowest cell is a smaller
//! number, so it has already been visited and its pooled digits are on record.
//! A group's pooled digits are that record plus one cell's candidates.
//!
//! One pass is enough. Removals made during the walk only take away digits no
//! filling uses, so a group that pools exactly k digits pools the same k
//! digits before and after them.

//! 2^n groups per call over the free cells: about 2 us at n=9 free cells
//! against 26 us for a matching filter, but the cost doubles with each free
//! cell and matching is cheaper from n=12 or 13 on
//! (docs/research/all-different-gac.md). A larger house is a registration
//! mistake, refused at setup: the RangeError fails the Node harness loudly,
//! but in the app it only reaches the console, and the board ships with no
//! GAC filter at all. The build-time cap in framebuild.py is the loud guard.
//! The same rule in three other forms, and what each costs, is in
//! docs/research/408-house-gac/.
const MAX_CELLS = 9

//! Memo: slot g holds group g's pooled digits once the walk has reached g,
//! and junk before that. Shared between calls, so it is fully used before
//! `update` first yields: the solver may run another component's `update`
//! at a yield point.
const pooledDigitsOf = new Int32Array(2 ** MAX_CELLS)

//! The house positions of the free cells, in house order; the first
//! `freeCount` slots are this call's. Shared between calls like
//! `pooledDigitsOf`, and for the same reason safe: it is read only by the
//! walk, which finishes before `update` first yields.
const freePositions = new Uint8Array(MAX_CELLS)

//! Bit counts looked up rather than counted: two counts per group, 511 groups
//! per call, and a lookup halves the call (docs/research/all-different-gac.md,
//! "Precomputed bit counts"). `cellsInGroupOf` covers every group and
//! `digitCountOf` every digit set the board can make. The digit table doubles
//! with each digit, 131 KB at 16, so a board past 16 is refused at setup, by
//! a RangeError as visible as `MAX_CELLS`'s. Its table is capped so that
//! loading the code on such a board still works.
const MAX_DIGIT = 16
const cellsInGroupOf = countTable(2 ** MAX_CELLS)
const digitCountOf = countTable(2 ** (Math.min(helpers.digits.maxDigit, MAX_DIGIT) + 1))

function getAffectedCells (cells) {
  return cells
}

function setParams (instance, cells) {
  if (cells.length > MAX_CELLS) {
    throw new RangeError(`${instance.name}: HouseGacComponent takes at most ${MAX_CELLS} cells, got ${cells.length}`)
  }
  if (helpers.digits.maxDigit > MAX_DIGIT) {
    throw new RangeError(`${instance.name}: HouseGacComponent takes digits up to ${MAX_DIGIT}, the board goes to ${helpers.digits.maxDigit}`)
  }
}

//! A number has one more set bit than itself without its lowest one.
function countTable (size) {
  const table = new Uint8Array(size)
  for (let bits = 1; bits < size; bits++) table[bits] = table[withoutLowestBit(bits)] + 1
  return table
}

// #include ../_shared/bit-helpers.js

function * update (instance, puzzle) {
  const cells = instance.cells
  const cellCount = cells.length
  //! All-different holds only where the app says the cells cannot repeat
  //! (docs/line-contract.md). Asked here, not in main code, which can run
  //! before the built-in houses exist. Latched whichever way it answers: the
  //! answer is geometry, fixed once update first runs. The solver can retire
  //! a filled built-in house for the rest of a branch, which can only weaken
  //! the latched answer, never make a removal unsound.
  if (instance.canRepeat === undefined) instance.canRepeat = puzzle.getCellsCanHaveRepeats(cells)
  if (instance.canRepeat) return

  //! Per call, not module scratch: the removals are yielded straight off
  //! them, and a yield lets the solver run another house's update.
  const candidates = cells.map(cell => puzzle.getCandidatesBitMask(cell))
  const startingCandidates = candidates.slice()

  //! Strip each placed cell's digit from the rest of the house before the
  //! walk, then walk only the cells still free. A group that includes a
  //! placed cell owns its digits iff the rest of the group does, and its only
  //! extra removal is the placed digit -- already stripped here -- so the
  //! free-cell walk below removes exactly what walking every group of the
  //! whole house would remove.
  let freeCount = 0
  for (let position = 0; position < cellCount; position++) {
    if (digitCountOf[candidates[position]] === 1) {
      const placedDigit = candidates[position]
      for (let other = 0; other < cellCount; other++) {
        if (other !== position) candidates[other] &= ~placedDigit
      }
    } else {
      freePositions[freeCount++] = position
    }
  }

  const wholeGroup = (2 ** freeCount) - 1
  for (let group = 1; group <= wholeGroup; group++) {
    const newestCellBit = lowestBit(group)
    const newestPosition = freePositions[positionOf(newestCellBit)]
    const pooledDigits = pooledDigitsOf[withoutLowestBit(group)] | candidates[newestPosition]
    pooledDigitsOf[group] = pooledDigits

    const cellsInGroup = cellsInGroupOf[group]
    const digitsInGroup = digitCountOf[pooledDigits]

    if (digitsInGroup < cellsInGroup) {
      yield puzzle.stop(`the cells of ${instance.name} cannot all hold different digits`, cells)
      return
    }

    const groupOwnsItsDigits = digitsInGroup === cellsInGroup
    if (groupOwnsItsDigits) {
      const cellsOutside = wholeGroup & ~group
      for (let rest = cellsOutside; rest !== 0; rest = withoutLowestBit(rest)) {
        const restPosition = freePositions[positionOf(lowestBit(rest))]
        candidates[restPosition] &= ~pooledDigits
      }
    }
  }

  //! Hand the removals to the app, one change per cell that shrank. The walk
  //! only clears bits, so snapshot minus working mask is the whole difference.
  //! Yielding here and not inside the walk keeps pooledDigitsOf ours until the
  //! walk is done: a yield lets the solver run another house's update.
  for (let position = 0; position < cellCount; position++) {
    if (candidates[position] !== startingCandidates[position]) {
      const removedDigits = startingCandidates[position] & ~candidates[position]
      yield puzzle.removeCandidatesFromCell(removedDigits, cells[position])
    }
  }
}
