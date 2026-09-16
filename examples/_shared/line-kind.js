/* eslint-disable no-unused-vars -- lineKind and the kinds are read by the component that includes this file, not from here */
// A line's kind, the one gate every outside-clue component asks
// (docs/line-contract.md, "How a component gates"). One copy, spliced into each
// component by `// #include ../_shared/line-kind.js` (examples/_shared/minify.py).
// Not a module: the app runs the assembled component as a bare script.
//
// `lineKind(instance, puzzle, cells)` returns `{ kind, oneToN }`:
//   kind   BARE (the cells may repeat a digit), HOUSE (they cannot), or
//          FULL_HOUSE (a house whose live candidates hold exactly as many
//          digits as it has cells)
//   oneToN the live candidates are exactly {1..cells.length} -- the digit set
//          a rule that reads the line as a permutation of 1..n needs. It
//          implies FULL_HOUSE; a full house of {0..n-1} is not one.
//
// Ask in `update` or `validate`, never in main code: main code runs before the
// built-in row and column houses are registered and would read every line as
// bare (gotcha 6). Pass the line's cells alone -- a clue cell is in no house
// with them and flips the answer to BARE.
//
// Latch only the house fact; re-read the digit set every call. A house is
// registered once and a backtrack cannot un-register it, so a line found to be
// one is remembered, per cells array, in `instance.houses`. The digit set is a
// candidate fact: the app shares one component object across every search node,
// so a set latched deep in a branch would survive the backtrack to a parent
// where the line has regained a digit (#336). Nothing else is written to the
// instance. The answers are shared constant objects, so a call allocates
// nothing.
const BARE = 0
const HOUSE = 1
const FULL_HOUSE = 2
const LINE_BARE = Object.freeze({ kind: BARE, oneToN: false })
const LINE_HOUSE = Object.freeze({ kind: HOUSE, oneToN: false })
const LINE_FULL = Object.freeze({ kind: FULL_HOUSE, oneToN: false })
const LINE_ONE_TO_N = Object.freeze({ kind: FULL_HOUSE, oneToN: true })

function lineKind (instance, puzzle, cells) {
  const houses = instance.houses || (instance.houses = new Set())
  if (!houses.has(cells)) {
    if (puzzle.getCellsCanHaveRepeats(cells)) return LINE_BARE
    houses.add(cells)
  }
  let mask = 0
  for (const c of cells) mask |= puzzle.getCandidatesBitMask(c)
  if (mask === (1 << (cells.length + 1)) - 2) return LINE_ONE_TO_N // bits 1..n set, bit 0 clear
  let live = 0
  for (let m = mask; m; m &= m - 1) live++
  return live === cells.length ? LINE_FULL : LINE_HOUSE
}
