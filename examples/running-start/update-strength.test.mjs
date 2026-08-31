// Strength checks for the Running Start components. Soundness (never remove a
// true value) lives in soundness-harness.mjs; this file checks the other
// direction — that a rewrite does not quietly prune LESS than before.
//
//   node examples/running-start/update-strength.test.mjs
//
// On random states the current update must leave a subset of what the pinned
// reference commit's update left, cell for cell. Both components are covered:
// the single line clue and the opposite-clue pair. Every state declares a
// house, the kind the floor commit is sound on -- see REF_COMMIT below.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import assert from 'assert'
import { installGlobals, makeIo, makeRng, fixpoint, randomCandidates, compareStrength } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load, loadAt } = makeIo(HERE)

// The floor: the components as they stand at the commit that pins this test.
//
// Every state below declares a HOUSE. The floor commit compares neighbours
// strictly everywhere, which is sound on a house (no two cells hold the same
// digit) and unsound on a drawn line that may repeat -- the bug #239 fixed. So
// a house is where the floor means something: it holds the ties work to losing
// no strength at all on the frame lines every shipped board is built from,
// while leaving the component free to push less hard on a bare line, which is
// the whole point of the fix. Soundness on the other kinds is the soundness
// harness's job, not this file's.
const REF_COMMIT = 'db93523'
const NAMES = ['setParams', 'update']
const curLine = load('RunningStartComponent.js', NAMES)
const refLine = loadAt(REF_COMMIT, 'RunningStartComponent.js', NAMES)
const curPair = load('RunningStartPairComponent.js', NAMES)
const refPair = loadAt(REF_COMMIT, 'RunningStartPairComponent.js', NAMES)

const { rnd } = makeRng(4104)
const randomSet = (lo, hi) => randomCandidates(rnd, lo, hi)

// Both components run over one line per board size. A clue counts cells, so it
// ranges over 1..m; the line holds digits 1..m.
function fuzzLine (cur, ref, clues, setUp, label) {
  let states = 0
  let weaker = 0
  for (const m of [4, 6, 9]) {
    installGlobals(1, m)
    const LINE = Array.from({ length: m }, (_, i) => i)
    const apply = (mod, p) => {
      const inst = {}
      setUp(mod, inst, clues, LINE)
      fixpoint(mod, inst, p)
    }
    for (let rep = 0; rep < 10000; rep++) {
      const start = new Map()
      for (const c of clues) start.set(c, randomSet(1, m))
      for (const c of LINE) start.set(c, randomSet(1, m))
      const w = compareStrength(cur, ref, apply, start, { kind: 'house', digitCount: m })
      if (w === null) continue
      states++
      weaker += w.length
      if (w.length > 0 && weaker <= 5) console.log(label, 'weaker at', w[0], 'start', [...start])
    }
  }
  console.log('running-start ' + label + ':', states, 'states,', weaker, 'weaker cells')
  assert.ok(states > 10000, 'the dead-state filter must leave most states to compare')
  assert.strictEqual(weaker, 0)
}

// The line component reads one clue (the left end); the pair reads both ends.
fuzzLine(curLine, refLine, [100], (mod, inst, [ca], line) => mod.setParams(inst, ca, line), 'line')
fuzzLine(curPair, refPair, [100, 101], (mod, inst, [ca, cb], line) => mod.setParams(inst, ca, cb, line), 'pair')

console.log('PASS')
