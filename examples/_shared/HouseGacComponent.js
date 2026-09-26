/* eslint-disable no-unused-vars -- setParams/update/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! All-different at full strength (generalized arc consistency) over one house
//! of at most 9 cells. A house is any one of the board's fixed groups that
//! must all hold different digits -- a row, a column, or a box; one instance
//! of this file runs per house, so a plain 9x9 wires up 27 of them, one per
//! row, column and box.
//!
//! A candidate survives only if some filling of the whole house with different
//! digits uses it. The app's own `HouseComponent` and `DifferentDigitsComponent`
//! stop short of that: neither finds a Hall set (#406).
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
//!
//! Placed cells (one candidate left) are stripped from the house and skipped
//! by the walk (#435; the argument for why that loses nothing is with the
//! strip loop in `update`, below).

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
//! with each digit, 131 KB at 16, so a board past 16 is refused at setup --
//! by the same RangeError, loud in the Node harness and console-only in the
//! app. Its table is capped so that loading the code on such a board still
//! works.
const MAX_DIGIT = 16
//! Set-bit count of every group index: how many cells a group holds.
const cellsInGroupOf = countTable(2 ** MAX_CELLS)
//! Set-bit count of every digit mask the board can make: how many digits a pool holds.
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

//! `table[bits]` is how many bits are set in `bits`, for every value below
//! `size`: a number has one more set bit than itself without its lowest one.
function countTable (size) {
  const table = new Uint8Array(size)
  for (let bits = 1; bits < size; bits++) table[bits] = table[withoutLowestBit(bits)] + 1
  return table
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
  //! whole house would remove (#435).
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
    //! pooledDigitsOf is a memo: slot g holds group g's pool once the loop has
    //! reached g, and junk before that. Storing this group's pool here is what
    //! lets later groups skip re-pooling their cells: every group that is this
    //! group plus one lower cell reads this slot instead. Group 7 (cells
    //! 0,1,2) reads slot 6 (cells 1,2) and ORs in cell 0.
    const pooledDigits = pooledDigitsOf[withoutLowestBit(group)] | candidates[newestPosition]
    pooledDigitsOf[group] = pooledDigits

    const cellsInGroup = cellsInGroupOf[group]
    const digitsInGroup = digitCountOf[pooledDigits]

    if (digitsInGroup < cellsInGroup) {
      //! puzzle.stop tells the solver this branch is a dead end, full stop --
      //! it fails only the search node currently being tried, so the solver
      //! backs up and tries the next candidate elsewhere on the board.
      yield puzzle.stop(`the cells of ${instance.name} cannot all hold different digits`, cells)
      return
    }

    const groupOwnsItsDigits = digitsInGroup === cellsInGroup
    if (groupOwnsItsDigits) {
      //! The cells not in this group, as a mask: flip the group's bits and keep
      //! only the house's. The loop then visits just those cells: each pass
      //! takes the lowest set bit, turns it into the cell's position, strips the
      //! group's digits there, and drops that bit from `rest`. Mask 10100 is
      //! cells 2 and 4, two passes, nothing tested in between.
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
  //! puzzle.removeCandidatesFromCell narrows one cell's candidates and hands
  //! that narrower board back to the app, which re-runs every component's
  //! `update` (this one included) over it looking for the next deduction.
  for (let position = 0; position < cellCount; position++) {
    if (candidates[position] !== startingCandidates[position]) {
      const removedDigits = startingCandidates[position] & ~candidates[position]
      yield puzzle.removeCandidatesFromCell(removedDigits, cells[position])
    }
  }
}
