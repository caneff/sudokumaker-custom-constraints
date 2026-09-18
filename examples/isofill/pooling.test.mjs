// Seams for the #454 pooling pass on IsofillComponent.update:
//   node examples/isofill/pooling.test.mjs
//
// The pass is behaviour-preserving (update-strength.test.mjs pins the floor,
// soundness-harness.mjs the truth), so this file checks the three things the
// pass changes that those two cannot see:
//   1. a board that does not split evenly stops the branch (puzzle.stop, which
//      reaches the step log) instead of throwing;
//   2. the hot scan reads the candidate mask, not a DigitSet per open cell;
//   3. a visit stamp about to wrap does not change what update deduces.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import assert from 'assert'
import { installGlobals, makeIo, makePuzzle, fixpoint, makeRng, randomCandidates } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const mod = load('IsofillComponent.js', ['setParams', 'update'])

installGlobals(0, 9)

const N = 10
const CELLS = Array.from({ length: N * N }, (_, i) => i)
const truth = {}
for (const c of CELLS) truth[c] = Math.floor(c / N)
const { rnd } = makeRng(454)
const seed = (c, v) => randomCandidates(rnd, 0, 9, v)

// 1. 99 cells among 10 digits: 9.9 cells a digit.
{
  const cells = CELLS.slice(0, 99)
  const short = {}
  for (const c of cells) short[c] = truth[c]
  const p = makePuzzle(short, (c, v) => [v])
  const inst = {}
  mod.setParams(inst, cells)
  Array.from(mod.update(inst, p))
  assert.notStrictEqual(p._stopped, null, 'an uneven board must yield puzzle.stop')
  assert.match(p._stopped, /evenly/)
}

// 2. The scan never builds a DigitSet per cell.
{
  const p = makePuzzle(truth, seed)
  p.getCandidates = () => { throw new Error('scan called getCandidates; read getCandidatesBitMask') }
  const inst = {}
  mod.setParams(inst, CELLS)
  Array.from(mod.update(inst, p))
}

// 3. Stamps sitting at the top of their range: the same deductions as fresh.
{
  const run = stamp => {
    const p = makePuzzle(truth, (c, v) => (c % 3 === 0 ? [v] : randomCandidates(makeRng(c).rnd, 0, 9, v)))
    const inst = {}
    mod.setParams(inst, CELLS)
    if (stamp) { inst.stamp = stamp; inst.targetStamp = stamp }
    fixpoint(mod, inst, p)
    return CELLS.map(c => [...p._cand.get(c)].join(''))
  }
  assert.deepStrictEqual(run(0xFFFFFFF0), run(0))
}
console.log('PASS')
