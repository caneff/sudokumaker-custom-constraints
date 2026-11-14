// Soundness of the combined backend: one IsofillComponent over the interior
// and one SkyscraperOneSidedComponent per ring clue, as main-global.js
// registers them, run together to a fixpoint on the shipped board. Neither
// component may remove a candidate the recorded solution needs.
//
// Each component has its own harness in its own example; what is new here is
// the two side by side on one board, where a clue component reads lines that
// repeat digits and the ISOFILL component reads cells a clue has narrowed.
//
// Run on the shipped 9x9 and on a 4x3 rectangle (three digits, four cells a
// region), since the interior is any rectangle its component accepts.
//
// Also the JS half of the clue rule's agreement (build_size.test.py holds the
// Python half): with a line pinned to the recorded solution, the component
// keeps exactly the clue gen.json recorded, the one `visible` read.

import assert from 'assert'
import { installGlobals, makeIo, makeRng, makePuzzle, makeSeeder, fixpointAll, fuzzSoundness, patchSource } from '../_shared/harness-lib.mjs'
import { readFileSync } from 'fs'
import { join } from 'path'
import { combinedBoard } from './combined-board.mjs'

const HERE = import.meta.dirname
const { read, load } = makeIo(HERE)
const { rnd } = makeRng(858)

// Every lifecycle function each file defines, so the fuzz also asks both
// components' `validate` to accept the true solution.
const MODS = {
  IsofillComponent: load('IsofillComponent.js'),
  SkyscraperOneSidedComponent: load('SkyscraperOneSidedComponent.js')
}

// Each component with a planted `validate` that rejects every filled board,
// the other left as shipped: the fuzz must go red on either, or it never
// asked that component's validate.
const rejecting = file => load(file, [], src => patchSource(src, 'function validate (instance, puzzle) {\n', 'function validate (instance, puzzle) {\n  return false\n'))
const PLANTED = Object.keys(MODS).map(ctor => ({ ...MODS, [ctor]: rejecting(`${ctor}.js`) }))

// build_size.py's `visible`: the buildings strictly taller than every one
// before them, a tie hidden.
function visible (line) {
  let count = 0
  let tallest = 0
  for (const d of line) if (d > tallest) { count++; tallest = d }
  return count
}

// A rectangle's gen: three regions of four cells on a 4 wide, 3 tall board,
// every ring clue read off the grid.
function rectangleGen () {
  const grid = [[1, 1, 2, 2], [1, 1, 2, 2], [3, 3, 3, 3]]
  const col = c => grid.map(row => row[c])
  const clue = {}
  grid.forEach((row, r) => {
    clue[`L${r}`] = visible(row)
    clue[`R${r}`] = visible(row.slice().reverse())
  })
  grid[0].forEach((_, c) => {
    clue[`T${c}`] = visible(col(c))
    clue[`B${c}`] = visible(col(c).reverse())
  })
  return { grid, clue, digits: 3 }
}

// ponytail: FUZZ=20000 for the deep run before a ship.
const FUZZ = Number(process.env.FUZZ) || 1000

function checkBoard (label, gen) {
  const { n, W, H, truth, registered, parts } = combinedBoard(HERE, read, gen)
  const ALL = Array.from({ length: n }, (_, i) => i + 1)
  installGlobals(1, n) // the app's digit range is the board's: 1..3 on the rectangle

  assert.strictEqual(registered.filter(c => c.ctor === 'IsofillComponent').length, 1, `${label}: one ISOFILL component`)
  const [iso] = registered.filter(c => c.ctor === 'IsofillComponent')
  assert.deepStrictEqual(iso.args.slice(2), [W - 2, H - 2], `${label}: ISOFILL gets the interior's width and height`)
  const clues = registered.filter(c => c.ctor === 'SkyscraperOneSidedComponent')
  assert.strictEqual(clues.length, 2 * (W - 2 + H - 2), `${label}: one clue component per ring clue`)

  // The lines must repeat a digit, or this board says nothing about the case
  // the one-sided DP is here for.
  const repeating = clues.filter(c => new Set(c.args[2].map(id => truth[id])).size < c.args[2].length).length
  assert.ok(repeating > 0, `${label}: no clued line of the board repeats a digit`)

  // The clue the component keeps on a pinned line is the recorded one.
  for (const c of clues) {
    const [, clue, line] = c.args
    const p = makePuzzle(truth, (id, v) => (id === clue ? ALL : [v]))
    fixpointAll(parts(MODS).filter(part => part.mod === MODS.SkyscraperOneSidedComponent), p)
    assert.deepStrictEqual([...p._cand.get(clue)], [truth[clue]],
      `${label}: clue cell ${clue}: the component keeps ${[...p._cand.get(clue)]} on line ${line.map(id => truth[id]).join('')}, gen.json records ${truth[clue]}`)
  }
  console.log(`${label}: clue agreement: all ${clues.length} recorded clues kept alone on their pinned lines (${repeating} lines repeat a digit)`)

  const seeder = makeSeeder(rnd, ALL)
  const r = fuzzSoundness(`isofill-skyscraper combined backend, ${label}`, {
    iters: FUZZ,
    draw: () => ({ truth, seed: seeder, parts: parts(MODS) })
  })
  assert.strictEqual(r.failures, 0, `${label}: ${r.failures} soundness failures`)
  assert.ok(r.fired > 0, `${label}: the combined backend never removed a candidate: the fuzz checked nothing`)

  for (const mods of PLANTED) {
    const planted = fuzzSoundness(`${label}, planted rejecting validate`, {
      iters: 5,
      log: () => {},
      draw: () => ({ truth, seed: seeder, parts: parts(mods) })
    })
    assert.ok(planted.validateRejects > 0, `${label}: a validate that rejects the truth went unasked`)
  }
  console.log(`${label}: a planted rejecting validate on either component goes red`)
}

checkBoard('shipped 9x9', JSON.parse(readFileSync(join(HERE, 'gen.json'), 'utf8')))
checkBoard('rectangle 4x3', rectangleGen())
console.log('PASS')
