// End to end: Dutch Flatmates (spec #675) through the app's own solver.
//
//   node examples/dutch-flatmates/end-to-end.test.mjs
//
// Each case takes a committed link, as a setter would share it, and runs it
// through the real SudokuMaker solver bundle in Node (bundle-solve-lib.mjs,
// #429): the link's own main code registers the component, and the app's
// search solves. Nothing here is mocked, so the board data, the component and
// the rules text are checked together.
//
// It drives the spec's acceptance criteria as one flow:
// - the link is a ringless 9x9 whose rules text opens "Normal sudoku rules
//   apply." and states the flatmate rule, with exactly one whole-grid
//   component and the recorded givens;
// - the app's search finds exactly one solution, the one CP-SAT proved unique
//   and recorded in gen.json (so `update` never ruled the answer out), on the
//   shipped 23-given board and on the 18-given one;
// - the rule is what makes it unique: with the component removed the shipped
//   givens leave many completions (1,279);
// - the rule is enforced: the true grid entered in full is accepted, and
//   valid sudoku grids that break the rule are refused.
//
// The expected solution and the rule are stated here from the spec ("a 5 needs
// a 1 directly above or a 9 directly below"), never read back from the JS
// component. That the CP-SAT proof holds is verify.py's job (run by
// build_link.test.py); that `update` never prunes a true value on random
// states is soundness-harness.mjs's; how much it prunes is
// update-strength.test.mjs's; and `check_layout.py` (run by `just test`)
// checks the layout lists and the decoded link.
//
// It runs the code embedded in the committed links, not the tree:
// build_link.test.py fails when PUZZLE_LINK.txt's code drifts from main.js or
// the component, and `build_link.py` refreshes it. The 18-given link is checked
// only against the shipped one, by the case near the end of this file.
//
// What a green run does not cover:
// - The live app at sudokumaker.app: how the link loads and renders, the rules
//   text as the play page shows it, solve time (`just time dutch-flatmates`)
//   and the app's own verdict. This bundle reads the document, not the page.
//   `app-open.mjs --live` is the one-open check, and the README's Timing and
//   Live app sections record it.
// - Whether the deduction pays for itself: that is `just time`, and the 0 ms
//   vs 200 ms rows are 100 ms-step readings: 0 ms means under one step.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync, readFileSync } from 'fs'
import assert from 'assert'
import { decodeLinkFile, solveDocument } from '../_shared/bundle-solve-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const N = 9

const BOARDS = [
  ['PUZZLE_LINK.txt', 'gen.json', 23],
  ['PUZZLE_LINK_18g.txt', 'gen_18g.json', 18]
]

const load = (link, gen) => ({
  doc: decodeLinkFile(join(HERE, link)),
  board: JSON.parse(readFileSync(join(HERE, gen), 'utf8'))
})

// The grid as a row-major digit array, and as the solver prints it.
const digits = board => board.grid.flatMap(row => [...row].map(Number))
const solution = board => digits(board).join('')

// The spec's rule on a full grid: every 5 has a 1 directly above or a 9
// directly below. Stated here, independent of the component.
const flatmatesOk = g => g.every((d, i) =>
  d !== 5 || (i >= N && g[i - N] === 1) || (i + N < N * N && g[i + N] === 9))

const entered = (doc, grid) => {
  const d = structuredClone(doc)
  d.puzzle.cells = grid.map(value => ({ value }))
  return d
}

// The solutions found; none when setup rejects the grid as it stands (the
// givens or an entered grid contradict the rule, or `update` ruled them out).
const solutionsOf = d => solveDocument(d).then(
  r => r.solutions,
  err => (/rejected the initial grid/.test(err.message) ? [] : Promise.reject(err))
)

// Valid sudoku grids that break the rule: the solution with its digits
// relabelled, which keeps every row, column and box a permutation.
function ruleBreakers (grid) {
  const out = []
  for (let a = 1; a <= 9; a++) {
    for (let b = a + 1; b <= 9; b++) {
      const swapped = grid.map(d => (d === a ? b : d === b ? a : d))
      if (!flatmatesOk(swapped)) out.push([a, b, swapped])
    }
  }
  return out
}

