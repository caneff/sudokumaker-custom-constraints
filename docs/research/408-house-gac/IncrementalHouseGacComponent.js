/* eslint-disable no-unused-vars -- setParams/update/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Research record (#408): the rule of `examples/_shared/HouseGacComponent.js`
//! in digit sets like `ReadableHouseGacComponent.js`, but built so each group
//! costs one step. About 3.5x slower than the shipped form.
//! `bench-house-gac.mjs` checks it against the shipped form before timing it;
//! not otherwise tested or maintained.
//!
//! The rule. Take any group of k cells in the house. Pool every digit those
//! cells could still hold.
//!   - Fewer than k digits: the k cells cannot all be different. The house has
//!     no answer, so the branch is dead.
//!   - Exactly k digits: those k cells use up those k digits between them, so
//!     no other cell in the house may hold any of them.
//! Checking every group removes exactly the candidates that no all-different
//! filling of the house can use (Hall's theorem;
//! docs/research/all-different-gac.md).
//!
//! How the groups are visited. A group grows one cell at a time: start from a
//! group, add one cell further along the house, and its pooled digits are the
//! group's pooled digits plus that cell's. Growing every group every way, in
//! order, reaches each group of the house exactly once, and never pools a
//! group's digits from scratch.
//!
//! One pass is enough. Removals made during the walk only take away digits no
//! filling uses, so a group that pools exactly k digits pools the same k
//! digits before and after them.

const MAX_CELLS = 9

function getAffectedCells (cells) {
  return cells
}

function setParams (instance, cells) {
  if (cells.length > MAX_CELLS) {
    throw new RangeError(`${instance.name}: IncrementalHouseGacComponent takes at most ${MAX_CELLS} cells, got ${cells.length}`)
  }
  instance.cells = cells
}

//! Grow the current group by each cell from `nextPosition` on, check the rule
//! on every grown group, then keep growing it. `inGroup[position]` marks the
//! cells of the current group. Returns false as soon as a group pools fewer
//! digits than it has cells.
function growGroup (candidates, inGroup, groupDigits, groupSize, nextPosition) {
  for (let position = nextPosition; position < candidates.length; position++) {
    const pooledDigits = new SudokuDigitSet(groupDigits).union(candidates[position])
    const size = groupSize + 1

    if (pooledDigits.size < size) return false

    inGroup[position] = true
    const groupOwnsItsDigits = pooledDigits.size === size
    if (groupOwnsItsDigits) {
      for (let other = 0; other < candidates.length; other++) {
        if (!inGroup[other]) candidates[other].subtract(pooledDigits)
      }
    }
    const stillPossible = growGroup(candidates, inGroup, pooledDigits, size, position + 1)
    inGroup[position] = false

    if (!stillPossible) return false
  }
  return true
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
  const inGroup = cells.map(() => false)

  if (!growGroup(candidates, inGroup, new SudokuDigitSet(), 0, 0)) {
    yield puzzle.stop(`the cells of ${instance.name} cannot all hold different digits`, cells)
    return
  }

  for (let position = 0; position < cells.length; position++) {
    if (!candidates[position].equals(before[position])) {
      const removed = before[position].subtract(candidates[position])
      yield puzzle.removeCandidatesFromCell(removed, cells[position])
    }
  }
}
