/* eslint-disable no-unused-vars -- windowLength is called by the main.js and main-global.js that include this file, not from here */
// The window length of one line: the extent of line[0]'s box along the line's
// direction -- how many of that box's cells share line[0]'s row (or column),
// capped by the line length. One copy, spliced into both backends by
// `// #include window-length.js`; not a module (see _shared/frame-lines.js).
// A line whose first cell has no region (region -1, e.g. a ring cell) gets the
// whole line as its window: weaker, never unsound. The line must be one row or
// one column; the caller checks.
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
