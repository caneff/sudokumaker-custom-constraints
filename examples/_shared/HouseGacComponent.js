/* eslint-disable no-unused-vars -- setParams/update/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! All-different at full strength (generalized arc consistency) over one house
//! of at most 9 cells.
//!
//! A candidate survives only if some assignment of distinct digits to the
//! whole house uses it. The app's own `HouseComponent` and
//! `DifferentDigitsComponent` stop short of that: neither finds a Hall set
//! (#406, docs/research/all-different-gac.md).
//!
//! The test is naked subsets of every size, 1 to n-1, read off bitmasks. A set
//! of k cells whose candidates span exactly k digits owns those digits, so
//! they leave every other cell; a set spanning fewer than k digits has no
//! assignment at all, so the branch is dead. By Hall's theorem those are
//! exactly the removals a matching-based filter makes. The cap must be n-1:
//! stopping at 4 misses a quarter of all states.
//!
//! Soundness: the true house is an assignment of distinct digits, so every
//! true candidate lies in one, no k true cells span fewer than k digits, and
//! a set spanning exactly k digits holds all k of them among its own cells.

//! 2^n subsets per call. At n=9 this component takes about 4 us a call against
//! 26 us for the matching filter; the cost doubles with each cell, and matching
//! is cheaper from n=12 or 13 on (docs/research/all-different-gac.md, "Larger
//! houses"). A larger house is a registration mistake, refused at setup where
//! the author sees it.
const MAX_CELLS = 9

//! `unionOf[s]` is the digits the cells in subset `s` can hold. Module-level
//! scratch, so it is fully consumed before `update` first yields: the solver
//! may run another instance's `update` at a yield point. `masks` and `start`
//! are per call, so the removals can be yielded straight off them.
const unionOf = new Int32Array(1 << MAX_CELLS)

function getAffectedCells (cells) {
  return cells
}

function setParams (instance, cells) {
  if (cells.length > MAX_CELLS) {
    throw new RangeError(`${instance.name}: HouseGacComponent takes at most ${MAX_CELLS} cells, got ${cells.length}`)
  }
  instance.cells = cells
}

function bitCount (m) {
  let c = 0
  for (; m !== 0; m &= m - 1) c++
  return c
}

function * update (instance, puzzle) {
  const cells = instance.cells
  const n = cells.length
  //! All-different holds only where the app says the cells cannot repeat
  //! (docs/line-contract.md). Asked here, not in main code, which can run
  //! before the built-in houses exist; cached once it says no.
  if (!instance.noRepeats) {
    if (puzzle.getCellsCanHaveRepeats(cells)) return
    instance.noRepeats = true
  }

  const masks = new Array(n)
  for (let i = 0; i < n; i++) masks[i] = puzzle.getCandidatesBitMask(cells[i])
  const start = masks.slice()

  //! Removals are made in place as each subset is read, so a union built from
  //! a smaller subset can predate a later removal. That is harmless: on a house
  //! that has an assignment, a Hall-tight set's union is the same under every
  //! mix of old and new masks, and a union never grows, so no set reads as
  //! tighter than it is.
  const all = (1 << n) - 1
  unionOf[0] = 0
  for (let s = 1; s <= all; s++) {
    const low = s & -s
    const u = unionOf[s ^ low] | masks[31 - Math.clz32(low)]
    unionOf[s] = u
    const k = bitCount(s)
    const span = bitCount(u)
    if (span < k) {
      yield puzzle.stop(`the cells of ${instance.name} cannot all hold different digits`, cells)
      return
    }
    if (span === k) {
      for (let rest = all & ~s; rest !== 0; rest &= rest - 1) {
        masks[31 - Math.clz32(rest & -rest)] &= ~u
      }
    }
  }

  for (let i = 0; i < n; i++) {
    if (masks[i] !== start[i]) {
      yield puzzle.removeCandidatesFromCell(new SudokuDigitSet(start[i] & ~masks[i]), cells[i])
    }
  }
}
