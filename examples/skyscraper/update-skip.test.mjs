// SkyscraperLineComponent.update skips the DP when the candidates it sees are
// the ones it already left at a fixpoint (#133). Two rules under test:
//
// 1. A second call on unchanged candidates reads no candidate sets (the cost
//    it is meant to save) and yields nothing.
// 2. A state that yielded removals is never skipped when it comes back (after a
//    backtrack), and a candidate change after a skip runs the DP again.
//
//   node examples/skyscraper/update-skip.test.mjs

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import assert from 'assert'
import { installGlobals, makeIo, makePuzzle } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const N = 4
installGlobals(1, N)
const mod = load('SkyscraperLineComponent.js', ['setParams', 'update'])

const CA = 100
const CB = 101
const LINE = [0, 1, 2, 3]
const FULL = [1, 2, 3, 4]
// Left clue pinned to 4: the line must ascend 1234, right clue must be 1.
const truth = { [CA]: 4, [CB]: 1, 0: 1, 1: 2, 2: 3, 3: 4 }
const fresh = () => makePuzzle(truth, c => (c === CA ? [4] : FULL))

function counted (p) {
  const n = { reads: 0 }
  return {
    p: { ...p, getCandidates: c => { n.reads++; return p.getCandidates(c) } },
    n
  }
}
const run = (inst, p) => Array.from(mod.update(inst, p))

// 1. unchanged candidates: second call reads nothing and yields nothing
{
  const { p, n } = counted(fresh())
  const inst = {}
  mod.setParams(inst, CA, CB, LINE)
  assert.ok(run(inst, p).length > 0, 'first call prunes')
  while (run(inst, p).length > 0);
  n.reads = 0
  assert.deepStrictEqual(run(inst, p), [], 'fixpoint call yields nothing')
  assert.strictEqual(n.reads, 0, 'fixpoint call reads no candidate sets')
}

// 2a. a state that yielded removals runs again when it comes back
{
  const inst = {}
  mod.setParams(inst, CA, CB, LINE)
  const first = run(inst, fresh()).length
  assert.ok(first > 0)
  assert.strictEqual(run(inst, fresh()).length, first, 'same pre-removal state prunes again')
}

// 2b. after a skip, a changed candidate runs the DP again
{
  const p = fresh()
  const inst = {}
  mod.setParams(inst, CA, CB, LINE)
  while (run(inst, p).length > 0);
  assert.deepStrictEqual(run(inst, p), [])
  // Unpin the right clue again: the DP must re-prune it to 1.
  p._cand.set(CB, new Set(FULL))
  run(inst, p)
  assert.deepStrictEqual([...p._cand.get(CB)], [1], 'changed candidate is pruned again')
}
console.log('update-skip: PASS')
