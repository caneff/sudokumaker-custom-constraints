// Runs the code embedded in the committed links, not the tree, through the
// real solver bundle; build_link.test.py catches drift between the two.
//
// What a green run does not cover: the live app at sudokumaker.app (how the
// link loads and renders, the rules text on the play page, the app's own
// verdict; `app-open.mjs --live` is that check), and whether the deduction
// pays for itself in solve time (`just time dutch-flatmates`).

import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import assert from 'assert'
import { decodeLinkFile, solveDocument } from '../_shared/bundle-solve-lib.mjs'

const HERE = import.meta.dirname
const N = 9

const BOARDS = [
  ['PUZZLE_LINK.txt', 'gen.json', 23],
  ['PUZZLE_LINK_18g.txt', 'gen_18g.json', 18]
]

const load = (link, gen) => ({
  doc: decodeLinkFile(join(HERE, link)),
  board: JSON.parse(readFileSync(join(HERE, gen), 'utf8'))
})

const digits = board => board.grid.flatMap(row => [...row].map(Number))
const solution = board => digits(board).join('')

// Stated from the spec, independent of the component.
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

  {
    const { type, width, height, comment } = doc.puzzle
    assert.deepStrictEqual({ type, width, height }, { type: 'custom', width: N, height: N }, label)
    assert.ok(comment.startsWith('Normal sudoku rules apply. '), `${label}: rules text opening`)
    assert.match(comment, /Dutch Flatmates: every 5 needs a flatmate, a 1 directly above it or a 9 directly below it\./, label)
    const flatmates = doc.puzzle.constraints.filter(c => c.definition?.name === 'Dutch Flatmates')
    assert.strictEqual(flatmates.length, 1, `${label}: one Dutch Flatmates component`)
    const given = doc.puzzle.cells.map(c => c?.value).filter(v => v !== undefined && v !== null && v !== '')
    assert.strictEqual(given.length, givenCount, `${label}: given count`)
    doc.puzzle.cells.forEach((c, i) => {
      if (c?.value) assert.strictEqual(c.value, digits(board)[i], `${label}: given at cell ${i}`)
    })
  }

  assert.ok(flatmatesOk(digits(board)), `${label}: recorded solution breaks the rule`)

  assert.deepStrictEqual(await solutionsOf(structuredClone(doc)), [solution(board)], `${label}: the link's solutions`)

  // Shipped board only: the 18-given board leaves up to 10^8 plain
  // completions, too many for the solver to list.
  if (givenCount === 23) {
    const plain = structuredClone(doc)
    plain.puzzle.constraints = plain.puzzle.constraints.filter(c => c.definition?.name !== 'Dutch Flatmates')
    const { solutions } = await solveDocument(plain)
    assert.ok(solutions.length > 1, `${label}: ${solutions.length} solutions without the rule`)
    assert.ok(solutions.includes(solution(board)), `${label}: plain sudoku lost the solution`)
    assert.ok(solutions.some(s => !flatmatesOk([...s].map(Number))), `${label}: no plain completion breaks the rule`)
  }

  assert.deepStrictEqual(await solutionsOf(entered(doc, digits(board))), [solution(board)], `${label}: the true grid, entered`)

  const breakers = ruleBreakers(digits(board))
  assert.ok(breakers.length > 0, `${label}: no relabelling breaks the rule`)
  for (const [a, b, grid] of breakers) {
    assert.deepStrictEqual(await solutionsOf(entered(doc, grid)), [], `${label}: swapping ${a} and ${b} passed`)
  }
}

{
  const flatmates = link => decodeLinkFile(join(HERE, link)).puzzle.constraints.find(c => c.definition?.name === 'Dutch Flatmates')
  assert.deepStrictEqual(flatmates(BOARDS[1][0]), flatmates(BOARDS[0][0]), 'PUZZLE_LINK_18g.txt drifted from PUZZLE_LINK.txt')
}

// No local lane: one whole-grid constraint has no drawn groups to split.
for (const f of ['main-global.js', 'PUZZLE_LINK_local.txt', 'gen_local.json']) {
  assert.ok(!existsSync(join(HERE, f)), `${f} should not exist`)
}

console.log('PASS')
