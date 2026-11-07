// Strength check for IsofillComponent.update: a rewrite must not quietly prune
// LESS than before.
//
// The rules read placed digits and walk regions, so a state drawn at random is
// contradictory and prunes nothing worth comparing. States are drawn around a
// real solution instead.

import { join } from 'path'
import { readFileSync } from 'fs'
import { installGlobals, makeIo, makeRng, fixpoint, randomCandidates, strengthSweep } from '../_shared/harness-lib.mjs'
import { N, rows, bent, shapeOf, tall, wide, rowsTall, bentWide } from './fixture.mjs'

const HERE = import.meta.dirname
const { load } = makeIo(HERE)

// The floor: the component as it stands at the commit that pins this test, a
// frozen copy in `.golden/` (the Pants sandbox holds no git history). Raising it
// means replacing the copy, and the commit in its name, in the same commit as
// the stronger component.
//
// The copy reads a side off the cell count and uses it for two things only:
// its neighbour lists and its border cycle (and the two scratch rows sized
// from the border). So a board that is not square is handed to it by
// replacing those, after its own setParams, with the board's real ones; the
// copy itself stays as it was pinned.
const REF_COMMIT = 'db93523'
const NAMES = ['setParams', 'update']
const cur = load('IsofillComponent.js', NAMES)
const golden = load(`.golden/IsofillComponent.${REF_COMMIT}.js`, NAMES)
const gridNeighbours = (w, h) => Array.from({ length: w * h }, (_, i) => {
  const x = i % w
  const y = Math.floor(i / w)
  return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]
    .filter(([a, b]) => a >= 0 && a < w && b >= 0 && b < h)
    .map(([a, b]) => b * w + a)
})
// The border cells clockwise from the top-left corner.
const borderCycle = (w, h) => [
  ...Array.from({ length: w }, (_, x) => x),
  ...Array.from({ length: h - 1 }, (_, k) => (k + 1) * w + w - 1),
  ...Array.from({ length: w - 1 }, (_, k) => (h - 1) * w + w - 2 - k),
  ...Array.from({ length: h - 2 }, (_, k) => (h - 2 - k) * w)
]
const ref = {
  ...golden,
  setParams (inst, cells, w, h) {
    golden.setParams(inst, cells)
    if (w === h) return
    inst.nbrs = gridNeighbours(w, h)
    inst.border = borderCycle(w, h)
    inst.at = new Int16Array(inst.border.length)
    inst.dig = new Int8Array(inst.border.length)
  }
}

const { rnd } = makeRng(9001)
const REPS = 500

installGlobals(0, 9)

const shipped = {}
JSON.parse(readFileSync(join(HERE, 'gen.json'), 'utf8')).grid
  .forEach((row, r) => [...row].forEach((ch, x) => { shipped[r * N + x] = Number(ch) }))

const SQUARE = shapeOf(N, N)

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
