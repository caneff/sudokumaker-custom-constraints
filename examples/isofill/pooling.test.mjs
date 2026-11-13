import assert from 'assert'
import { fixpoint, installGlobals, makeIo, makePuzzle, makeRng, randomCandidates, runUpdate } from '../_shared/harness-lib.mjs'

const HERE = import.meta.dirname
const { load } = makeIo(HERE)
const mod = load('IsofillComponent.js', ['setParams', 'update'])

installGlobals(0, 9)

const N = 10
const CELLS = Array.from({ length: N * N }, (_, i) => i)
const truth = {}
for (const c of CELLS) truth[c] = Math.floor(c / N)
const { rnd } = makeRng(454)
const seed = (c, v) => randomCandidates(rnd, 0, 9, v)

{
  const cells = CELLS.slice(0, 99)
  const short = {}
  for (const c of cells) short[c] = truth[c]
  const p = makePuzzle(short, (c, v) => [v])
  const inst = {}
  mod.setParams(inst, cells, N, N)
  runUpdate(mod, inst, p)
  assert.notStrictEqual(p.stopMessage(), null, 'an uneven board must yield puzzle.stop')
  assert.match(p.stopMessage(), /evenly/)
}

// The constructor allocates both visit-marked arrays through newVisitMarks (#736):
// the cap it records is what nextVisit wraps at, and a bare Uint32Array would
// never wrap.
{
  const inst = {}
  mod.setParams(inst, CELLS, N, N)
  assert.strictEqual(inst.mask.visitLimit, 0xFFFFFFFF, 'the mask was not allocated through newVisitMarks')
  assert.strictEqual(inst.targets.visitLimit, 0xFFFFFFFF, 'the targets were not allocated through newVisitMarks')
}

{
  const p = makePuzzle(truth, seed)
  p.getCandidates = () => { throw new Error('scan called getCandidates; read getCandidatesBitMask') }
  const inst = {}
  mod.setParams(inst, CELLS, N, N)
  runUpdate(mod, inst, p)
}

// Visit numbers sitting at the top of their range: the same deductions as fresh.
{
  const run = visit => {
    const p = makePuzzle(truth, (c, v) => (c % 3 === 0 ? [v] : randomCandidates(makeRng(c).rnd, 0, 9, v)))
    const inst = {}
    mod.setParams(inst, CELLS, N, N)
    // A field the component does not read would make the assignment a silent no-op.
    assert.ok('visit' in inst && 'targetVisit' in inst, 'setParams must create instance.visit and instance.targetVisit')
    if (visit) { inst.visit = visit; inst.targetVisit = visit }
    fixpoint(mod, inst, p)
    return CELLS.map(c => [...p._cand.get(c)].join(''))
  }
  assert.deepStrictEqual(run(0xFFFFFFF0), run(0))
}

// The target visit too: a stale one reads as "no targets" and reports a cut
// that is not there. Many random states, so the cut rule's re-walk is reached.
{
  const run = visit => {
    const out = []
    for (let rep = 0; rep < 200; rep++) {
      const r = makeRng(1000 + rep).rnd
      const p = makePuzzle(truth, (c, v) => randomCandidates(r, 0, 9, v))
      const inst = {}
      mod.setParams(inst, CELLS, N, N)
      assert.ok('targetVisit' in inst, 'setParams must create instance.targetVisit')
      if (visit) inst.targetVisit = visit
      runUpdate(mod, inst, p)
      out.push(CELLS.map(c => [...p._cand.get(c)].join('')).join(','))
    }
    return out
  }
  assert.deepStrictEqual(run(0xFFFFFFFF), run(0))
}

// The budget matcher's own visit number (`seen`, a Uint32Array): started near the
// top of its range after the first call has built the matcher, same deductions.
{
  const run = below => {
    const out = []
    for (let rep = 0; rep < 60; rep++) {
      const r = makeRng(3000 + rep).rnd
      const inst = {}
      mod.setParams(inst, CELLS, N, N)
      runUpdate(mod, inst, makePuzzle(truth, (c, v) => randomCandidates(r, 0, 9, v)))
      assert.ok('seenVisit' in inst.budget, 'the budget matcher must keep seenVisit')
      if (below !== null) inst.budget.seenVisit = 0xFFFFFFFF - below
      const p = makePuzzle(truth, (c, v) => randomCandidates(r, 0, 9, v))
      runUpdate(mod, inst, p)
      out.push(CELLS.map(c => [...p._cand.get(c)].join('')).join(','))
    }
    return out
  }
  const fresh = run(null)
  for (let below = 0; below < 40; below++) assert.deepStrictEqual(run(below), fresh, `seen visit ${below} below the cap changed what update deduces`)
}
console.log('PASS')
