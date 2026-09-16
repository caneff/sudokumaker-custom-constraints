// Per-call cost at n=9..16: TerseHouseGacComponent.js (the bitmask algorithm
// of examples/_shared/HouseGacComponent.js with short names; the table in
// docs/research/all-different-gac.md is its output) against the #406 matching
// filter AllDiffGacComponent.js, both run
// through their own update(). Both bitmask forms refuse a house above 9 cells,
// so this probe loads the source with MAX_CELLS raised to 16 in memory; the
// file is untouched.
//
// A state is n cells over digits 1..n: a hidden permutation plus each other
// digit at `rate`. Two densities: 0.35 (the random bench the #406 table used)
// and 0.15, nearer a propagated board (#406 measured a median 21-25 candidates
// per 9-cell house on stalled boards, about 2.5 a cell).
//
// Before timing, both filters run once on every state and must leave the same
// candidates, so the rows compare two filters doing the same work.
//
// Run: node docs/research/408-house-gac/bench-large-n.mjs (#408)
import { readFileSync } from 'fs'
import { installGlobals, makeIo, makeRng, makePuzzle } from '../../../examples/_shared/harness-lib.mjs'

const FUNCTIONS = ['getAffectedCells', 'setParams', 'update']
const here = new URL('.', import.meta.url).pathname
const subsetSrc = readFileSync(here + 'TerseHouseGacComponent.js', 'utf8').replace('const MAX_CELLS = 9', 'const MAX_CELLS = 16')
if (!subsetSrc.includes('const MAX_CELLS = 16')) throw new Error('MAX_CELLS not found in TerseHouseGacComponent.js')
const io = makeIo(here)
const subsets = io.loadSource(subsetSrc, FUNCTIONS)
const matching = makeIo(new URL('../406-gac-demo/tools', import.meta.url).pathname).load('AllDiffGacComponent.js', FUNCTIONS)

const STATES = 2000
const REPS = 3

function makeStates (n, rate, seed) {
  const { rnd } = makeRng(seed)
  const states = []
  for (let t = 0; t < STATES; t++) {
    const perm = Array.from({ length: n }, (_, i) => i + 1)
    for (let i = n - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]] }
    states.push(perm.map(v => { let mask = 1 << v; for (let d = 1; d <= n; d++) if (rnd() < rate) mask |= 1 << d; return mask }))
  }
  return states
}

function candidatesAfter (component, n, mask) {
  const cells = Array.from({ length: n }, (_, i) => i)
  const truth = Object.fromEntries(cells.map(c => [c, 0]))
  const digits = m => { const out = []; for (let d = 0; d < 32; d++) if (m >> d & 1) out.push(d); return out }
  const puzzle = makePuzzle(truth, c => digits(mask[c]), { houses: [cells] })
  const instance = { name: 'house' }
  component.setParams(instance, cells)
  Array.from(component.update(instance, puzzle))
  return JSON.stringify(cells.map(c => [...puzzle._cand.get(c)].sort((a, b) => a - b)))
}

function usPerCall (component, n, states) {
  let masks
  const puzzle = { getCellsCanHaveRepeats: () => false, getCandidatesBitMask: c => masks[c], stop: () => ({}), removeCandidatesFromCell: () => ({}) }
  const instance = { name: 'house' }
  component.setParams(instance, Array.from({ length: n }, (_, i) => i))
  for (const state of states.slice(0, 200)) { masks = state; Array.from(component.update(instance, puzzle)) } // warm
  let best = Infinity
  for (let rep = 0; rep < REPS; rep++) {
    const t0 = process.hrtime.bigint()
    for (const state of states) { masks = state; for (const _ of component.update(instance, puzzle)); } // eslint-disable-line no-unused-vars
    best = Math.min(best, Number(process.hrtime.bigint() - t0) / states.length / 1000)
  }
  return best
}

console.log('| rate | n | cands/cell | subsets us | matching us | subsets / matching |')
console.log('| --- | --- | --- | --- | --- | --- |')
for (const rate of [0.35, 0.15]) {
  for (let n = 9; n <= 16; n++) {
    installGlobals(1, n)
    const states = makeStates(n, rate, 408 + n)
    for (const [t, state] of states.entries()) {
      if (candidatesAfter(subsets, n, state) !== candidatesAfter(matching, n, state)) {
        throw new Error(`n=${n} rate=${rate} state ${t}: the two filters disagree`)
      }
    }
    let total = 0
    for (const s of states) for (const m of s) { let x = m; while (x) { x &= x - 1; total++ } }
    const a = usPerCall(subsets, n, states)
    const b = usPerCall(matching, n, states)
    console.log(`| ${rate} | ${n} | ${(total / states.length / n).toFixed(1)} | ${a.toFixed(1)} | ${b.toFixed(1)} | ${(a / b).toFixed(2)}x |`)
  }
}
