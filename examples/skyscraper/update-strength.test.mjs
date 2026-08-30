// Strength check for SkyscraperLineComponent.update. Soundness (never remove a
// true value) lives in soundness-harness.mjs; this file checks the other
// direction — that a rewrite does not quietly prune LESS than before.
//
//   node examples/skyscraper/update-strength.test.mjs
//
// On fuzzed states the current update must leave a subset of what the pinned
// reference commit's update left, cell for cell. The DP is exact, so a state
// drawn at random is nearly always contradictory and both versions empty a
// cell, leaving nothing to compare; states are drawn around a real permutation
// instead, the way soundness-harness.mjs draws them. The component gates on a
// full house of {1..n} (docs/line-contract.md), so every state declares that
// kind, and each size installs its own digits.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import assert from 'assert'
import { installGlobals, makeIo, makeRng, fixpoint, randomCandidates, compareStrength } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load, loadAt } = makeIo(HERE)

// The floor: the component as it stands at the commit that pins this test.
const REF_COMMIT = 'db93523'
const NAMES = ['setParams', 'update']
const cur = load('SkyscraperLineComponent.js', NAMES)
const ref = loadAt(REF_COMMIT, 'SkyscraperLineComponent.js', NAMES)

const { rnd } = makeRng(31415)

function shuffled (m) {
  const a = Array.from({ length: m }, (_, i) => i + 1)
  for (let i = m - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// Buildings visible reading `vals` in order: the count of running maxima.
function visible (vals) {
  let count = 0
  let max = 0
  for (const v of vals) if (v > max) { count++; max = v }
  return count
}

const CA = 100
const CB = 101
const REPS = 6000
let states = 0
let weaker = 0
for (const m of [4, 6, 9]) {
  installGlobals(1, m)
  const LINE = Array.from({ length: m }, (_, i) => i)
  const apply = (mod, p) => {
    const inst = {}
    mod.setParams(inst, CA, CB, LINE)
    fixpoint(mod, inst, p)
  }
  for (let rep = 0; rep < REPS; rep++) {
    const perm = shuffled(m)
    const start = new Map()
    start.set(CA, randomCandidates(rnd, 1, m, visible(perm)))
    start.set(CB, randomCandidates(rnd, 1, m, visible([...perm].reverse())))
    for (const c of LINE) start.set(c, randomCandidates(rnd, 1, m, perm[c]))
    const w = compareStrength(cur, ref, apply, start, { kind: 'fullHouse', digitCount: m })
    if (w === null) continue
    states++
    weaker += w.length
    if (w.length > 0 && weaker <= 5) console.log('weaker at', w[0], 'start', [...start])
  }
}
console.log('skyscraper line:', states, 'states,', weaker, 'weaker cells')
// Every state keeps a real permutation, so no state may die: a dead one would
// mean a version emptied a cell the solution needs.
assert.strictEqual(states, 3 * REPS, 'a state built around a permutation must never die')
assert.strictEqual(weaker, 0)
console.log('PASS')
