// Soundness fuzz for the Hit Counts component. Soundness = the component never
// removes a cell's TRUE value. We seed random partial states in which every cell
// still allows its true value, run the component to a fixpoint, and check the
// true value survived. A removed true value is a bug that can make a real puzzle
// unsolvable.
//
//   node examples/hit-counts/soundness-harness.mjs
//
// Lines are synthetic random permutations of 1..9 read in a random direction, so
// the clue ranges over 0..9. We also force in the identity (clue 9) and a
// derangement (clue 0) to exercise both extremes on every run.

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const HERE = dirname(fileURLToPath(import.meta.url))
const read = f => readFileSync(join(HERE, f), 'utf8')

globalThis.SudokuDigitSet = { from: a => ({ __set: new Set(a), [Symbol.iterator] () { return this.__set[Symbol.iterator]() } }) }
globalThis.helpers = { digits: { minDigit: 0, maxDigit: 9 } }

function load (file, names) {
  return eval('(function(){' + read(file) + '\n return {' + names.join(',') + '};})()')
}
const mod = load('HitCountsComponent.js', ['setParams', 'update'])

// Deterministic RNG.
let rng = 12345
const rnd = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff }

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
    removeCandidateFromCell: (d, c) => { cand.get(c).delete(d) },
    removeCandidatesFromCell: (s, c) => { const set = cand.get(c); for (const d of s) set.delete(d) }
  }
}

// Run update to a fixpoint (bounded), then report a cell that lost its true
// value or went empty.
function violates (inst, p, truth) {
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

// A random candidate seed keeping the true value. `hi` bounds the range: line
// cells use 1..9, the clue cell uses 0..9 (it can be 0).
function seeder (lo, hi) {
  return (c, v) => {
    const mode = [1, 2, 3][(rnd() * 3) | 0]
    if (mode === 1) return [v]                       // pinned
    const s = new Set([v])
    for (let d = lo; d <= hi; d++) if (rnd() < 0.5) s.add(d)   // subset keeping truth
    return [...s]
  }
}

const CLUE = 100
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0;[a[i], a[j]] = [a[j], a[i]] } return a }
const hits = perm => perm.reduce((k, x, i) => k + (x === i + 1 ? 1 : 0), 0)

// A pool of lines: many random permutations plus the two forced extremes.
const lines = [[1, 2, 3, 4, 5, 6, 7, 8, 9], [2, 3, 4, 5, 6, 7, 8, 9, 1]]   // identity (9), derangement (0)
for (let i = 0; i < 400; i++) lines.push(shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]))

let tests = 0
let bad = 0
const seenClues = new Set()
for (let iter = 0; iter < 40000; iter++) {
  const perm = lines[iter % lines.length]
  const clueVal = hits(perm)
  seenClues.add(clueVal)
  const truth = { [CLUE]: clueVal }
  for (let i = 0; i < 9; i++) truth[i] = perm[i]
  const lineSeed = seeder(1, 9)
  const clueSeed = seeder(0, 9)
  const p = makePuzzle(truth, (c, v) => (c === CLUE ? clueSeed : lineSeed)(c, v))
  const inst = {}
  mod.setParams(inst, CLUE, [0, 1, 2, 3, 4, 5, 6, 7, 8])
  const v = violates(inst, p, truth)
  tests++
  if (v) { bad++; if (bad <= 5) console.log('violation', v, 'clue', clueVal) }
}
console.log('hit-counts component:', tests, 'tests,', bad, 'violations')
console.log('clue values exercised:', [...seenClues].sort((a, b) => a - b).join(' '))

const ok = bad === 0 && seenClues.has(0) && seenClues.has(9)
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
