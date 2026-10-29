// `instance.seen` is an Int32Array, so a search number that reached 2^31 would
// be stored negative and no cell would ever read as visited again. The component
// must clear the marks and restart the numbers before that, and `update` must
// deduce exactly what it does from a fresh instance. Same check as the isofill
// one in pooling.test.mjs, on the fillomino fixture.

import { join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'
import { installGlobals, makeIo, makeRng, makePuzzle, fixpoint, randomCandidates } from '../_shared/harness-lib.mjs'

const HERE = import.meta.dirname
const mod = makeIo(HERE).load('FillominoComponent.js', ['setParams', 'update'])

const rows = JSON.parse(readFileSync(join(HERE, 'gen.json'), 'utf8')).grid
const n = rows.length
const CELLS = Array.from({ length: n * n }, (_, i) => i)
const truth = {}
rows.forEach((row, r) => [...row].forEach((ch, x) => { truth[r * n + x] = Number(ch) }))
installGlobals(1, n)

// `stamp` is where the search number starts. A wrapped run's marks are
// pre-filled with small numbers, the values the restarted count walks through:
// a guard that restarts the count without clearing the marks reads them as
// visited. The constructor allocates the marks through newVisitMarks (#736):
// the limit it records is what nextVisit wraps at, and a bare Int32Array would
// never wrap.
{
  const inst = {}
  mod.setParams(inst, CELLS, n, n)
  assert.strictEqual(inst.seen.visitLimit, 0x7FFFFFFF, 'the marks were not allocated through newVisitMarks')
}

const run = (stamp, reps) => {
  const out = []
  for (let rep = 0; rep < reps; rep++) {
    const r = makeRng(2000 + rep).rnd
    const p = makePuzzle(truth, (c, v) => randomCandidates(r, 1, n, v))
    const inst = {}
    mod.setParams(inst, CELLS, n, n)
    if (stamp) {
      inst.visit = stamp
      for (let i = 0; i < inst.seen.length; i++) inst.seen[i] = 1 + (i * 7 + rep) % 60
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
