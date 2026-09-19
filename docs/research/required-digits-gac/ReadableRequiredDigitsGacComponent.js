/* eslint-disable no-unused-vars -- setParams/update/getAffectedCells are the component API SudokuMaker calls by name, not dead code */
//! Research record: the rule of `RequiredDigitsGacComponent.js` written to be
//! read rather than to be fast -- digit sets and cell lists through the puzzle
//! API, no bit arithmetic, no shared memo. Its shipped sibling is the one to
//! use; this one exists so the rule can be checked by eye against it. About
//! 18x slower on a 9-cell group with 9 required digits (25.4us against 1.4us),
//! and identical in what it removes across 27,000 random states, 6,522 of them
//! branch-killing. Not otherwise tested or maintained.
//!
//! The rule. Every digit of `values` must take a cell of `cells` of its own; a
//! digit listed twice wants two cells. Take any set S of the required digits,
//! and let N(S) be the cells that can still hold a digit of S. Write need(S)
//! for the number of cells S wants -- its digits' counts added up.
//!   - Fewer cells in N(S) than need(S): the digits do not fit. The branch is
//!     dead.
//!   - Exactly need(S) cells: S's digits fill those cells between them, so no
//!     cell of N(S) may hold any digit outside S.
//! Checking every S, from single digits up to all of them, is Hall's condition
//! on the digit side. S of one digit whose N(S) is one cell is the hidden
//! single; S of every required digit is the built-in's own rule, but read off
//! candidates rather than off filled cells, so it fires while the group is
//! still mostly empty.
//!
//! Sound: in the true solution S's digits sit in need(S) different cells, and
//! each of those cells can hold a digit of S, so each is in N(S). No S pools
//! fewer cells than it needs, and when it pools exactly that many, every one of
//! them is taken by an S digit.

const MAX_CELLS = 24
const MAX_DISTINCT = 12

function getAffectedCells (values, cells) {
  return cells
}

function setParams (instance, values, cells) {
  if (cells.length > MAX_CELLS) {
    throw new RangeError(`${instance.name}: ReadableRequiredDigitsGacComponent takes at most ${MAX_CELLS} cells, got ${cells.length}`)
  }
  //! The required digits, each with the number of cells it wants.
  const wantedCellsByDigit = new Map()
  for (const value of values) {
    wantedCellsByDigit.set(value, (wantedCellsByDigit.get(value) ?? 0) + 1)
  }
  if (wantedCellsByDigit.size > MAX_DISTINCT) {
    throw new RangeError(`${instance.name}: ReadableRequiredDigitsGacComponent takes at most ${MAX_DISTINCT} distinct digits, got ${wantedCellsByDigit.size}`)
  }
  if (values.length > cells.length) {
    throw new RangeError(`${instance.name}: ${values.length} required digits cannot fit in ${cells.length} cells`)
  }
  instance.requiredDigits = [...wantedCellsByDigit.keys()]
  instance.wantedCells = [...wantedCellsByDigit.values()]
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
  const requiredDigits = instance.requiredDigits

  //! `getCandidates` hands back a fresh set per call, so `candidates` can be
  //! edited in place while `before` keeps what the cells started with. Both
  //! belong to this call alone, so nothing is shared if the solver runs another
  //! component while this one waits at a yield.
  const before = cells.map(cell => puzzle.getCandidates(cell))
  const candidates = cells.map(cell => puzzle.getCandidates(cell))

  for (let size = 1; size <= requiredDigits.length; size++) {
    for (const group of groupsOfSize(size, requiredDigits.length)) {
      const digitsInGroup = group.map(position => requiredDigits[position])
      const cellsWanted = group.reduce((total, position) => total + instance.wantedCells[position], 0)

      //! N(S): every cell that could still take one of these digits.
      const holders = []
      for (let position = 0; position < cells.length; position++) {
        if (digitsInGroup.some(digit => candidates[position].has(digit))) holders.push(position)
      }

      if (holders.length < cellsWanted) {
        yield puzzle.stop(`${instance.name} has nowhere left to put the digits it requires`, cells)
        return
      }

      const groupFillsItsCells = holders.length === cellsWanted
      if (groupFillsItsCells) {
        //! Those cells are spoken for, so anything else in them can go.
        for (const position of holders) {
          const strangers = SudokuDigitSet.from(
            [...candidates[position]].filter(digit => !digitsInGroup.includes(digit))
          )
          candidates[position].subtract(strangers)
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
