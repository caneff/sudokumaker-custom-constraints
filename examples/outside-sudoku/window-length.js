/* eslint-disable no-unused-vars -- windowLength is called by the main.js and main-global.js that include this file, not from here */
// A line whose first cell has no region (a ring cell) gets the whole line as
// its window: weaker, never unsound. The line must be one row or one column;
// the caller checks.
function windowLength (puzzle, line) {
  const head = line[0]
  const region = puzzle.getRegion(head)
  if (region < 0) return line.length
  const alongRow = line.length === 1 || puzzle.getRow(line[1]) === puzzle.getRow(head)
  const same = alongRow
    ? c => puzzle.getRow(c) === puzzle.getRow(head)
    : c => puzzle.getColumn(c) === puzzle.getColumn(head)
  let extent = 0
  for (const c of puzzle.getRegionCells(region)) if (same(c)) extent++
  return Math.min(extent, line.length)
}
