// Per-call cost of RequiredDigitsGacComponent against the built-in
// RequiredDigits rule (BuiltinRequiredDigitsComponent.js, ported from the
// bundle body), on 20000 random states per shape, 3 reps.
//
// The two do not compute the same thing -- that is the point of the
// replacement -- so this is a cost row only; the strength and soundness rows
// are soundness-harness.mjs. The shapes are the ones a real puzzle registers:
// a short window with one or two clue digits (Outside Sudoku), and a full
// house-sized group.
//
// Run: node docs/research/required-digits-gac/bench-required-digits.mjs
import { installGlobals, makeIo, makeRng } from '../../../examples/_shared/harness-lib.mjs'

installGlobals(1, 9)
const FUNCTIONS = ['getAffectedCells', 'setParams', 'update']
const here = makeIo(new URL('.', import.meta.url).pathname)
const components = {
  'gac (RequiredDigitsGacComponent)': here.load('RequiredDigitsGacComponent.js', FUNCTIONS),
  'builtin (RequiredDigits)': here.load('BuiltinRequiredDigitsComponent.js', FUNCTIONS)
}

const { rnd } = makeRng(99)

// A state: one mask per cell, each holding a planted true digit plus noise, so
// the group is always satisfiable and the walk never exits early on a stop.
function makeStates (cellCount, valueCount, density) {
  const states = []
  for (let t = 0; t < 20000; t++) {
    const truth = Array.from({ length: cellCount }, () => 1 + ((rnd() * 9) | 0))
    const masks = truth.map(v => {
      let mask = 1 << v
      for (let d = 1; d <= 9; d++) if (rnd() < density) mask |= 1 << d
      return mask
    })
    states.push({ masks, values: truth.slice(0, valueCount) })
  }
  return states
}

const SHAPES = [
  ['3 cells, 1 digit  (outside clue)', 3, 1, 0.35],
  ['3 cells, 2 digits (outside clue)', 3, 2, 0.35],
  ['9 cells, 4 digits (sparse group)', 9, 4, 0.35],
  ['9 cells, 9 digits (full group)  ', 9, 9, 0.35]
]

for (const [label, cellCount, valueCount, density] of SHAPES) {
  const cells = [...Array(cellCount).keys()]
  const states = makeStates(cellCount, valueCount, density)
  for (const [name, component] of Object.entries(components)) {
    let masks
    const puzzle = {
      getCellsCanHaveRepeats: () => true,
      getCandidatesBitMask: c => masks[c],
      getCandidates: c => new SudokuDigitSet(masks[c]),
      getValue: c => { const m = masks[c]; return (m & (m - 1)) === 0 ? 31 - Math.clz32(m) : undefined },
      stop: () => ({}),
      removeCandidatesFromCell: () => ({})
    }
    let best = Infinity
    for (let rep = 0; rep < 3; rep++) {
      const instance = { name: 'required digits' }
      const t0 = process.hrtime.bigint()
      for (const state of states) {
        masks = state.masks
        component.setParams(instance, state.values, cells)
        for (const _ of component.update(instance, puzzle)); // eslint-disable-line no-unused-vars
      }
      best = Math.min(best, Number(process.hrtime.bigint() - t0) / states.length / 1000)
    }
    console.log(label, ' ', name.padEnd(34), best.toFixed(2), 'us/call (best of 3)')
  }
}
