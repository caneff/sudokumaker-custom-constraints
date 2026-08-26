// Strength checks for NumberedRoomsComponent.update. Soundness (never remove
// a true value) lives in soundness-harness.mjs; this file checks the other
// direction — that a rewrite does not quietly prune LESS than before.
//
//   node examples/numbered-rooms/update-strength.test.mjs
//
// 1. The clue≠index rule: for index k > 1 the target line[k-1] and the indexer
//    line[0] are two cells of one row/column, so they differ; index k with
//    clue k is impossible unless k = 1.
// 2. Never-weaker fuzz: on random states the current update must leave a
//    subset of what the pinned reference commit's update left, cell for cell.
//    This is the old-vs-new comparison OPTIMIZATION_LOG.md asks of every
//    rewrite (the k=1 ordering trap is invisible to the soundness harness).

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { execFileSync } from 'child_process'
import assert from 'assert'
import { installGlobals, makeIo, makeRng, makePuzzle, fixpoint } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const NAMES = ['setParams', 'update']
const mod = load('NumberedRoomsComponent.js', NAMES)

// ---- 1. clue≠index: index pinned to 2, everything else open => clue loses 2
installGlobals(1, 4)
{
  const p = makePuzzle({ 0: 3, 1: 2, 2: 3, 3: 1, 4: 4 }, (c, v) => c === 1 ? [2] : [1, 2, 3, 4])
  const inst = {}
  mod.setParams(inst, 0, [1, 2, 3, 4])
  fixpoint(mod, inst, p)
  assert.deepStrictEqual([...p._cand.get(0)].sort(), [1, 3, 4], 'clue must drop 2 when index is 2')
}
// k = 1 keeps the self-reference: index pinned to 1 => clue === line[0] === 1
{
  const p = makePuzzle({ 0: 1, 1: 1, 2: 3, 3: 2, 4: 4 }, (c, v) => c === 1 ? [1] : [1, 2, 3, 4])
  const inst = {}
  mod.setParams(inst, 0, [1, 2, 3, 4])
  fixpoint(mod, inst, p)
  assert.deepStrictEqual([...p._cand.get(0)], [1], 'k=1: clue must be 1')
}

// ---- 2. never weaker than the pinned reference
const REF_COMMIT = '143b34d' // last commit before the solved-clue position prune landed
const refSrc = execFileSync('git', ['show', `${REF_COMMIT}:examples/numbered-rooms/NumberedRoomsComponent.js`], { cwd: HERE, encoding: 'utf8' })
const ref = eval('(function(){' + refSrc + '\n return {' + NAMES.join(',') + '};})()') // eslint-disable-line no-eval

const { rnd } = makeRng(777)
let states = 0
let weaker = 0
for (const [m, D] of [[4, 6], [5, 5], [6, 6]]) {
  installGlobals(1, D)
  const line = Array.from({ length: m }, (_, i) => i + 1)
  // makePuzzle keys its cells off a truth map; no truth is claimed here, the
  // seed below decides every candidate set, so the values are placeholders.
  const cells = {}; for (let c = 0; c <= m; c++) cells[c] = 0
  for (let rep = 0; rep < 20000; rep++) {
    const start = new Map()
    for (let c = 0; c <= m; c++) {
      const s = []
      for (let d = 1; d <= D; d++) if (rnd() < 0.6) s.push(d)
      if (s.length === 0) s.push(1 + ((rnd() * D) | 0))
      start.set(c, s)
    }
    const seed = c => start.get(c)
    const pNew = makePuzzle(cells, seed); const iNew = {}; mod.setParams(iNew, 0, line); fixpoint(mod, iNew, pNew)
    const pRef = makePuzzle(cells, seed); const iRef = {}; ref.setParams(iRef, 0, line); fixpoint(ref, iRef, pRef)
    // A dead state (some cell emptied by either side) has no solution, so
    // "weaker" means nothing there; skip it.
    const dead = [...pNew._cand.values(), ...pRef._cand.values()].some(s => s.size === 0)
    if (dead) continue
    states++
    for (let c = 0; c <= m; c++) {
      for (const d of pNew._cand.get(c)) {
        if (!pRef._cand.get(c).has(d)) { weaker++; if (weaker <= 5) console.log('weaker at cell', c, 'digit', d, 'start', [...start]) }
      }
    }
  }
}
console.log('never-weaker:', states, 'states,', weaker, 'weaker cells')
assert.ok(states > 10000, 'the dead-state filter must leave most states to compare')
assert.strictEqual(weaker, 0)
console.log('PASS')
