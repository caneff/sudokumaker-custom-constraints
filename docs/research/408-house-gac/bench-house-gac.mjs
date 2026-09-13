// Per-call cost, n=9: examples/_shared/HouseGacComponent.js (bitmask),
// ReadableHouseGacComponent.js (digit sets, each group pooled from scratch) and
// IncrementalHouseGacComponent.js (digit sets, each group grown by one cell)
// and NamedBitmaskHouseGacComponent.js (the bitmask form, tricks named)
// against the #406 matching filter
// AllDiffGacComponent.js, each run through its own update()
// on 20000 random consistent states (a hidden permutation plus each other digit
// at 35%). One update call each, no fixpoint loop, 3 reps. `getCandidates`
// hands back a fresh DigitSet per call, as the app does, using the harness's
// DigitSet, whose methods are copied from the bundle.
// Run: node docs/research/408-house-gac/bench-house-gac.mjs (#408)
import { installGlobals, makeIo, makeRng } from '../../../examples/_shared/harness-lib.mjs'

installGlobals(1, 9)
const FUNCTIONS = ['getAffectedCells', 'setParams', 'update']
const components = {
  'matching (AllDiffGacComponent)': makeIo(new URL('../406-gac-demo/tools', import.meta.url).pathname).load('AllDiffGacComponent.js', FUNCTIONS),
  'subsets (HouseGacComponent)': makeIo(new URL('../../../examples/_shared', import.meta.url).pathname).load('HouseGacComponent.js', FUNCTIONS),
  'readable (ReadableHouseGacComponent)': makeIo(new URL('../../../examples/_shared', import.meta.url).pathname).load('ReadableHouseGacComponent.js', FUNCTIONS),
  'incremental (IncrementalHouseGacComponent)': makeIo(new URL('../../../examples/_shared', import.meta.url).pathname).load('IncrementalHouseGacComponent.js', FUNCTIONS),
  'named bitmask (NamedBitmaskHouseGacComponent)': makeIo(new URL('../../../examples/_shared', import.meta.url).pathname).load('NamedBitmaskHouseGacComponent.js', FUNCTIONS)
}

const { rnd } = makeRng(99)
const states = []
for (let t = 0; t < 20000; t++) {
  const perm = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  for (let i = 8; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]] }
  states.push(perm.map(v => { let mask = 1 << v; for (let d = 1; d <= 9; d++) if (rnd() < 0.35) mask |= 1 << d; return mask }))
}

const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8]
for (const [label, component] of Object.entries(components)) {
  let masks
  const puzzle = { getCellsCanHaveRepeats: () => false, getCandidatesBitMask: c => masks[c], getCandidates: c => new SudokuDigitSet(masks[c]), stop: () => ({}), removeCandidatesFromCell: () => ({}) }
  const instance = { name: 'house' }
  component.setParams(instance, cells)
  for (let rep = 0; rep < 3; rep++) {
    const t0 = process.hrtime.bigint()
    for (const state of states) { masks = state; for (const _ of component.update(instance, puzzle)); } // eslint-disable-line no-unused-vars
    console.log(label.padEnd(48), (Number(process.hrtime.bigint() - t0) / states.length / 1000).toFixed(1), 'us/call')
  }
}
