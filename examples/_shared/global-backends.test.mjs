// Every global backend must coerce the cell ids it gets from the app to plain
// integers before it registers a component (#276), and must build the frame it
// says it builds: the 4n lines of the shared frameGeometry, and a side label
// that names the side its clues actually sit on (#295).
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
import { frameGeometry } from './frame-geometry.mjs'

const EXAMPLES = join(dirname(fileURLToPath(import.meta.url)), '..')

// A board W cells wide and H cells tall. Cell id = col + row * W, the app's
// own layout (`getIdFromCoords(e){return e.x+e.y*this.width}` in the shipped
// bundle), so `getCellAt(a, b)` is `a + b * W`. Off the board it returns
// undefined, as `getIdFromCoordsSafe` does -- and it counts those calls,
// because the coercion cannot report them: `undefined | 0` is 0, an in-range
// cell. So the backend's "every coordinate is in range" is checked here, not
// assumed. The column bound is the width and the row bound is the height, so a
// backend that reads one dimension twice walks off a rectangular board.
function mockPuzzle (W, H) {
  const registered = []
  const p = {
    registered,
    offBoard: 0,
    spec: { size: { width: W, height: H } },
    getCellAt: (a, b) => {
      if (a < 0 || b < 0 || a >= W || b >= H) { p.offBoard++; return undefined }
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
function badIdsIn (value, cells, path = '') {
  if (Array.isArray(value)) return value.flatMap((v, i) => badIdsIn(v, cells, `${path}[${i}]`))
  if (value instanceof Number) return [`${path}: boxed, not coerced`]
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 && value < cells ? [] : [`${path}: off the board (${value})`]
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([k, v]) => badIdsIn(v, cells, `${path}.${k}`))
  }
  return []
}

const SIDES = ['L', 'R', 'T', 'B']
const LABELS = { left: 'L', right: 'R', top: 'T', bottom: 'B' }

// The side a component's name claims, or null when it names no side. Backends
// that name a component after its cells ("12,13,14") claim nothing.
function labelledSide (name) {
  const word = /\b(left|right|top|bottom)\b/i.exec(name)
  if (word) return LABELS[word[1].toLowerCase()]
  const letter = /\bside ([LRTB])\b/.exec(name)
  return letter ? letter[1] : null
}

// Every array of in-range cell ids reachable from a component's arguments
// whose length is one of the frame's group lengths. A bare number argument is
// not a cell group: a component takes a length or a digit that way, and a
// length is indistinguishable from a cell id. On a rectangular board a line
// across the board and a line down it have different lengths, so `lengths`
// holds both.
function cellGroupsIn (value, cells, lengths) {
  if (!value || typeof value !== 'object') return []
  if (Array.isArray(value)) {
    const ids = value.every(v => Number.isInteger(v) && v >= 0 && v < cells)
    if (ids && lengths.has(value.length)) return [value]
    return value.flatMap(v => cellGroupsIn(v, cells, lengths))
  }
  return Object.values(value).flatMap(v => cellGroupsIn(v, cells, lengths))
}

const dirs = readdirSync(EXAMPLES, { withFileTypes: true })
  .filter(d => d.isDirectory() && d.name !== '_shared')
  .map(d => d.name)
  .filter(name => existsSync(join(EXAMPLES, name, 'main-global.js')))
  .sort()

assert.ok(dirs.length > 0, 'found no global backends to check')

// Run one backend against a board W wide and H tall, and check the frame it
// builds against the one truthful copy of the geometry.
function checkBackend (name, src, W, H) {
  // The component constructors the backend calls, recorded rather than run.
  const ctorNames = [...new Set([...src.matchAll(/new (\w+Component)\(/g)].map(m => m[1]))]
  const ctors = ctorNames.map(n => {
    const Recorder = function (...args) { this.args = args }
    Object.defineProperty(Recorder, 'name', { value: n })
    return Recorder
  })
  const p = mockPuzzle(W, H)
  // The app runs a backend segment as a bare script with these names in scope;
  // a Function body is the closest Node equivalent.
  const fn = new Function('input', 'puzzle', 'helpers', ...ctorNames, src) // eslint-disable-line no-new-func
  fn(undefined, p, helpers, ...ctors)

  const where = `${name}/main-global.js on ${W}x${H}`
  assert.ok(p.registered.length > 0, `${where}: registered nothing`)
  assert.strictEqual(p.offBoard, 0,
    `${where} asked for a cell off the board; \`| 0\` would turn that miss into cell 0`)
  const cells = W * H
  const bad = p.registered.flatMap((c, i) => badIdsIn(c.args, cells, `${name} component ${i} arg`))
  assert.deepStrictEqual(bad.slice(0, 5), [],
    `${where} must hand components plain in-range integer cell ids (${bad.length} bad)`)

  // Every cell group a backend hands a component is either a line (all
  // interior) or a side's clues (all ring), so the two are told apart by their
  // cells, not by the component's argument order -- which differs per example.
  const nw = W - 2
  const nh = H - 2
  const geom = frameGeometry(nw, [3, 3], nh)
  const ring = new Map()
  for (const side of SIDES) {
    const count = side === 'L' || side === 'R' ? nh : nw
    ring.set(side, Array.from({ length: count }, (_, i) => geom.clueCell(side, i)))
  }
  const ringCells = new Set([...ring.values()].flat())
  const lengths = new Set([nw, nh])
  const groups = p.registered.flatMap(c => cellGroupsIn(c.args, cells, lengths))

  // 1. The line set: every line the backend registers is a frame line, and it
  // registers all 2 * nw + 2 * nh of them. A square frame is symmetric under
  // transpose, so on a square board this set is the same whichever way round
  // the coordinates are read and it pins the frame, not the reading (#295). A
  // rectangular board breaks that symmetry: a backend that reads one dimension
  // twice builds the wrong lines and fails right here (#299).
  const lines = groups.filter(g => g.every(id => !ringCells.has(id)))
  assert.deepStrictEqual(
    [...new Set(lines.map(g => g.join(',')))].sort(),
    [...new Set(geom.groups.map(g => g.cells.slice(1).join(',')))].sort(),
    `${where} must register the frame lines of frameGeometry`)

  // 2. The labels: a component named for a side holds that side's clues. This
  // is the check that pins the reading on a square board, since a transposed
  // `getCellAt` puts the top ring under the name "left" (#295). It reaches only
  // a backend that names a side -- where every component is named after its own
  // cells, a transposed frame carries the same names and nothing here can see
  // it.
  for (const c of p.registered) {
    const side = typeof c.args[0] === 'string' ? labelledSide(c.args[0]) : null
    if (!side) continue
    const clues = cellGroupsIn(c.args, cells, lengths).filter(g => g.every(id => ringCells.has(id)))
    for (const g of clues) {
      assert.deepStrictEqual([...g].sort((a, b) => a - b), ring.get(side),
        `${where}: "${c.args[0]}" does not hold side ${side}'s clue cells`)
    }
  }
}

// 11x11 is the shipped board size. 11x8 is the same width with a shorter
// board: it ships in no example, and it is here to give the line-set check an
// asymmetric frame to bite on.
const BOARDS = [[11, 11], [11, 8]]

for (const name of dirs) {
  const src = readFileSync(join(EXAMPLES, name, 'main-global.js'), 'utf8')
  for (const [W, H] of BOARDS) checkBackend(name, src, W, H)
}

console.log(`PASS (${dirs.length} global backends, ${BOARDS.length} board shapes)`)
