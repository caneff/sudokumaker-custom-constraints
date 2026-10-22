/* eslint-disable no-unused-vars -- read by the components that include this file, not from here */
// Marking the cells a search has visited, without clearing anything before
// each search.
//
// Every search gets its own number. A search marks a cell by writing its
// number into that cell's slot, so "visited by this search" means "holds this
// search's number", and the next search, with the next number, starts with
// nothing marked. The slots are a typed array, which cannot hold numbers past
// a limit, so when the next number would not fit, every slot is cleared and
// the numbers start again at 1.

// The number for the search after `visit`, for the slots `marks`. This runs
// inside the solver, where an error would go unseen, so it never checks the
// array's type: `marks` must come from `newVisitMarks`, which records the
// limit.
function nextVisit (marks, visit) {
  if (visit >= marks.visitLimit) {
    marks.fill(0)
    return 1
  }
  return visit + 1
}

// `length` empty slots of `Type`, which must be Int32Array or Uint32Array:
// the array records the largest number its slots can hold (2^31 - 1 or
// 2^32 - 1). Any other type is refused here, when the array is made, where a
// test sees the error, rather than guessed at.
function newVisitMarks (Type, length) {
  const limit = Type === Int32Array ? 0x7FFFFFFF : Type === Uint32Array ? 0xFFFFFFFF : 0
  if (!limit) throw new Error('newVisitMarks: visit marks are kept in an Int32Array or a Uint32Array')
  const marks = new Type(length)
  marks.visitLimit = limit
  return marks
}
