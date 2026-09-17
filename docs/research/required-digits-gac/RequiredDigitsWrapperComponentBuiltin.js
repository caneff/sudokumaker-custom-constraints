/* eslint-disable no-unused-vars -- getAffectedCells/setParams/update are the component API SudokuMaker calls by name, not dead code */
//! The baseline half of the RequiredDigits wrapper comparison (#534): same
//! shape as RequiredDigitsWrapperComponent.js, but the swap target is the
//! built-in RequiredDigitsComponent instead of RequiredDigitsGacComponent.
//! Built by build_required_digits.py into PUZZLE_LINK_required_digits_original.txt,
//! the same-board pair timed (docs/real-app-timing.md's "link vs link"
//! provision) against PUZZLE_LINK_required_digits.txt -- see
//! required-digits-gac.md for the reproduce commands and the recorded rows.

function getAffectedCells (clue, line) {
  return [clue, ...line]
}

function setParams (instance, clue, line) {
  instance.clue = clue
  instance.line = line
}

function windowLength (instance, puzzle) {
  if (instance.w !== undefined) return instance.w
  const { line } = instance
  const head = line[0]
  const region = puzzle.getRegion(head)
  let w = line.length
  if (region >= 0) {
    const alongRow = line.length === 1 || puzzle.getRow(line[1]) === puzzle.getRow(head)
    const same = alongRow
      ? c => puzzle.getRow(c) === puzzle.getRow(head)
      : c => puzzle.getColumn(c) === puzzle.getColumn(head)
    let extent = 0
    for (const c of puzzle.getRegionCells(region)) if (same(c)) extent++
    w = Math.min(extent, line.length)
  }
  instance.w = w
  return w
}

function * update (instance, puzzle) {
  const { clue, line } = instance
  if (!puzzle.hasValue(clue)) return
  const w = windowLength(instance, puzzle)
  yield puzzle.replaceComponent(
    instance,
    new RequiredDigitsComponent(instance.name, [puzzle.getValue(clue)], line.slice(0, w))
  )
}
