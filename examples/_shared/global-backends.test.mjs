// Every global backend must coerce the cell ids it gets from the app to plain
// integers before it registers a component (#276).
//
//   node examples/_shared/global-backends.test.mjs
//
// Why this matters. A drawn group carries its cell ids straight from the
// puzzle JSON; a global backend derives them from the board size, either
// through `puzzle.getCellAt` or by its own arithmetic on
// `puzzle.spec.size.width`. Both derived forms are numerically equal to the
// JSON ones and both compare `===` to them, but the app's solver runs about
// 1.3x slower on them (measured: examples/numbered-rooms/README.md, "The lane
// swap"). Coercing each id with `| 0` closes the whole gap. Rebuilding the
// arrays without coercing the values does not, so the cost travels with the
// value, not the array.
//
// This test cannot reproduce that cost -- it is a property of the JS engine's
// numeric representation, invisible from inside JS and absent in Node's mock.
// What it locks down is the coercion itself, so the `| 0` is not read as noise
// and deleted. The timing rows in each example's README are the evidence.
//
// The mock hands back a boxed `new Number(id)`: numerically the right cell,
// but not a plain number. A backend that coerces turns it back into one; a
// backend that passes it through is caught here.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync, existsSync, readdirSync } from 'fs'
import assert from 'assert'

const EXAMPLES = join(dirname(fileURLToPath(import.meta.url)), '..')

// A board W cells wide. Cell id = col + row * W, the app's own layout
// (`getIdFromCoords(e){return e.x+e.y*this.width}` in the shipped bundle), so
// `getCellAt(a, b)` is `a + b * W`. Off the board it returns undefined, as
// `getIdFromCoordsSafe` does -- and it counts those calls, because the
// coercion cannot report them: `undefined | 0` is 0, an in-range cell. So the
// backend's "every coordinate is in range" is checked here, not assumed.
function mockPuzzle (W) {
  const registered = []
  const p = {
    registered,
    offBoard: 0,
    spec: { size: { width: W, height: W } },
    getCellAt: (a, b) => {
      if (a < 0 || b < 0 || a >= W || b >= W) { p.offBoard++; return undefined }
      return new Number(a + b * W) // eslint-disable-line no-new-wrappers -- the point of the test
    },
    getRow: c => Math.floor(c / W),
    getColumn: c => c % W,
    addConstraintComponent: comp => registered.push(comp)
  }
  return p
}

const helpers = {
  naming: {
    getCellsDescription: cells => cells.join(','),
    getCellName: cell => String(cell)
  }
}

// Walk everything a component was constructed with and report any cell id that
// is not a plain number, and any that is off the board. The second check is
// what keeps the coercion honest: `getCellAt` returns undefined off the board
// and `undefined | 0` is 0 -- a real cell -- so a backend that strayed
// off-grid would coerce a miss into a silent, wrong cell 0 rather than fail
// loud (CODING_STANDARDS.md).
function badIdsIn (value, W, path = '') {
  if (Array.isArray(value)) return value.flatMap((v, i) => badIdsIn(v, W, `${path}[${i}]`))
  if (value instanceof Number) return [`${path}: boxed, not coerced`]
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value < W * W ? [] : [`${path}: off the board (${value})`]
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => badIdsIn(v, W, `${path}.${k}`))
  }
  return []
}

const dirs = readdirSync(EXAMPLES, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name !== '_shared')
  .map(d => d.name)
  .filter(name => existsSync(join(EXAMPLES, name, 'main-global.js')))
  .sort()

assert.ok(dirs.length > 0, 'found no global backends to check')

for (const name of dirs) {
  const src = readFileSync(join(EXAMPLES, name, 'main-global.js'), 'utf8')
  // The component constructors the backend calls, recorded rather than run.
  const ctorNames = [...new Set([...src.matchAll(/new (\w+Component)\(/g)].map(m => m[1]))]
  const ctors = ctorNames.map(n => {
    const Recorder = function (...args) { this.args = args }
    Object.defineProperty(Recorder, 'name', { value: n })
    return Recorder
  })
  const W = 11 // n = 9, the shipped board size
  const p = mockPuzzle(W)
  // The app runs a backend segment as a bare script with these names in scope;
  // a Function body is the closest Node equivalent.
  const fn = new Function('input', 'puzzle', 'helpers', ...ctorNames, src) // eslint-disable-line no-new-func
  fn(undefined, p, helpers, ...ctors)

  assert.ok(p.registered.length > 0, `${name}: registered nothing`)
  assert.strictEqual(p.offBoard, 0,
    `${name}/main-global.js asked for a cell off the board; \`| 0\` would turn that miss into cell 0`)
  const bad = p.registered.flatMap((c, i) => badIdsIn(c.args, W, `${name} component ${i} arg`))
  assert.deepStrictEqual(bad.slice(0, 5), [],
    `${name}/main-global.js must hand components plain in-range integer cell ids (${bad.length} bad)`)
}

console.log(`PASS (${dirs.length} global backends)`)
