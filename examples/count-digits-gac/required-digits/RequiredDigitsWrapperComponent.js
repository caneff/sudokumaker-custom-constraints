/* eslint-disable no-unused-vars -- getAffectedCells/setParams/update are the component API SudokuMaker calls by name, not dead code */
//! Outside Sudoku, restated as a RequiredDigits instance -- built to TIME
//! RequiredDigitsGacComponent in the real app (#534), not to replace
//! OutsideSudokuComponent.js, which already enforces the same rule in three
//! bitmask reads and needs no detour through RequiredDigits.
//!
//! Idle while the outside clue is blank -- there is nothing to require yet.
//! Once the clue is filled, swap this instance for a
//! RequiredDigitsGacComponent over the clue's window: the built-in
//! edge-clue shape (docs/gotchas.md #1), with the sibling custom class
//! spelled `customComponents.RequiredDigitsGacComponent` (a bare
//! `RequiredDigitsGacComponent` throws a ReferenceError the app only prints
//! to the console -- the rule goes dead with nothing in the UI).
//!
//! `windowLength` restates examples/outside-sudoku/window-length.js's
//! geometry, cached on the instance: this file is not a rebuild of that
//! component (examples/outside-sudoku/OPTIMIZATION_LOG.md, "A hand-built
//! `original/` wrapper"), so it keeps its own copy instead of an include.
//!
//! `RequiredDigitsWrapperComponentBuiltin.js` is the same shape with the
//! built-in `RequiredDigitsComponent` as the swap target; the baseline
//! `PUZZLE_LINK_original.txt` is built from it (../build_required_digits.py).

function getAffectedCells (clue, line) {
  return [clue, ...line]
}

function setParams (instance, clue, line) {
  instance.clue = clue
  instance.line = line
}

// The extent of line[0]'s box along the line's direction, cached on the
// instance. A region-less line[0] (a ring cell) gets the whole line: weaker,
// never unsound.
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
  if (!puzzle.hasValue(clue)) return // idle: nothing to require yet
  const w = windowLength(instance, puzzle)
  yield puzzle.replaceComponent(
    instance,
    new customComponents.RequiredDigitsGacComponent(instance.name, [puzzle.getValue(clue)], line.slice(0, w))
  )
}
