// Strength check for the two line components' update. Soundness (never remove
// a true value) lives in soundness-harness.mjs; this file checks the other
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
import { installGlobals, makeIo, makeRng, fixpoint, randomCandidates, shuffle, strengthSweep } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load, loadAt } = makeIo(HERE)

// The floor: the component as it stands at the commit that pins this test.
const REF_COMMIT = 'db93523'
const NAMES = ['setParams', 'update']
const cur = load('SkyscraperLineComponent.js', NAMES)
const ref = loadAt(REF_COMMIT, 'SkyscraperLineComponent.js', NAMES)

// The local line component's own floor (docs/example-layout.md). It runs on a
// line an author drew, so its states are bare: any length, digits may repeat,
// one clue at one end. The file carried a different name at the pinned commit,
// so the floor names its own path.
const ONE_SIDED_REF_COMMIT = 'c776ab7'
const ONE_SIDED_REF_FILE = 'SkyscraperRunningCapComponent.js'
const ONE_SIDED_FILE = 'SkyscraperOneSidedComponent.js'
const oneSidedCur = load(ONE_SIDED_FILE, NAMES)
const oneSidedRef = loadAt(ONE_SIDED_REF_COMMIT, ONE_SIDED_REF_FILE, NAMES)

const { rnd } = makeRng(31415)

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
for (const m of [4, 6, 9]) {
  installGlobals(1, m)
  const LINE = Array.from({ length: m }, (_, i) => i)
  strengthSweep(`skyscraper line ${m}`, {
    cur,
    ref,
    apply: (mod, p) => {
      const inst = {}
      mod.setParams(inst, CA, CB, LINE)
      fixpoint(mod, inst, p)
    },
    opts: { houses: [LINE] },
    * states () {
      for (let rep = 0; rep < REPS; rep++) {
        const perm = shuffle(rnd, Array.from({ length: m }, (_, i) => i + 1))
        const start = new Map()
        start.set(CA, randomCandidates(rnd, 1, m, visible(perm)))
        start.set(CB, randomCandidates(rnd, 1, m, visible([...perm].reverse())))
        for (const c of LINE) start.set(c, randomCandidates(rnd, 1, m, perm[c]))
        yield start
      }
    }
  })
}

// The one-sided DP, on bare lines of assorted lengths. A state is built around a
// real line and its true clue, so it always has a solution.
const ONE_SIDED_CLUE = 200
for (const m of [4, 6, 9]) {
  installGlobals(1, m)
  const LINE = Array.from({ length: m }, (_, i) => i)
  strengthSweep(`skyscraper one-sided ${m}`, {
    cur: oneSidedCur,
    ref: oneSidedRef,
    apply: (mod, p) => {
      const inst = {}
      mod.setParams(inst, ONE_SIDED_CLUE, LINE)
      fixpoint(mod, inst, p)
    },
    * states () {
      for (let rep = 0; rep < REPS; rep++) {
        const digits = Array.from({ length: m }, () => 1 + ((rnd() * m) | 0))
        const start = new Map()
        start.set(ONE_SIDED_CLUE, randomCandidates(rnd, 1, m, visible(digits)))
        for (const c of LINE) start.set(c, randomCandidates(rnd, 1, m, digits[c]))
        yield start
      }
    }
  })
}
console.log('PASS')
