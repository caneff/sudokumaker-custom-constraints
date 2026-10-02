// `validate` on a full grid: the verdict is the whole rule. A 5 passes with a 1
// directly above it or a 9 directly below it; a top-row 5 has only the 9 below
// to lean on and a bottom-row 5 only the 1 above.
//
//   node examples/dutch-flatmates/validate.test.mjs

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'
import { installGlobals, makeIo, makePuzzle } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
installGlobals(1, 9)
const mod = load('DutchFlatmatesComponent.js', ['getAffectedCells', 'setParams', 'update', 'validate'])

const N = 9
const CELLS = Array.from({ length: N * N }, (_, i) => i)
const id = (r, c) => r * N + c

// The verdict on a grid of 2s with `placed` ({ 'r,c': digit }) written over it.
// The grid is not a sudoku: `validate` reads only the 5s and their neighbours.
function verdict (placed, { open = [] } = {}) {
  const truth = {}
  for (const c of CELLS) truth[c] = 2
  for (const [rc, d] of Object.entries(placed)) { const [r, c] = rc.split(',').map(Number); truth[id(r, c)] = d }
  const p = makePuzzle(truth, (c, v) => (open.includes(c) ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [v]))
  const inst = { cells: CELLS }
  mod.setParams(inst, CELLS)
  return mod.validate(inst, p)
}

// no 5 on the grid: nothing to judge
assert.strictEqual(verdict({}), true, 'a grid with no 5 must pass')

// an interior 5
assert.strictEqual(verdict({ '4,4': 5, '3,4': 1 }), true, '1 above passes')
assert.strictEqual(verdict({ '4,4': 5, '5,4': 9 }), true, '9 below passes')
assert.strictEqual(verdict({ '4,4': 5, '3,4': 1, '5,4': 9 }), true, 'both flatmates pass')
assert.strictEqual(verdict({ '4,4': 5 }), false, 'a 5 with neither flatmate fails')
assert.strictEqual(verdict({ '4,4': 5, '3,4': 9, '5,4': 1 }), false, 'a 9 above and a 1 below is the wrong way round')
assert.strictEqual(verdict({ '4,4': 5, '4,3': 1, '4,5': 9 }), false, 'a 1 and a 9 beside the 5 are not flatmates')
assert.strictEqual(verdict({ '4,4': 5, '3,4': 9 }), false, 'a 9 above is not a flatmate')
assert.strictEqual(verdict({ '4,4': 5, '5,4': 1 }), false, 'a 1 below is not a flatmate')

// the top row: only the 9 below counts
assert.strictEqual(verdict({ '0,3': 5, '1,3': 9 }), true, 'top-row 5 with the 9 below passes')
assert.strictEqual(verdict({ '0,3': 5 }), false, 'top-row 5 with no 9 below fails')
assert.strictEqual(verdict({ '0,3': 5, '1,3': 1 }), false, 'top-row 5 with a 1 below fails')
// the bottom row: only the 1 above counts
assert.strictEqual(verdict({ '8,3': 5, '7,3': 1 }), true, 'bottom-row 5 with the 1 above passes')
assert.strictEqual(verdict({ '8,3': 5 }), false, 'bottom-row 5 with no 1 above fails')
assert.strictEqual(verdict({ '8,3': 5, '7,3': 9 }), false, 'bottom-row 5 with a 9 above fails')
// no wrap-around: the cell above the top row and below the bottom row is not
// the other end of the column
assert.strictEqual(verdict({ '0,3': 5, '8,3': 1 }), false, 'a 1 at the foot of the column is not above a top-row 5')
assert.strictEqual(verdict({ '8,3': 5, '0,3': 9 }), false, 'a 9 at the head of the column is not below a bottom-row 5')
// corners and the left/right edges read the same column
assert.strictEqual(verdict({ '0,0': 5, '1,0': 9 }), true, 'top-left 5 with the 9 below passes')
assert.strictEqual(verdict({ '8,8': 5, '7,8': 1 }), true, 'bottom-right 5 with the 1 above passes')
assert.strictEqual(verdict({ '4,0': 5, '3,0': 1 }), true, 'left-edge 5 reads its own column')
assert.strictEqual(verdict({ '4,8': 5, '3,8': 1 }), true, 'right-edge 5 reads its own column')
// one bad 5 among good ones fails the grid
assert.strictEqual(verdict({ '1,1': 5, '0,1': 1, '6,6': 5, '7,6': 9, '4,4': 5 }), false, 'a single bad 5 fails the grid')

// an unfilled grid is not judged, even with a 5 that already has no flatmate
assert.strictEqual(verdict({ '4,4': 5 }, { open: [id(0, 0)] }), true, 'an incomplete grid passes')

// the shipped solution is a full grid that satisfies the rule
const gen = JSON.parse(readFileSync(join(HERE, 'gen.json'), 'utf8'))
const shipped = {}
gen.grid.forEach((row, r) => [...row].forEach((ch, c) => { shipped[`${r},${c}`] = Number(ch) }))
assert.strictEqual(verdict(shipped), true, 'the shipped solution must pass')
const fives = Object.entries(shipped).filter(([, d]) => d === 5)
assert.strictEqual(fives.length, 9, 'the shipped solution has nine 5s, each judged')
// taking a 5's flatmate away breaks the shipped solution
{
  const [[rc]] = fives
  const [r, c] = rc.split(',').map(Number)
  const broken = { ...shipped }
  const above = shipped[`${r - 1},${c}`]
  const below = shipped[`${r + 1},${c}`]
  if (r > 0 && above === 1) broken[`${r - 1},${c}`] = 2
  if (r < N - 1 && below === 9) broken[`${r + 1},${c}`] = 2
  assert.strictEqual(verdict(broken), false, 'removing the 5\'s flatmate must fail the shipped grid')
}

// the component registers over the whole grid and wakes on any cell of it
assert.deepStrictEqual(mod.getAffectedCells(CELLS), CELLS)

console.log('validate: full-grid rule, top and bottom edges, incomplete grids, shipped solution')
