// Soundness fuzz for this example's own use of the shared HouseGacComponent:
// that main.js registers exactly the 27 houses a plain 9x9 has (9 rows, 9
// columns, 9 boxes, correctly numbered), and that running all 27 instances
// together over a real solved grid never removes a cell's TRUE value.
//
// HouseGacComponent.js's own soundness (the bitmask GAC math, exact vs a
// matching-based reference, the interleaved-yield and gate cases) is already
// proven in examples/_shared/house-gac.test.mjs -- this file does not repeat
// that. What is new here is the *registration*: this board has no ring to
// slice off (examples/_shared/house-gac.js assumes one and cannot register
// this board -- see README, "Why its own backend"), so main.js reads
// helpers.geometry.getAllRows()/getAllColumns() and puzzle.getRegions() whole.
// A bug there would register the wrong cells, or too few houses, with no
// error from the shared component -- it only ever sees whatever cells it is
// handed.
//
//   node examples/house-gac/soundness-harness.mjs

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'
import { installGlobals, makeIo, makeRng, DigitSet } from '../_shared/harness-lib.mjs'
import { runBackend } from '../_shared/backend-runner.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const { rnd } = makeRng(425)

installGlobals(1, 9)

// ---- registration: main.js on a real plain 9x9 ----------------------------
// helpers.geometry here returns exactly what the app's own geometry helper
// returns for a 9x9 (row-major ids 0..80), and puzzle.getRegions() the same
// 3x3 boxes a "Rows & Columns" backend's region constraint declares.
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

// A resized geometry (a short row list) must fail loud rather than register a
// weaker filter silently -- main.js's own guard.
assert.throws(() => runBackend(SRC, {
  puzzle: { addConstraintComponent: () => {}, getRegions: () => houses().boxes.slice(0, 8) },
  helpers: { geometry: { getAllRows: () => houses().rows, getAllColumns: () => houses().cols } }
}), /expected 9 rows, 9 columns and 9 boxes/, 'a short region list did not throw')

console.log('registration: 27 houses, correctly named and ordered; short geometry throws')

// ---- full-grid soundness: all 27 houses together, over a real solution ----
// The shipped grid this example ships (README, "The 81/81 grid").
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

function fixpointAll (cand) {
  for (let pass = 0; pass < 20; pass++) {
    let changed = false
    for (const cells of HOUSES) {
      const inst = {}
      mod.setParams(inst, cells)
      const p = {
        getCellsCanHaveRepeats: () => false,
        getCandidatesBitMask: cell => { let m = 0; for (const d of cand.get(cell)) m |= 1 << d; return m },
        // The app takes a DigitSet here and nothing else (harness-lib.mjs's
        // own makePuzzle carries the same guard): a plain array passes in
        // Node and silently removes nothing in the app -- a rule went dead
        // that way.
        removeCandidatesFromCell: (set, cell) => {
          if (!(set instanceof DigitSet)) throw new TypeError('removeCandidatesFromCell wants a DigitSet')
          const before = cand.get(cell).size
          for (const d of set) cand.get(cell).delete(d)
          if (cand.get(cell).size !== before) changed = true
        },
        stop: (message = '', cells = []) => ({ message, cells, __stop: true })
      }
      for (const r of mod.update(inst, p)) if (r && r.__stop) return { stopped: true }
    }
    if (!changed) break
  }
  return { stopped: false }
}

const ITERS = 500
let violations = 0
for (let iter = 0; iter < ITERS; iter++) {
  const cand = new Map()
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) cand.set(r * N + c, new Set(seeder(r * N + c, GRID[r][c])))
  const { stopped } = fixpointAll(cand)
  if (stopped) { violations++; console.log('iter', iter, 'stopped on a grid that has a solution'); continue }
  for (const [cell, v] of Object.entries(truth)) {
    if (!cand.get(+cell).has(v)) { violations++; console.log('iter', iter, 'cell', cell, 'lost its true digit', v) }
  }
}
console.log(`full-grid fuzz: ${ITERS} states, ${violations} violations`)

const ok = violations === 0
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
