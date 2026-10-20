// Soundness of the combined backend: one IsofillComponent over the interior
// and one SkyscraperOneSidedComponent per ring clue, as main-global.js
// registers them, run together to a fixpoint on the shipped board. Neither
// component may remove a candidate the recorded solution needs.
//
// Each component has its own harness in its own example; what is new here is
// the two side by side on one board, where a clue component reads lines that
// repeat digits and the ISOFILL component reads cells a clue has narrowed.
//
// Also the JS half of the clue rule's agreement (build_size.test.py holds the
// Python half): with a line pinned to the recorded solution, the component
// keeps exactly the clue gen.json recorded, the one `visible` read.

import assert from 'assert'
import { installGlobals, makeIo, makeRng, makePuzzle, makeSeeder, fixpointAll, fuzzSoundness } from '../_shared/harness-lib.mjs'
import { combinedBoard } from './combined-board.mjs'

const HERE = import.meta.dirname
const { read, load } = makeIo(HERE)
const { rnd } = makeRng(858)

installGlobals(1, 9)
const NAMES = ['setParams', 'update']
const MODS = {
  IsofillComponent: load('IsofillComponent.js', NAMES),
  SkyscraperOneSidedComponent: load('SkyscraperOneSidedComponent.js', NAMES)
}

const { n, truth, registered, parts } = combinedBoard(HERE, read)
const ALL = Array.from({ length: n }, (_, i) => i + 1)

assert.strictEqual(registered.filter(c => c.ctor === 'IsofillComponent').length, 1, 'one ISOFILL component')
const clues = registered.filter(c => c.ctor === 'SkyscraperOneSidedComponent')
assert.strictEqual(clues.length, 4 * n, 'one clue component per ring clue')

// The lines must repeat a digit, or this board says nothing about the case
// the one-sided DP is here for.
const repeating = clues.filter(c => new Set(c.args[2].map(id => truth[id])).size < n).length
assert.ok(repeating > 0, 'no clued line of the shipped board repeats a digit')

// The clue the component keeps on a pinned line is the recorded one.
for (const c of clues) {
  const [, clue, line] = c.args
  const p = makePuzzle(truth, (id, v) => (id === clue ? ALL : [v]))
  fixpointAll(parts(MODS).filter(part => part.mod === MODS.SkyscraperOneSidedComponent), p)
  assert.deepStrictEqual([...p._cand.get(clue)], [truth[clue]],
    `clue cell ${clue}: the component keeps ${[...p._cand.get(clue)]} on line ${line.map(id => truth[id]).join('')}, gen.json records ${truth[clue]}`)
}
console.log(`clue agreement: all ${clues.length} recorded clues kept alone on their pinned lines (${repeating} lines repeat a digit)`)

// ponytail: FUZZ=20000 for the deep run before a ship.
const FUZZ = Number(process.env.FUZZ) || 1000
const seeder = makeSeeder(rnd, ALL)
const r = fuzzSoundness('isofill-skyscraper combined backend', {
  iters: FUZZ,
  draw: () => ({ truth, seed: seeder, parts: parts(MODS) })
})
assert.strictEqual(r.failures, 0, `${r.failures} soundness failures`)
assert.ok(r.fired > 0, 'the combined backend never removed a candidate: the fuzz checked nothing')
console.log('PASS')
