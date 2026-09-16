// Does precomputing bit counts speed up examples/_shared/HouseGacComponent.js?
// Measured on the component as of commit 1f2d717, before variant B below was
// adopted into it; the source is read from that commit, not the working tree.
// Every group's size depends only on the group number, so it can come from a
// table built once instead of being counted each call. Two variants, built in
// memory from the shipped source (the file is untouched):
//   A  cellsInGroup from a 512-entry table
//   B  A, plus digitsInGroup from a 1024-entry table (digits 0..9), counting
//      bits as before for any mask above that
// Both must leave exactly what the shipped form leaves, stop included, on 4000
// check states before any timing. Timing interleaves the three forms for 6
// rounds, 20000 states each, so machine drift hits all of them alike.
// Run: node docs/research/408-house-gac/bench-count-tables.mjs (#408)
import { execFileSync } from 'child_process'
import { installGlobals, makeIo, makePuzzle, makeRng } from '../../../examples/_shared/harness-lib.mjs'

installGlobals(1, 9)
const FUNCTIONS = ['getAffectedCells', 'setParams', 'update']
const sharedDir = new URL('../../../examples/_shared/', import.meta.url).pathname
const io = makeIo(sharedDir)
const src = execFileSync('git', ['show', '1f2d717:examples/_shared/HouseGacComponent.js'], { cwd: sharedDir, encoding: 'utf8' })

function edit (text, from, to) {
  if (text.split(from).length !== 2) throw new Error(`expected exactly one ${JSON.stringify(from)}`)
  return text.replace(from, to)
}

const groupTable = `const pooledDigitsOf = new Int32Array(1 << MAX_CELLS)
const cellsInGroupOf = new Uint8Array(1 << MAX_CELLS)
for (let g = 1; g < cellsInGroupOf.length; g++) cellsInGroupOf[g] = cellsInGroupOf[g & (g - 1)] + 1`
let srcA = edit(src, 'const pooledDigitsOf = new Int32Array(1 << MAX_CELLS)', groupTable)
srcA = edit(srcA, 'const cellsInGroup = countOf(group)', 'const cellsInGroup = cellsInGroupOf[group]')

let srcB = edit(srcA, 'for (let g = 1; g < cellsInGroupOf.length; g++) cellsInGroupOf[g] = cellsInGroupOf[g & (g - 1)] + 1', `for (let g = 1; g < cellsInGroupOf.length; g++) cellsInGroupOf[g] = cellsInGroupOf[g & (g - 1)] + 1
const digitCountOf = new Uint8Array(1 << 10)
for (let m = 1; m < digitCountOf.length; m++) digitCountOf[m] = digitCountOf[m & (m - 1)] + 1`)
srcB = edit(srcB, 'const digitsInGroup = countOf(pooledDigits)', 'const digitsInGroup = pooledDigits < 1024 ? digitCountOf[pooledDigits] : countOf(pooledDigits)')

const components = {
  shipped: io.loadSource(src, FUNCTIONS),
  'A group-size table': io.loadSource(srcA, FUNCTIONS),
  'B group + digit tables': io.loadSource(srcB, FUNCTIONS)
}

const { rnd } = makeRng(99)
const cells = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const states = []
for (let t = 0; t < 20000; t++) {
  const perm = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  for (let i = 8; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [perm[i], perm[j]] = [perm[j], perm[i]] }
  states.push(perm.map(v => { let mask = 1 << v; for (let d = 1; d <= 9; d++) if (rnd() < 0.35) mask |= 1 << d; return mask }))
}
const openStates = []
for (let t = 0; t < 2000; t++) {
  openStates.push(cells.map(() => { let mask = 0; for (let d = 1; d <= 9; d++) if (rnd() < 0.2) mask |= 1 << d; return mask || 1 << (1 + ((rnd() * 9) | 0)) }))
}

function candidatesAfter (component, masks) {
  const truth = Object.fromEntries(cells.map(c => [c, 0]))
  const digits = m => { const out = []; for (let d = 1; d <= 9; d++) if (m >> d & 1) out.push(d); return out }
  const puzzle = makePuzzle(truth, c => digits(masks[c]), { houses: [cells] })
  const instance = { name: 'house' }
  component.setParams(instance, cells)
  Array.from(component.update(instance, puzzle))
  if (puzzle._stopped !== null) return 'stop'
  return JSON.stringify(cells.map(c => [...puzzle._cand.get(c)].sort((a, b) => a - b)))
}

let stops = 0
for (const [t, masks] of [...states.slice(0, 2000), ...openStates].entries()) {
  const want = candidatesAfter(components.shipped, masks)
  if (want === 'stop') stops++
  for (const [label, component] of Object.entries(components)) {
    if (label !== 'shipped' && candidatesAfter(component, masks) !== want) throw new Error(`state ${t}: ${label} disagrees with the shipped form`)
  }
}
if (stops < 100) throw new Error(`only ${stops} check states stop; the stop is not compared`)

const times = Object.fromEntries(Object.keys(components).map(label => [label, []]))
for (let round = 0; round < 6; round++) {
  for (const [label, component] of Object.entries(components)) {
    let masks
    const puzzle = { getCellsCanHaveRepeats: () => false, getCandidatesBitMask: c => masks[c], stop: () => ({}), removeCandidatesFromCell: () => ({}) }
    const instance = { name: 'house' }
    component.setParams(instance, cells)
    const t0 = process.hrtime.bigint()
    for (const state of states) { masks = state; for (const _ of component.update(instance, puzzle)); } // eslint-disable-line no-unused-vars
    times[label].push(Number(process.hrtime.bigint() - t0) / states.length / 1000)
  }
}
const median = xs => { const s = [...xs].sort((a, b) => a - b); return (s[2] + s[3]) / 2 }
const base = median(times.shipped)
console.log(`agreement: 4000 states, ${stops} stops, 0 disagreements`)
for (const [label, xs] of Object.entries(times)) {
  console.log(`${label.padEnd(24)} median ${median(xs).toFixed(2)} us  range ${Math.min(...xs).toFixed(2)}-${Math.max(...xs).toFixed(2)}  vs shipped ${(median(xs) / base).toFixed(2)}x`)
}
