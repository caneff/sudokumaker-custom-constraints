// Per-call cost, n=9, of every form of the house GAC rule:
//   examples/_shared/HouseGacComponent.js   bitmask, tricks named (shipped)
//   TerseHouseGacComponent.js               the same bitmask, short names
//   IncrementalHouseGacComponent.js         digit sets, each group grown by one cell
//   ReadableHouseGacComponent.js            digit sets, each group pooled from scratch
// against the #406 matching filter AllDiffGacComponent.js, each run through its
// own update() on 20000 random consistent states (a hidden permutation plus
// each other digit at 35%). One update call each, 3 reps. `getCandidates`
// hands back a fresh DigitSet per call, as the app does, using the harness's
// DigitSet, whose methods are copied from the bundle.
//
// Before timing, every form runs once on the first 2000 states and must leave
// what the shipped form leaves, so the rows compare the same work.
//
// Run: node docs/research/408-house-gac/bench-house-gac.mjs (#408)
import { installGlobals, makeIo, makePuzzle, makeRng } from '../../../examples/_shared/harness-lib.mjs'

installGlobals(1, 9)
const FUNCTIONS = ['getAffectedCells', 'setParams', 'update']
const here = makeIo(new URL('.', import.meta.url).pathname)
const shared = makeIo(new URL('../../../examples/_shared', import.meta.url).pathname)
const components = {
  'matching (AllDiffGacComponent)': makeIo(new URL('../406-gac-demo/tools', import.meta.url).pathname).load('AllDiffGacComponent.js', FUNCTIONS),
  'shipped (HouseGacComponent)': shared.load('HouseGacComponent.js', FUNCTIONS),
  'terse (TerseHouseGacComponent)': here.load('TerseHouseGacComponent.js', FUNCTIONS),
  'incremental (IncrementalHouseGacComponent)': here.load('IncrementalHouseGacComponent.js', FUNCTIONS),
  'readable (ReadableHouseGacComponent)': here.load('ReadableHouseGacComponent.js', FUNCTIONS)
}

const { rnd } = makeRng(99)
const states = []
for (let t = 0; t < 20000; t++) {
  const perm = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  for (let i = 8; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]] }
  states.push(perm.map(v => { let mask = 1 << v; for (let d = 1; d <= 9; d++) if (rnd() < 0.35) mask |= 1 << d; return mask }))
}

const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8]

function candidatesAfter (component, masks) {
  const truth = Object.fromEntries(cells.map(c => [c, 0]))
  const digits = m => { const out = []; for (let d = 1; d <= 9; d++) if (m >> d & 1) out.push(d); return out }
  const puzzle = makePuzzle(truth, c => digits(masks[c]), { kind: 'fullHouse' })
  const instance = { name: 'house' }
  component.setParams(instance, cells)
  Array.from(component.update(instance, puzzle))
  return JSON.stringify(cells.map(c => [...puzzle._cand.get(c)].sort((a, b) => a - b)))
}

const shipped = components['shipped (HouseGacComponent)']
for (const [t, masks] of states.slice(0, 2000).entries()) {
  const want = candidatesAfter(shipped, masks)
  for (const [label, component] of Object.entries(components)) {
    if (candidatesAfter(component, masks) !== want) throw new Error(`state ${t}: ${label} disagrees with HouseGacComponent`)
  }
}

for (const [label, component] of Object.entries(components)) {
  let masks
  const puzzle = { getCellsCanHaveRepeats: () => false, getCandidatesBitMask: c => masks[c], getCandidates: c => new SudokuDigitSet(masks[c]), stop: () => ({}), removeCandidatesFromCell: () => ({}) }
  const instance = { name: 'house' }
  component.setParams(instance, cells)
  for (let rep = 0; rep < 3; rep++) {
    const t0 = process.hrtime.bigint()
    for (const state of states) { masks = state; for (const _ of component.update(instance, puzzle)); } // eslint-disable-line no-unused-vars
    console.log(label.padEnd(44), (Number(process.hrtime.bigint() - t0) / states.length / 1000).toFixed(1), 'us/call')
  }
}
