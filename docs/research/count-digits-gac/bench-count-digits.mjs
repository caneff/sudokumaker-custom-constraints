// Per-call cost of CountDigitsGacComponent against the built-in CountDigits
// rule (BuiltinCountDigitsComponent.js, ported from the bundle body), on 20000
// random states per shape, best of 3 reps.
//
// The two do not compute the same thing -- that is the point of the
// replacement -- so this is a cost row only; soundness and strength are
// soundness-harness.mjs. Three columns, because that is what the app actually
// runs per state:
//   - `builtin validate`: the whole of the built-in's work. It has no update.
//   - `gac update`:  the pruning pass, run on every changed watch cell.
//   - `gac validate`: the backstop. A custom component that defines validate
//     gets validateDuringSolve forced true by the wrapper
//     (docs/component-contract.md), so ours runs on every state, like the
//     built-in's.
//
// Run: node docs/research/count-digits-gac/bench-count-digits.mjs
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo, makeRng } from '../../../examples/_shared/harness-lib.mjs'

installGlobals(1, 9)
const here = makeIo(dirname(fileURLToPath(import.meta.url)))
const gac = here.load('CountDigitsGacComponent.js', ['setParams', 'update', 'validate'])
const builtin = here.load('BuiltinCountDigitsComponent.js', ['setParams', 'validate'])

const { rnd } = makeRng(99)
const STATES = 20000

// A state: one mask per cell, each holding a planted digit plus noise, so no
// cell is ever empty and the walk is never cut short by a stop.
//
// `pin` is what makes the shape reach `update`'s second half. Left null, the
// counter cell gets a random mask, and on a group of any size the chance that
// its largest survivor lands exactly on the definite count (or its smallest on
// the possible count) is small -- about 50 states in 20,000 here -- so the row
// times `countHits` and the bounds check and almost never the filtering loop.
// Pinned to 'definite' or 'possible' the branch fires on every state, which is
// the ceiling the same row would otherwise hide.
function makeStates (targetCount, density, digitMask, pin = null) {
  const states = []
  for (let t = 0; t < STATES; t++) {
    const masks = Array.from({ length: targetCount + 1 }, () => {
      let mask = 1 << (1 + ((rnd() * 9) | 0))
      for (let d = 1; d <= 9; d++) if (rnd() < density) mask |= 1 << d
      return mask
    })
    if (pin !== null) {
      let definite = 0
      let open = 0
      for (let cell = 1; cell <= targetCount; cell++) {
        const inSet = masks[cell] & digitMask
        if (inSet === masks[cell]) definite++
        else if (inSet !== 0) open++
      }
      const count = pin === 'definite' ? definite : definite + open
      // A counter cell holds a digit, so a count outside 1..9 cannot be pinned;
      // those states keep their random counter and just miss the branch.
      if (count >= 1 && count <= 9) masks[0] = 1 << count
    }
    states.push(masks)
  }
  return states
}

const THREE = (1 << 1) | (1 << 5) | (1 << 9)
const SHAPES = [
  ['5 targets, 2 digits           ', 5, (1 << 1) | (1 << 2), null],
  ['12 targets, 3 digits          ', 12, THREE, null],
  ['20 targets, 3 digits          ', 20, THREE, null],
  ['30 targets, 4 digits          ', 30, (1 << 1) | (1 << 3) | (1 << 5) | (1 << 7), null],
  ['20 targets, 3 digits, forced  ', 20, THREE, 'definite'],
  ['20 targets, 3 digits, all-hits', 20, THREE, 'possible']
]

const COUNTER = 0

for (const [label, targetCount, digitMask, pin] of SHAPES) {
  const targets = [...Array(targetCount).keys()].map(i => i + 1)
  const states = makeStates(targetCount, 0.35, digitMask, pin)
  let masks
  const puzzle = {
    getCandidatesBitMask: cell => masks[cell],
    stop: () => ({}),
    removeCandidatesFromCell: () => ({})
  }
  const calls = {
    'builtin validate': (mod, instance) => mod.validate(instance, puzzle),
    'gac update      ': (mod, instance) => { for (const _ of mod.update(instance, puzzle)); }, // eslint-disable-line no-unused-vars
    'gac validate    ': (mod, instance) => mod.validate(instance, puzzle)
  }
  for (const [name, call] of Object.entries(calls)) {
    const mod = name.startsWith('builtin') ? builtin : gac
    let best = Infinity
    for (let rep = 0; rep < 3; rep++) {
      const instance = { name: 'count digits' }
      mod.setParams(instance, digitMask, COUNTER, targets)
      const t0 = process.hrtime.bigint()
      for (const state of states) {
        masks = state
        call(mod, instance)
      }
      best = Math.min(best, Number(process.hrtime.bigint() - t0) / states.length / 1000)
    }
    console.log(label, name, best.toFixed(3), 'us/call (best of 3)')
  }
}
