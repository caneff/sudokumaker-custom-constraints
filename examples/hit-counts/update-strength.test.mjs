// Strength checks for the Hit Counts components. Soundness (never remove a true
// value) lives in soundness-harness.mjs; this file checks the other direction —
// that a rewrite does not quietly prune LESS than before.
//
//   node examples/hit-counts/update-strength.test.mjs
//
// On random states the current update must leave a subset of what the pinned
// reference commit's update left, cell for cell. All three components of the
// example are covered: the line clue, the side sum, and the clue pair.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import assert from 'assert'
import { installGlobals, makeIo, makeRng, fixpoint, randomCandidates, compareStrength } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load, loadAt } = makeIo(HERE)

// The floor: the components as they stand at the commit that pins this test.
const REF_COMMIT = 'db93523'

const { rnd } = makeRng(2024)
const randomSet = (lo, hi) => randomCandidates(rnd, lo, hi)

// ---- 1. HitCountsComponent: one clue over a nine-cell line ----
{
  const NAMES = ['setParams', 'update', 'initialize']
  const cur = load('HitCountsComponent.js', NAMES)
  const ref = loadAt(REF_COMMIT, 'HitCountsComponent.js', NAMES)
  const CLUE = 100
  const LINE = [0, 1, 2, 3, 4, 5, 6, 7, 8]
  installGlobals(0, 9)
  const apply = (mod, p) => {
    const inst = {}
    mod.setParams(inst, CLUE, LINE)
    Array.from(mod.initialize(inst, p))
    fixpoint(mod, inst, p)
  }
  let states = 0
  let weaker = 0
  for (let rep = 0; rep < 20000; rep++) {
    const start = new Map()
    start.set(CLUE, randomSet(0, 9))
    for (const c of LINE) start.set(c, randomSet(1, 9))
    const w = compareStrength(cur, ref, apply, start)
    if (w === null) continue
    states++
    weaker += w.length
    if (w.length > 0 && weaker <= 5) console.log('line weaker at', w[0], 'start', [...start])
  }
  console.log('hit-counts line:', states, 'states,', weaker, 'weaker cells')
  assert.ok(states > 10000, 'the dead-state filter must leave most states to compare')
  assert.strictEqual(weaker, 0)
}

// ---- 2. SideSumComponent: nine clues on a side summing to nine ----
{
  const NAMES = ['setParams', 'update']
  const cur = load('SideSumComponent.js', NAMES)
  const ref = loadAt(REF_COMMIT, 'SideSumComponent.js', NAMES)
  const N = 9
  const SIDE = [200, 201, 202, 203, 204, 205, 206, 207, 208]
  installGlobals(0, 9)
  const apply = (mod, p) => {
    const inst = {}
    mod.setParams(inst, SIDE, N)
    fixpoint(mod, inst, p)
  }
  let states = 0
  let weaker = 0
  for (let rep = 0; rep < 20000; rep++) {
    const start = new Map()
    // Nine clues that must sum to nine: seeding from 0..9 leaves almost every
    // state dead, so the side test draws small clue values.
    for (const c of SIDE) start.set(c, randomSet(0, 3))
    const w = compareStrength(cur, ref, apply, start)
    if (w === null) continue
    states++
    weaker += w.length
    if (w.length > 0 && weaker <= 5) console.log('side-sum weaker at', w[0], 'start', [...start])
  }
  console.log('hit-counts side-sum:', states, 'states,', weaker, 'weaker cells')
  assert.ok(states > 5000, 'the dead-state filter must leave most states to compare')
  assert.strictEqual(weaker, 0)
}

// ---- 3. HitCountsPairComponent: two opposite clues over one line ----
{
  const NAMES = ['setParams', 'update']
  const cur = load('HitCountsPairComponent.js', NAMES)
  const ref = loadAt(REF_COMMIT, 'HitCountsPairComponent.js', NAMES)
  const PA = 300
  const PB = 301
  let states = 0
  let weaker = 0
  for (const m of [4, 6, 9]) {
    installGlobals(0, m)
    const LINE = Array.from({ length: m }, (_, i) => 10 + i)
    const apply = (mod, p) => {
      const inst = {}
      mod.setParams(inst, PA, PB, LINE)
      fixpoint(mod, inst, p)
    }
    for (let rep = 0; rep < 10000; rep++) {
      const start = new Map()
      start.set(PA, randomSet(0, m))
      start.set(PB, randomSet(0, m))
      for (const c of LINE) start.set(c, randomSet(1, m))
      const w = compareStrength(cur, ref, apply, start)
      if (w === null) continue
      states++
      weaker += w.length
      if (w.length > 0 && weaker <= 5) console.log('pair weaker at', w[0], 'start', [...start])
    }
  }
  console.log('hit-counts pair:', states, 'states,', weaker, 'weaker cells')
  assert.ok(states > 10000, 'the dead-state filter must leave most states to compare')
  assert.strictEqual(weaker, 0)
}

console.log('PASS')
