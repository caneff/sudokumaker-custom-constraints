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
import { installGlobals, makeIo, makeRng } from '../../../examples/_shared/harness-lib.mjs'

installGlobals(1, 9)
const FUNCTIONS = ['getAffectedCells', 'setParams', 'update', 'validate']
const here = makeIo(new URL('.', import.meta.url).pathname)
const gac = here.load('CountDigitsGacComponent.js', FUNCTIONS)
const builtin = here.load('BuiltinCountDigitsComponent.js', FUNCTIONS)

const { rnd } = makeRng(99)
const STATES = 20000

// A state: one mask per cell, each holding a planted digit plus noise, so no
// cell is ever empty and the walk is never cut short by a stop.
function makeStates (targetCount, density) {
  const states = []
  for (let t = 0; t < STATES; t++) {
    const masks = Array.from({ length: targetCount + 1 }, () => {
      let mask = 1 << (1 + ((rnd() * 9) | 0))
      for (let d = 1; d <= 9; d++) if (rnd() < density) mask |= 1 << d
      return mask
    })
    states.push(masks)
  }
  return states
}

const SHAPES = [
  ['5 targets, 2 digits  ', 5, (1 << 1) | (1 << 2)],
  ['12 targets, 3 digits ', 12, (1 << 1) | (1 << 5) | (1 << 9)],
  ['20 targets, 3 digits ', 20, (1 << 1) | (1 << 5) | (1 << 9)],
  ['30 targets, 4 digits ', 30, (1 << 1) | (1 << 3) | (1 << 5) | (1 << 7)]
]

const COUNTER = 0

for (const [label, targetCount, digitMask] of SHAPES) {
  const targets = [...Array(targetCount).keys()].map(i => i + 1)
  const states = makeStates(targetCount, 0.35)
  let masks
  const puzzle = {
    getCandidatesBitMask: cell => masks[cell],
    getCandidates: cell => new SudokuDigitSet(masks[cell]),
    getValue: cell => { const m = masks[cell]; return (m & (m - 1)) === 0 ? 31 - Math.clz32(m) : undefined },
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
