// Strength check for IsofillComponent.update: a rewrite must not quietly prune
// LESS than before.
//
// The rules read placed digits and walk regions, so a state drawn at random is
// contradictory and prunes nothing worth comparing. States are drawn around a
// real solution instead.

import { join } from 'path'
import { readFileSync } from 'fs'
import { installGlobals, makeIo, makeRng, fixpoint, randomCandidates, strengthSweep } from '../_shared/harness-lib.mjs'

const HERE = import.meta.dirname
const { load } = makeIo(HERE)

// The floor: the component as it stands at the commit that pins this test, a
// frozen copy in `.golden/` (the Pants sandbox holds no git history). Raising it
// means replacing the copy, and the commit in its name, in the same commit as
// the stronger component. The commit must be one whose setParams takes a width
// and a height: the first copy read the side off the cell count, so it could
// not be held to a rectangle.
const REF_COMMIT = 'bb1ade0'
const NAMES = ['setParams', 'update']
const cur = load('IsofillComponent.js', NAMES)
const ref = load(`.golden/IsofillComponent.${REF_COMMIT}.js`, NAMES)

const { rnd } = makeRng(9001)
const REPS = 500

installGlobals(0, 9)

const N = 10
const CELLS = Array.from({ length: N * N }, (_, i) => i)

const rows = {}
for (const c of CELLS) rows[c] = Math.floor(c / N)

// Rows 2r,2r+1: digit 2r takes cols 0-5 of the top row and cols 0-3 of the
// bottom row; digit 2r+1 takes the rest. Ten cells each, both connected.
const bent = {}
for (const c of CELLS) {
  const r = Math.floor(c / N)
  const x = c % N
  const top = r % 2 === 0
  const band = Math.floor(r / 2)
  bent[c] = (top ? x <= 5 : x <= 3) ? 2 * band : 2 * band + 1
}

const shipped = {}
JSON.parse(readFileSync(join(HERE, 'gen.json'), 'utf8')).grid
  .forEach((row, r) => [...row].forEach((ch, x) => { shipped[r * N + x] = Number(ch) }))

// Boards that are not square: 6 wide by 10 high with one row per digit, and
// 10 wide by 6 high with column pairs bent into regions of six.
const shapeOf = (w, h) => ({ w, h, cells: Array.from({ length: w * h }, (_, i) => i) })
const SQUARE = shapeOf(N, N)
const tall = shapeOf(6, 10)
const wide = shapeOf(10, 6)
const rowsTall = {}
for (const c of tall.cells) rowsTall[c] = Math.floor(c / tall.w)
const bentWide = {}
for (const c of wide.cells) {
  const x = c % wide.w
  const y = Math.floor(c / wide.w)
  bentWide[c] = ((x % 2 === 0 ? y <= 3 : y <= 1) ? x - (x % 2) : x - (x % 2) + 1)
}

const apply = shape => (mod, p) => {
  const inst = {}
  mod.setParams(inst, shape.cells, shape.w, shape.h)
  fixpoint(mod, inst, p)
}

for (const [name, shape, truth] of [['rows', SQUARE, rows], ['bent', SQUARE, bent], ['shipped', SQUARE, shipped], ['rows 6x10', tall, rowsTall], ['bent 10x6', wide, bentWide]]) {
  strengthSweep(`isofill ${name} fixture`, {
    solvable: true,
    cur,
    ref,
    apply: apply(shape),
    * states () {
      for (let rep = 0; rep < REPS; rep++) {
        const start = new Map()
        for (const c of shape.cells) start.set(c, randomCandidates(rnd, 0, 9, truth[c]))
        yield start
      }
    }
  })
}
console.log('PASS')
