// Strength check for UpToNComponent.update. Soundness (never remove a true
// value) lives in soundness-harness.mjs; this file checks the other direction:
// that a rewrite does not quietly prune LESS than the floor.
//
//   node examples/up-to-n/update-strength.test.mjs
//
// On random states the current update must leave a subset of what the floor
// left, cell for cell.
//
// The floor is a frozen copy, `.golden/UpToNComponent.floor.js`, not a
// `REF_COMMIT` read with `loadAt` as the siblings do. The component and its
// floor land in one squash-merged pull request, and a squash rewrites every
// commit on the branch: a sha pinned there names a commit main never holds, so
// `git show` would fail on main. Raising the floor means replacing that copy in
// the same commit as the stronger component.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import assert from 'assert'
import { installGlobals, makeIo, makeRng, makeLine, fixpoint, randomCandidates, compareStrength } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)

const NAMES = ['setParams', 'update']
const cur = load('UpToNComponent.js', NAMES)
const ref = load('.golden/UpToNComponent.floor.js', NAMES)

const { rnd } = makeRng(3680)
const REPS = 5000

// States are drawn around a real line so few of them die: a line of the kind
// declared, a target it holds, the clue that line gives, and every cell's
// candidates keeping its digit. Both kinds run, because the line-kind gate
// decides how far the N prune reaches.
function upToN (digits, target) {
  let sum = 0
  for (const d of digits) {
    sum += d
    if (d === target) return sum
  }
  return null
}

let states = 0
let weaker = 0
for (const D of [4, 6, 9]) {
  installGlobals(1, D)
  const LINE = Array.from({ length: D }, (_, i) => i)
  for (const kind of ['fullHouse', 'bare']) {
    let poolStates = 0
    let poolWeaker = 0
    for (let rep = 0; rep < REPS; rep++) {
      const digits = makeLine(rnd, kind, D, D)
      const target = digits[(rnd() * D) | 0]
      const clue = upToN(digits, target)
      const start = new Map()
      for (const c of LINE) start.set(c, randomCandidates(rnd, 1, D, digits[c]))
      const apply = (mod, p) => {
        const inst = {}
        mod.setParams(inst, LINE, target, clue)
        fixpoint(mod, inst, p)
      }
      const w = compareStrength(cur, ref, apply, start, { kind, digitCount: D })
      if (w === null) continue
      poolStates++
      poolWeaker += w.length
      if (w.length > 0 && poolWeaker <= 5) console.log(kind, D, 'weaker at', w[0], 'start', [...start])
    }
    console.log(`up-to-n ${kind} ${D}:`, poolStates, 'states,', poolWeaker, 'weaker cells')
    states += poolStates
    weaker += poolWeaker
  }
}

// Every state keeps a real solution, so none may die.
assert.strictEqual(states, 3 * 2 * REPS, 'a state built around a solution must never die')
assert.strictEqual(weaker, 0)
console.log('PASS')
