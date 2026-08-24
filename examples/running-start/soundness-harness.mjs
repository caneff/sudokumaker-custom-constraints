// Soundness fuzz for both Running Start components. Soundness = a component
// never removes a cell's TRUE value. We seed random partial states in which
// every cell still allows its true value, run the component to a fixpoint, and
// check the true value survived. A removed true value is a bug that can make a
// real puzzle unsolvable.
//
//   node examples/running-start/soundness-harness.mjs
//
// The line test uses the real seed-104 puzzle (seed104_solution.json). The pair test
// uses a synthetic mountain line, because no line in this puzzle reaches the
// A + B === n + 1 case that drives the pair's unimodal branch.

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = f => readFileSync(join(HERE, f), 'utf8')

globalThis.SudokuDigitSet = { from: a => ({ __set: new Set(a), [Symbol.iterator] () { return this.__set[Symbol.iterator]() } }) }
globalThis.helpers = { digits: { minDigit: 1, maxDigit: 9 } }

function load (file, names) {
  return eval('(function(){' + read(file) + '\n return {' + names.join(',') + '};})()')
}
const lineMod = load('RunningStartComponent.js', ['setParams', 'update'])
const pairMod = load('RunningStartPairComponent.js', ['setParams', 'update'])

// Deterministic RNG.
let rng = 12345
const rnd = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff }
const pick = arr => arr[(rnd() * arr.length) | 0]

// A mock puzzle over a truth map (cell -> true value). Each cell starts with a
// candidate set that always contains its true value.
function makePuzzle (truth, seed) {
  const cand = new Map()
  for (const [c, v] of Object.entries(truth)) cand.set(+c, new Set(seed(+c, v)))
  return {
    _cand: cand,
    hasValue: c => cand.get(c).size === 1,
    getValue: c => [...cand.get(c)][0],
    getCandidates: c => cand.get(c),
    getCellsAreFilled: cs => cs.every(c => cand.get(c).size === 1),
    removeCandidatesFromCell: (s, c) => { const set = cand.get(c); for (const d of s) set.delete(d) }
  }
}

// Run a component's update to a fixpoint (bounded), return true if any cell lost
// its true value or went empty.
function violates (mod, inst, p, truth) {
  for (let pass = 0; pass < 20; pass++) {
    let sizes = 0
    for (const s of p._cand.values()) sizes += s.size
    for (const _ of mod.update(inst, p)) { /* drain */ }
    let after = 0
    for (const s of p._cand.values()) after += s.size
    if (after === sizes) break
  }
  for (const [c, v] of Object.entries(truth)) {
    if (!p._cand.get(+c).has(v)) return { cell: +c, lost: v }
    if (p._cand.get(+c).size === 0) return { cell: +c, empty: true }
  }
  return null
}

// A random candidate seed for a cell: pinned, full, or a subset that keeps true.
function seeder (c, v) {
  const mode = pick(['pin', 'full', 'subset'])
  if (mode === 'pin') return [v]
  if (mode === 'full') return [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const s = new Set([v])
  for (let d = 1; d <= 9; d++) if (rnd() < 0.5) s.add(d)
  return [...s]
}

// ---- Line component against the real puzzle ----
const sol = JSON.parse(read('seed104_solution.json'))
let lineTests = 0
let lineBad = 0
for (let iter = 0; iter < 20000; iter++) {
  const [clue, line] = sol.groups[iter % sol.groups.length]
  const all = [clue, ...line]
  const truth = {}
  for (const c of all) truth[c] = sol.val[c]
  const p = makePuzzle(truth, seeder)
  const inst = {}
  lineMod.setParams(inst, clue, line)
  const v = violates(lineMod, inst, p, truth)
  lineTests++
  if (v) { lineBad++; if (lineBad <= 5) console.log('LINE violation', v, 'clue', clue) }
}
console.log('line component:', lineTests, 'tests,', lineBad, 'violations')

// ---- Pair component against a synthetic mountain line ----
// line[0..8] strictly up to the peak (9 at index 3) then strictly down.
// From the left the increasing run is 2<4<7<9 -> A = 4. From the right the
// increasing-inward run is 1<3<5<6<8<9 -> B = 6. A + B = 10 = n + 1.
const mountain = [2, 4, 7, 9, 8, 6, 5, 3, 1]
const CA = 100
const CB = 101
const LINE = [0, 1, 2, 3, 4, 5, 6, 7, 8]
const trueA = 4
const trueB = 6
let pairTests = 0
let pairBad = 0
let pairFired = 0     // coverage: the unimodal branch actually ran
for (let iter = 0; iter < 20000; iter++) {
  const truth = { [CA]: trueA, [CB]: trueB }
  for (const i of LINE) truth[i] = mountain[i]
  const p = makePuzzle(truth, seeder)
  const inst = {}
  pairMod.setParams(inst, CA, CB, LINE)
  // did the branch fire? it fires iff min(A)+min(B) === n+1
  const minA = Math.min(...p.getCandidates(CA))
  const minB = Math.min(...p.getCandidates(CB))
  if (minA + minB === LINE.length + 1) pairFired++
  const v = violates(pairMod, inst, p, truth)
  pairTests++
  if (v) { pairBad++; if (pairBad <= 5) console.log('PAIR violation', v) }
}
console.log('pair component:', pairTests, 'tests,', pairBad, 'violations,', pairFired, 'unimodal firings')

const ok = lineBad === 0 && pairBad === 0 && pairFired > 0
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
