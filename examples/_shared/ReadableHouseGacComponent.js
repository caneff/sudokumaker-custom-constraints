/* eslint-disable no-unused-vars -- setParams/update/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! The same filter as `HouseGacComponent.js`, written to be read rather than to
//! be fast: digit sets and cell lists through the puzzle API, no bit arithmetic.
//! Both files hold one rule; `house-gac.test.mjs` holds them to identical
//! results.
//!
//! The rule. Take any group of k cells in the house. Pool every digit those
//! cells could still hold.
//!   - Fewer than k digits: the k cells cannot all be different. The house has
//!     no answer, so the branch is dead.
//!   - Exactly k digits: those k cells use up those k digits between them, so
//!     no other cell in the house may hold any of them.
//! Checking every group, from single cells up to all but one cell, removes
//! exactly the candidates that no all-different filling of the house can use
//! (Hall's theorem; docs/research/all-different-gac.md).
//!
//! One pass is enough. Removals made while the groups are being checked only
//! take away digits no filling uses, so a group that pools exactly k digits
//! pools the same k digits before and after them.

const MAX_CELLS = 9

function getAffectedCells (cells) {
  return cells
}

function setParams (instance, cells) {
  if (cells.length > MAX_CELLS) {
    throw new RangeError(`${instance.name}: ReadableHouseGacComponent takes at most ${MAX_CELLS} cells, got ${cells.length}`)
  }
  instance.cells = cells
}

//! Every group of `size` positions out of 0..count-1, each group in increasing
//! order, e.g. size 2 of 3 gives [0, 1], [0, 2], [1, 2].
function * groupsOfSize (size, count, firstPosition = 0) {
  if (size === 0) {
    yield []
    return
  }
  for (let position = firstPosition; position <= count - size; position++) {
    for (const rest of groupsOfSize(size - 1, count, position + 1)) {
      yield [position, ...rest]
    }
  }
}

function * update (instance, puzzle) {
  const cells = instance.cells
  //! All-different holds only where the app says the cells cannot repeat
  //! (docs/line-contract.md). Asked here, not in main code, which can run
  //! before the built-in houses exist; cached once it says no.
  if (!instance.noRepeats) {
    if (puzzle.getCellsCanHaveRepeats(cells)) return
    instance.noRepeats = true
  }

  //! `getCandidates` hands back a fresh set per call, so `candidates` can be
  //! edited in place while `before` keeps what the cells started with. Both
  //! belong to this call alone, so nothing is shared if the solver runs another
  //! component while this one waits at a yield.
  const before = cells.map(cell => puzzle.getCandidates(cell))
  const candidates = cells.map(cell => puzzle.getCandidates(cell))

  for (let size = 1; size <= cells.length; size++) {
    for (const group of groupsOfSize(size, cells.length)) {
      const pooledDigits = SudokuDigitSet.getUnion(group.map(position => candidates[position]))

      if (pooledDigits.size < size) {
        yield puzzle.stop(`the cells of ${instance.name} cannot all hold different digits`, cells)
        return
      }

      const groupOwnsItsDigits = pooledDigits.size === size
      if (groupOwnsItsDigits) {
        for (let position = 0; position < cells.length; position++) {
          if (!group.includes(position)) candidates[position].subtract(pooledDigits)
        }
      }
    }
  }

  for (let position = 0; position < cells.length; position++) {
    if (!candidates[position].equals(before[position])) {
      const removed = before[position].subtract(candidates[position])
      yield puzzle.removeCandidatesFromCell(removed, cells[position])
    }
  }
}
