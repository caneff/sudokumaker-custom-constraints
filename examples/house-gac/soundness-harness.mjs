// Soundness fuzz for this example's registration of the shared
// HouseGacComponent. The component's own math is proven in
// examples/_shared/house-gac.test.mjs; what is new here is main.js reading the
// rows, columns and regions whole (no ring to slice), and a bug there
// registers the wrong cells or too few houses with no error from the component.

import { join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'
import { installGlobals, makeIo, makeRng, fuzzSoundness, finishHarness } from '../_shared/harness-lib.mjs'
import { runBackend } from '../_shared/backend-runner.mjs'

const HERE = import.meta.dirname
const { load } = makeIo(HERE)
const { rnd } = makeRng(425)

installGlobals(1, 9)

const N = 9
const id = (r, c) => r * N + c
function houses () {
  const rows = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => id(r, c)))
  const cols = Array.from({ length: N }, (_, c) => Array.from({ length: N }, (_, r) => id(r, c)))
  const boxes = Array.from({ length: 9 }, (_, b) => {
    const br = Math.floor(b / 3) * 3
    const bc = (b % 3) * 3
    return Array.from({ length: 9 }, (_, k) => id(br + Math.floor(k / 3), bc + (k % 3)))
  })
  return { rows, cols, boxes }
}

const SRC = readFileSync(join(HERE, 'main.js'), 'utf8')
const registered = []
runBackend(SRC, {
  puzzle: { addConstraintComponent: c => registered.push(c), getRegions: () => houses().boxes },
  helpers: { geometry: { getAllRows: () => houses().rows, getAllColumns: () => houses().cols } }
})

assert.strictEqual(registered.length, 27, `expected 27 houses, got ${registered.length}`)
assert.deepStrictEqual([...new Set(registered.map(c => c.ctor))], ['HouseGacComponent'], 'wrong component registered')
assert.deepStrictEqual(registered.slice(0, 9).map(c => c.args[1]), houses().rows, 'rows are not registered in order')
assert.deepStrictEqual(registered.slice(9, 18).map(c => c.args[1]), houses().cols, 'columns are not registered in order')
assert.deepStrictEqual(registered.slice(18).map(c => c.args[1]), houses().boxes, 'boxes are not registered in order')
const names = registered.map(c => c.args[0])
assert.strictEqual(new Set(names).size, 27, 'house names are not distinct')
assert.deepStrictEqual([names[0], names[9], names[18]], ['row 1', 'column 1', 'box 1'], 'misnamed')

assert.throws(() => runBackend(SRC, {
  puzzle: { addConstraintComponent: () => {}, getRegions: () => houses().boxes.slice(0, 8) },
  helpers: { geometry: { getAllRows: () => houses().rows, getAllColumns: () => houses().cols } }
}), /expected 9 rows, 9 columns and 9 boxes/, 'a short region list did not throw')

console.log('registration: 27 houses, correctly named and ordered; short geometry throws')

const GRID = [
  '265783149',
  '387149562',
  '941562783',
  '594627831',
  '726831495',
  '138495627',
  '413956278',
  '872314956',
  '659278314'
].map(row => row.split('').map(Number))

const mod = load('../_shared/HouseGacComponent.js', ['setParams', 'update'])
const { rows: RS, cols: CS, boxes: BS } = houses()
const HOUSES = [...RS, ...CS, ...BS]
const truth = {}
for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) truth[r * N + c] = GRID[r][c]

function seeder (c, v) {
  const s = new Set([v])
  for (let d = 1; d <= N; d++) if (rnd() < 0.35) s.add(d)
  return [...s]
}

const ITERS = 500
const { failures } = fuzzSoundness('full-grid fuzz', {
  iters: ITERS,
  draw: () => ({
    truth,
    seed: seeder,
    houses: HOUSES,
    // As the app's constructor does: cells first, then setParams.
    parts: HOUSES.map(cells => {
      const inst = { cells }
      mod.setParams(inst, cells)
      return { mod, inst }
    })
  })
})

finishHarness(failures === 0)
