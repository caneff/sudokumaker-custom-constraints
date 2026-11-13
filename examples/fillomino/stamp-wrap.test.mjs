// `instance.seen` is an Int32Array, so a search number that reached 2^31 would
// be stored negative and no cell would ever read as visited again. The component
// must clear the marks and restart the numbers before that, and `update` must
// deduce exactly what it does from a fresh instance. Same check as the isofill
// one in pooling.test.mjs, on the fillomino fixture.

import assert from 'assert'
import { pinned } from './fixture.mjs'
import { construct, installGlobals, makeIo, makeRng, makePuzzle, fixpoint, randomCandidates } from '../_shared/harness-lib.mjs'

const HERE = import.meta.dirname
const mod = makeIo(HERE).load('FillominoComponent.js')

const { truth, width: n, cap } = pinned
const CELLS = Array.from({ length: n * n }, (_, i) => i)
installGlobals(1, cap)

// `visit` is where the search number starts. A wrapped run's marks are
// pre-filled with small numbers, the values the restarted count walks through:
// a guard that restarts the count without clearing the marks reads them as
// visited. The constructor allocates the marks through newVisitMarks (#736):
// the limit it records is what nextVisit wraps at, and a bare Int32Array would
// never wrap.
{
  const inst = construct(mod, 'fillomino', CELLS, n, n)
  assert.strictEqual(inst.seen.visitLimit, 0x7FFFFFFF, 'the marks were not allocated through newVisitMarks')
}

const run = (visit, reps) => {
  const out = []
  for (let rep = 0; rep < reps; rep++) {
    const r = makeRng(2000 + rep).rnd
    const p = makePuzzle(truth, (c, v) => randomCandidates(r, 1, cap, v))
    const inst = construct(mod, 'fillomino', CELLS, n, n)
    if (visit) {
      inst.visit = visit
      for (let i = 0; i < inst.seen.length; i++) inst.seen[i] = 1 + (i * 7 + rep) % 60
    }
    const log = console.log
    console.log = () => {}
    try { fixpoint(mod, inst, p) } finally { console.log = log }
    out.push(CELLS.map(c => [...p._cand.get(c)].sort((a, b) => a - b).join('')).join(','))
  }
  return out
}
// Every distance below the cap: each of the visit number's call sites is, for some
// distance, the one that wraps.
const fresh = run(0, 4)
for (let below = 0; below < 600; below++) {
  const visit = 0x7FFFFFFF - below
  assert.deepStrictEqual(run(visit, 4), fresh, `visit ${visit.toString(16)} changed what update deduces`)
}
assert.deepStrictEqual(run(0xFFFFFFF0, 4), fresh, 'a visit number past the Int32 range changed what update deduces')
console.log('PASS')
