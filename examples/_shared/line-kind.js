/* eslint-disable no-unused-vars -- lineKind and the kinds are read by the component that includes this file, not from here */
// A line's kind, the one gate every outside-clue component asks
// (docs/line-contract.md, "How a component gates"). One copy, spliced into each
// component by `// #include ../_shared/line-kind.js` (examples/_shared/minify.py).
// Not a module: the app runs the assembled component as a bare script.
//
// `lineKind(instance, puzzle, cells)` returns `{ kind, oneToN }`:
//   kind   BARE (the cells may repeat a digit) or HOUSE (they cannot)
//   oneToN a house whose live candidates are exactly {1..cells.length} -- the
//          digit set a rule that reads the line as a permutation of 1..n needs.
//          A full house of any other set, {0..n-1} say, is not one. No rule
//          reads that case, so `kind` stops at HOUSE.
//
// Ask in `update` or `validate`, never in main code: main code runs before the
// built-in row and column houses are registered and would read every line as
// bare (gotcha 6). Pass the line's cells alone -- a clue cell is in no house
// with them and flips the answer to BARE.
//
// Latch only the repeats fact, both answers; re-read the digit set every call.
// Whether a line can repeat is geometry, fixed once `update` first runs, so the
// answer is remembered per cells array in `instance.repeatAnswers` whether it is
// true or false. One caveat: the solver can retire a filled built-in house for
// the rest of a branch, which can only weaken a latched answer (a house read
// later as bare), never make a removal unsound. The digit set is a
// candidate fact: the app shares one component object across every search node,
// so a set latched deep in a branch would survive the backtrack to a parent
// where the line has regained a digit. Nothing else is written to the
// instance. The answers are shared constant objects, so a call allocates
// nothing.
const BARE = 0
const HOUSE = 1
const LINE_BARE = Object.freeze({ kind: BARE, oneToN: false })
const LINE_HOUSE = Object.freeze({ kind: HOUSE, oneToN: false })
const LINE_ONE_TO_N = Object.freeze({ kind: HOUSE, oneToN: true })

function lineKind (instance, puzzle, cells) {
  const answers = instance.repeatAnswers || (instance.repeatAnswers = new Map())
  let canRepeat = answers.get(cells)
  if (canRepeat === undefined) {
    canRepeat = puzzle.getCellsCanHaveRepeats(cells)
    answers.set(cells, canRepeat)
  }
  if (canRepeat) return LINE_BARE
  let mask = 0
  for (const c of cells) mask |= puzzle.getCandidatesBitMask(c)
  return mask === (1 << (cells.length + 1)) - 2 ? LINE_ONE_TO_N : LINE_HOUSE // bits 1..n set, bit 0 clear
}
