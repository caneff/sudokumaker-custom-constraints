// Soundness fuzz for the #246 prototype deduction D (HitCountsJointComponent).
// Soundness = the component never removes a cell's TRUE value.
//
//   node examples/hit-counts/proto-233/soundness-246.mjs
//
// D reads a whole line and both its clues, so it is fuzzed over real grids: each
// gen_*.json grid plus band/stack shuffles of it, which keep a grid valid while
// moving every hit. Every cell gets a random candidate set that still contains
// its true value, and the clue values are derived from the grid, so the truth is
// always a completion of the state. A second pass fuzzes bare lines — digits may
// repeat — against a mock that answers `getCellsCanHaveRepeats` true, which is
// the gate that turns the house exclusion off.
//
// `initialize` is not under test here: its only extra rule (a clue is never
// n - 1) is the shipped per-line rule, fuzzed by the shipped harness.

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { installGlobals, makeIo, makeRng, makePuzzle, violates } from '../../_shared/harness-lib.mjs'
import { frameGeometry } from '../../_shared/frame-geometry.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const EXAMPLE = join(HERE, '..')
const { load } = makeIo(HERE)
const { rnd } = makeRng()

installGlobals(0, 9)

const joint = load('HitCountsJointComponent.js', ['setParams', 'update'])

// A random candidate set over lo..hi that always keeps `keep`.
function seed (lo, hi) {
  return (cell, keep) => {
    const r = rnd()
    if (r < 0.35) return [keep]
    const s = new Set([keep])
    if (r < 0.55) { for (let d = lo; d <= hi; d++) s.add(d) } else { for (let d = lo; d <= hi; d++) if (rnd() < 0.5) s.add(d) }
    return [...s]
  }
}

const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]] } return a }

// Band/stack shuffles keep a grid a valid sudoku. Digit relabelling would not be
// safe here: a hit compares a digit to a position, so relabelling changes the
// rule, not just the grid.
function reshuffle (grid, bh, bw) {
  const n = grid.length
  const rowOrder = []
  for (let b = 0; b < n; b += bh) rowOrder.push(shuffle(Array.from({ length: bh }, (_, k) => b + k)))
  const colOrder = []
  for (let b = 0; b < n; b += bw) colOrder.push(shuffle(Array.from({ length: bw }, (_, k) => b + k)))
  const rows = shuffle(rowOrder).flat()
  const cols = shuffle(colOrder).flat()
  return rows.map(r => cols.map(c => grid[r][c]))
}

// ---- house lines: D over real grids, both clues of every line ----
let hTests = 0
let hBad = 0
let hFired = 0
for (const file of ['gen_4x4.json', 'gen_6x6.json', 'gen_9x9.json']) {
  const gen = JSON.parse(readFileSync(join(EXAMPLE, file), 'utf8'))
  const { n, box: [bh, bw] } = gen
  const { interior, clueCell, lineCells, keys } = frameGeometry(n, [bh, bw])
  for (let iter = 0; iter < 4000; iter++) {
    const grid = iter === 0 ? gen.grid : reshuffle(gen.grid, bh, bw)
    const truth = {}
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) truth[interior(r, c)] = grid[r][c]
    for (const k of keys) {
      const side = k[0]; const i = +k.slice(1)
      const line = lineCells(side, i)
      let hits = 0
      for (let j = 0; j < n; j++) if (truth[line[j]] === j + 1) hits++
      truth[clueCell(side, i)] = hits
    }
    const lineSeed = seed(1, n)
    const clueSeed = seed(0, n)
    const clueCells = new Set(keys.map(k => clueCell(k[0], +k.slice(1))))
    const p = makePuzzle(truth, (c, v) => (clueCells.has(c) ? clueSeed : lineSeed)(c, v))
    p.getCellsCanHaveRepeats = () => false
    const before = [...Object.keys(truth)].reduce((s, c) => s + p.getCandidates(+c).size, 0)
    for (const [sa, sb] of [['L', 'R'], ['T', 'B']]) {
      for (let i = 0; i < n; i++) {
        const inst = {}
        joint.setParams(inst, clueCell(sa, i), clueCell(sb, i), lineCells(sa, i))
        const v = violates(joint, inst, p, truth)
        hTests++
        if (v) { hBad++; if (hBad <= 5) console.log('JOINT violation', file, sa + i, v) }
      }
    }
    const after = [...Object.keys(truth)].reduce((s, c) => s + p.getCandidates(+c).size, 0)
    if (after < before) hFired++
  }
}
console.log('joint, house lines:', hTests, 'tests,', hBad, 'violations,', hFired, 'states pruned')

// ---- bare lines: digits may repeat, so the house exclusion must stay off ----
const A = 100
const B = 101
let bTests = 0
let bBad = 0
let bFired = 0
for (let iter = 0; iter < 20000; iter++) {
  const n = 4 + ((rnd() * 6) | 0) // 4..9
  const vals = Array.from({ length: n }, () => 1 + ((rnd() * n) | 0))
  const line = Array.from({ length: n }, (_, j) => j)
  const truth = {}
  let a = 0
  let b = 0
  for (let j = 0; j < n; j++) {
    truth[j] = vals[j]
    if (vals[j] === j + 1) a++
    if (vals[j] === n - j) b++
  }
  truth[A] = a
  truth[B] = b
  const lineSeed = seed(1, n)
  const clueSeed = seed(0, n)
  const p = makePuzzle(truth, (c, v) => (c === A || c === B ? clueSeed : lineSeed)(c, v))
  p.getCellsCanHaveRepeats = () => true
  const before = [...Object.keys(truth)].reduce((s, c) => s + p.getCandidates(+c).size, 0)
  const inst = {}
  joint.setParams(inst, A, B, line)
  const v = violates(joint, inst, p, truth)
  bTests++
  if (v) { bBad++; if (bBad <= 5) console.log('JOINT bare-line violation, n =', n, v) }
  const after = [...Object.keys(truth)].reduce((s, c) => s + p.getCandidates(+c).size, 0)
  if (after < before) bFired++
}
console.log('joint, bare lines:', bTests, 'tests,', bBad, 'violations,', bFired, 'states pruned')

const ok = hBad === 0 && bBad === 0 && hFired > 0 && bFired > 0
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
