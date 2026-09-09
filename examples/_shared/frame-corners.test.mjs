// The frame backend pins the four corner cells, and pins the right ones.
//
//   node examples/_shared/frame-corners.test.mjs
//
// Why this matters. A frame board is an interior sudoku inside a one-cell clue
// ring. Every ring cell but the corners is one line's clue, so a component
// reaches it; a corner sits on two edges, belongs to no line, no region and no
// cage, and nothing reaches it at all. Left free it takes any digit, and the
// app reports the board NOT UNIQUE -- measured on the shipped skyscraper 9x9,
// which goes from unique to not-unique in 400ms when the corners are emptied
// and nothing replaces them (#394). This backend holds them down invisibly: a
// component pins the cell, so the board draws no digit there for a recipient
// to read.
//
// The board is run rectangular here (W != H) on purpose: the two dimensions
// are read from different fields, and a backend that reads one of them twice
// names cells that are not corners on any board that is not square.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'
import { runBackend } from './backend-runner.mjs'

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'frame-corners.js'), 'utf8')

// Run the backend against a W x H board and return what it registered.
function run (W, H, minDigit) {
  const registered = []
  const { ctorNames } = runBackend(SRC, {
    puzzle: { addConstraintComponent: c => registered.push(c) },
    helpers: { cellIds: { width: W, height: H }, digits: { minDigit } },
    globals: { SudokuDigitSet: { from: values => ({ digits: [...values] }) } }
  })
  return { registered, ctorNames }
}

// A cell id is `x + y * width` (the app's own layout), so the corners of a
// W x H board are these four. Written out rather than derived from the
// backend's own arithmetic, so the assertion can disagree with the code.
const cornersOf = (W, H) => [0, W - 1, W * (H - 1), W * H - 1]

// A pin is a PredefinedCandidatesComponent and nothing else. A HouseComponent
// over the four corners would also take one argument list of four cells and
// would also leave the board drawing nothing -- and would let every corner
// hold a different digit, which is the not-unique board this backend exists to
// close. The type is the rule here, so the type is asserted.
const PIN = 'PredefinedCandidatesComponent'

for (const [W, H, minDigit] of [[11, 11, 1], [8, 6, 1], [6, 8, 0], [5, 12, 2]]) {
  const { registered, ctorNames } = run(W, H, minDigit)
  const where = `${W}x${H}, minDigit ${minDigit}`

  assert.deepStrictEqual(ctorNames, [PIN], `${where}: the backend must build only a ${PIN}`)
  assert.strictEqual(registered.length, 1, `${where}: expected exactly one component, got ${registered.length}`)
  assert.strictEqual(registered[0].ctor, PIN, `${where}: a corner must be PINNED, not merely made distinct`)

  const args = registered[0].args
  const cells = args.find(a => Array.isArray(a) && a.length === 4)
  assert.deepStrictEqual(cells, cornersOf(W, H),
    `${where}: pinned the wrong cells`)

  const digits = args.find(a => a && !Array.isArray(a) && Array.isArray(a.digits))
  assert.deepStrictEqual(digits && digits.digits, [minDigit],
    `${where}: a corner must be pinned to one digit, or it is still free`)

  const name = args.find(a => typeof a === 'string')
  assert.ok(name && name.length > 0, `${where}: the component must carry a name`)
}

console.log('frame-corners self-check OK')