for (const [link, gen, givenCount] of BOARDS) {
  const { doc, board } = load(link, gen)
  const label = link

  // The shipped link is a ringless custom 9x9 with the recorded givens, the
  // rules text the spec asked for, and one whole-grid component.
  {
    const { type, width, height, comment } = doc.puzzle
    assert.deepStrictEqual({ type, width, height }, { type: 'custom', width: N, height: N }, label)
    assert.ok(comment.startsWith('Normal sudoku rules apply. '), `${label}: rules text opening`)
    assert.match(comment, /Dutch Flatmates: every 5 needs a flatmate, a 1 directly above it or a 9 directly below it\./, label)
    const flatmates = doc.puzzle.constraints.filter(c => c.definition?.name === 'Dutch Flatmates')
    assert.strictEqual(flatmates.length, 1, `${label}: one Dutch Flatmates component`)
    const given = doc.puzzle.cells.map(c => c?.value).filter(v => v !== undefined && v !== null && v !== '')
    assert.strictEqual(given.length, givenCount, `${label}: given count`)
    // Every given is the recorded solution's digit.
    doc.puzzle.cells.forEach((c, i) => {
      if (c?.value) assert.strictEqual(c.value, digits(board)[i], `${label}: given at cell ${i}`)
    })
  }

  // The recorded solution obeys the spec's rule.
  assert.ok(flatmatesOk(digits(board)), `${label}: recorded solution breaks the rule`)

  // The app's search finds exactly the recorded solution: one solution, so
  // the board is unique under the rule and `update` ruled nothing true out.
  assert.deepStrictEqual(await solutionsOf(structuredClone(doc)), [solution(board)], `${label}: the link's solutions`)

  // The rule is what makes it unique: with the component removed the same
  // givens leave more than one completion. Shipped board only: the 18-given
  // board leaves up to 10^8 plain completions, too many for the solver to list.
  if (givenCount === 23) {
    const plain = structuredClone(doc)
    plain.puzzle.constraints = plain.puzzle.constraints.filter(c => c.definition?.name !== 'Dutch Flatmates')
    const { solutions } = await solveDocument(plain)
    assert.ok(solutions.length > 1, `${label}: ${solutions.length} solutions without the rule`)
    assert.ok(solutions.includes(solution(board)), `${label}: plain sudoku lost the solution`)
    assert.ok(solutions.some(s => !flatmatesOk([...s].map(Number))), `${label}: no plain completion breaks the rule`)
  }

  // The true grid entered in full is accepted.
  assert.deepStrictEqual(await solutionsOf(entered(doc, digits(board))), [solution(board)], `${label}: the true grid, entered`)

  // Valid sudoku grids that break the rule are refused, with the givens
  // replaced by the full grid so only the rule can refuse them.
  const breakers = ruleBreakers(digits(board))
  assert.ok(breakers.length > 0, `${label}: no relabelling breaks the rule`)
  for (const [a, b, grid] of breakers) {
    assert.deepStrictEqual(await solutionsOf(entered(doc, grid)), [], `${label}: swapping ${a} and ${b} passed`)
  }
}

// Both links carry the same Dutch Flatmates constraint, code included, so the
// 18-given link cannot drift from the shipped one unnoticed.
{
  const flatmates = link => decodeLinkFile(join(HERE, link)).puzzle.constraints.find(c => c.definition?.name === 'Dutch Flatmates')
  assert.deepStrictEqual(flatmates(BOARDS[1][0]), flatmates(BOARDS[0][0]), 'PUZZLE_LINK_18g.txt drifted from PUZZLE_LINK.txt')
}

// No local lane: one whole-grid constraint has no drawn groups to split.
for (const f of ['main-global.js', 'PUZZLE_LINK_local.txt', 'gen_local.json']) {
  assert.ok(!existsSync(join(HERE, f)), `${f} should not exist`)
}

console.log('PASS')
