// Per-call cost, n=9: the shipped examples/_shared/HouseGacComponent.js against
// AllDiffGacComponent.js, both run through their own update() on 20000 random
// consistent states (a hidden permutation plus each other digit at 35%). One
// update call each, no fixpoint loop. Run: node docs/research/406-gac-demo/tools/bench-house-gac.mjs (#408)
import { installGlobals, makeIo, makeRng } from '../../../../examples/_shared/harness-lib.mjs'
installGlobals(1, 9)
const N = ['getAffectedCells', 'setParams', 'update']
const mods = {
  'matching (AllDiffGacComponent)': makeIo(new URL('.', import.meta.url).pathname).load('AllDiffGacComponent.js', N),
  'subsets (HouseGacComponent)': makeIo(new URL('../../../../examples/_shared', import.meta.url).pathname).load('HouseGacComponent.js', N)
}
const { rnd } = makeRng(99)
const states = []
for (let t = 0; t < 20000; t++) {
  const perm = [1,2,3,4,5,6,7,8,9]
  for (let i = 8; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]] }
  states.push(perm.map(v => { let x = 1 << v; for (let d = 1; d <= 9; d++) if (rnd() < 0.35) x |= 1 << d; return x }))
}
const cells = [0,1,2,3,4,5,6,7,8]
for (const [name, m] of Object.entries(mods)) {
  let cur
  const p = { getCellsCanHaveRepeats: () => false, getCandidatesBitMask: c => cur[c], stop: () => ({}), removeCandidatesFromCell: () => ({}) }
  const inst = { name: 'h' }; m.setParams(inst, cells)
  for (let r = 0; r < 3; r++) {
    const t0 = process.hrtime.bigint()
    for (const s of states) { cur = s; for (const _ of m.update(inst, p)); }
    console.log(name.padEnd(32), (Number(process.hrtime.bigint() - t0) / states.length / 1000).toFixed(1), 'us/call')
  }
}
