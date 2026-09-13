/* eslint-disable no-unused-vars -- setParams/update/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! All-different at full strength (generalized arc consistency) over one house
//! of at most 9 cells.
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
//! candidate mask. A GROUP of cells: bit i is the i-th cell of the house. There
//! are 2^n groups, numbered 1 to 2^n - 1, and counting up visits each once.
//!
//! Why counting up is cheap. A group without its lowest cell is a smaller
//! number, so it has already been visited and its pooled digits are on record.
//! A group's pooled digits are that record plus one cell's candidates.
//!
//! One pass is enough. Removals made during the walk only take away digits no
//! filling uses, so a group that pools exactly k digits pools the same k
//! digits before and after them.

//! 2^n groups per call: about 4.5 us at n=9 against 26 us for a matching
//! filter, but the cost doubles with each cell and matching is cheaper from
//! n=12 or 13 on (docs/research/all-different-gac.md). A larger house is a
//! registration mistake, refused at setup where the author sees it.
//! The same rule in three other forms, and what each costs, is in
//! docs/research/408-house-gac/.
const MAX_CELLS = 9

//! `pooledDigitsOf[group]` is every digit the cells of `group` could hold.
//! Shared between calls, so it is fully used before `update` first yields: the
//! solver may run another component's `update` at a yield point.
const pooledDigitsOf = new Int32Array(1 << MAX_CELLS)

function getAffectedCells (cells) {
  return cells
}

function setParams (instance, cells) {
  if (cells.length > MAX_CELLS) {
    throw new RangeError(`${instance.name}: HouseGacComponent takes at most ${MAX_CELLS} cells, got ${cells.length}`)
  }
  instance.cells = cells
}

//! How many bits are set: digits in a digit set, cells in a group.
function countOf (bits) {
  let count = 0
  for (let rest = bits; rest !== 0; rest = withoutLowestBit(rest)) count++
  return count
}

function lowestBit (bits) {
  return bits & -bits
}

function withoutLowestBit (bits) {
  return bits & (bits - 1)
}

//! The index of a single set bit: 1 -> 0, 2 -> 1, 4 -> 2, ...
function indexOf (singleBit) {
  return 31 - Math.clz32(singleBit)
}

function * update (instance, puzzle) {
  const cells = instance.cells
  const cellCount = cells.length
  //! All-different holds only where the app says the cells cannot repeat
  //! (docs/line-contract.md). Asked here, not in main code, which can run
  //! before the built-in houses exist; cached once it says no.
  if (!instance.noRepeats) {
    if (puzzle.getCellsCanHaveRepeats(cells)) return
    instance.noRepeats = true
  }

  //! Per call, so the removals can be yielded straight off them.
  const candidates = cells.map(cell => puzzle.getCandidatesBitMask(cell))
  const startingCandidates = candidates.slice()

  const wholeHouse = (1 << cellCount) - 1
  pooledDigitsOf[0] = 0
  for (let group = 1; group <= wholeHouse; group++) {
    const newestCell = lowestBit(group)
    const pooledDigits = pooledDigitsOf[withoutLowestBit(group)] | candidates[indexOf(newestCell)]
    pooledDigitsOf[group] = pooledDigits

    const cellsInGroup = countOf(group)
    const digitsInGroup = countOf(pooledDigits)

    if (digitsInGroup < cellsInGroup) {
      yield puzzle.stop(`the cells of ${instance.name} cannot all hold different digits`, cells)
      return
    }

    const groupOwnsItsDigits = digitsInGroup === cellsInGroup
    if (groupOwnsItsDigits) {
      const cellsOutside = wholeHouse & ~group
      for (let rest = cellsOutside; rest !== 0; rest = withoutLowestBit(rest)) {
        candidates[indexOf(lowestBit(rest))] &= ~pooledDigits
      }
    }
  }

  for (let position = 0; position < cellCount; position++) {
    if (candidates[position] !== startingCandidates[position]) {
      const removedDigits = startingCandidates[position] & ~candidates[position]
      yield puzzle.removeCandidatesFromCell(new SudokuDigitSet(removedDigits), cells[position])
    }
  }
}
