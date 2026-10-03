// Seam: FillominoComponent.update with the visit stamp near the top of the
// mask's range (#665):
//   node examples/fillomino/stamp-wrap.test.mjs
//
// `instance.mask` is an Int32Array, so a counter that reached 2^31 would be
// stored negative and no cell would ever read as visited again. The component
// must clear the mask and restart the stamp before that, and `update` must
// deduce exactly what it does from a fresh instance. Same check as the isofill
// one in pooling.test.mjs, on the fillomino fixture.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'
import { installGlobals, makeIo, makeRng, makePuzzle, fixpoint, randomCandidates } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const mod = makeIo(HERE).load('FillominoComponent.js', ['setParams', 'update'])

const rows = JSON.parse(readFileSync(join(HERE, 'gen.json'), 'utf8')).grid
const n = rows.length
const CELLS = Array.from({ length: n * n }, (_, i) => i)
const truth = {}
rows.forEach((row, r) => [...row].forEach((ch, x) => { truth[r * n + x] = Number(ch) }))
installGlobals(1, n)

const run = stamp => {
  const out = []
  for (let rep = 0; rep < 100; rep++) {
    const r = makeRng(2000 + rep).rnd
    const p = makePuzzle(truth, (c, v) => randomCandidates(r, 1, n, v))
    const inst = {}
    mod.setParams(inst, CELLS)
    if (stamp) inst.stamp = stamp
    const log = console.log
    console.log = () => {}
    try { fixpoint(mod, inst, p) } finally { console.log = log }
    out.push(CELLS.map(c => [...p._cand.get(c)].sort((a, b) => a - b).join('')).join(','))
  }
  return out
}
const fresh = run(0)
for (const stamp of [0x7FFFFFF0, 0x7FFFFFFF, 0xFFFFFFF0]) {
  assert.deepStrictEqual(run(stamp), fresh, `stamp ${stamp.toString(16)} changed what update deduces`)
}
console.log('PASS')
