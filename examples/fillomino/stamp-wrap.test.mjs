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

// `stamp` is where the counter starts. A wrapped run's mask is pre-filled with
// small stamps, the values the restarted counter walks through: a guard that
// restarts the counter without clearing the mask reads them as visited.
const run = (stamp, reps) => {
  const out = []
  for (let rep = 0; rep < reps; rep++) {
    const r = makeRng(2000 + rep).rnd
    const p = makePuzzle(truth, (c, v) => randomCandidates(r, 1, n, v))
    const inst = {}
    mod.setParams(inst, CELLS)
    if (stamp) {
      inst.stamp = stamp
      for (let i = 0; i < inst.mask.length; i++) inst.mask[i] = 1 + (i * 7 + rep) % 60
    }
    const log = console.log
    console.log = () => {}
    try { fixpoint(mod, inst, p) } finally { console.log = log }
    out.push(CELLS.map(c => [...p._cand.get(c)].sort((a, b) => a - b).join('')).join(','))
  }
  return out
}
// Every distance below the cap: each of the stamp's call sites is, for some
// distance, the one that wraps.
const fresh = run(0, 4)
for (let below = 0; below < 600; below++) {
  const stamp = 0x7FFFFFFF - below
  assert.deepStrictEqual(run(stamp, 4), fresh, `stamp ${stamp.toString(16)} changed what update deduces`)
}
assert.deepStrictEqual(run(0xFFFFFFF0, 4), fresh, 'a stamp past the Int32 range changed what update deduces')
console.log('PASS')
