// Shared scaffold for the soundness fuzz harnesses. Soundness = a component
// never removes a cell's TRUE value. Each example supplies its own seeding and
// test cases; the parts every harness copies live here.
//
// A component reads two globals at update time: SudokuDigitSet.from(array) and
// helpers.digits.{minDigit,maxDigit}. Call installGlobals once before running.

import { readFileSync } from 'fs'
import { join } from 'path'

// The app's DigitSet, as read from its bundle (docs/puzzle-api.md): a bitmask
// where bit d is digit d. The algebra methods MUTATE and return this.
export class DigitSet {
  constructor (mask = 0) { this.mask = +mask }
  static from (digits) { let m = 0; for (const d of digits) m |= 1 << d; return new this(m) }
  get size () { let n = 0; for (let m = this.mask; m; m &= m - 1) n++; return n }
  has (d) { return (this.mask & (1 << d)) !== 0 }
  valueOf () { return this.mask }
  intersects (o) { return (this.mask & o.valueOf()) !== 0 }
  intersect (o) { this.mask &= o.valueOf(); return this }
  union (o) { this.mask |= o.valueOf(); return this }
  subtract (o) { this.mask &= ~o.valueOf(); return this }
  * [Symbol.iterator] () { for (let m = this.mask; m; m &= m - 1) yield 31 - Math.clz32(m & -m) }
}

// Set the two globals a component reads. minDigit/maxDigit differ per example
// (Hit Counts allows a 0 clue, Running Start does not).
export function installGlobals (minDigit, maxDigit) {
  globalThis.SudokuDigitSet = DigitSet
  globalThis.helpers = { digits: { minDigit, maxDigit } }
}

// Bind file reads to the example's own directory. `read` returns a file's text;
// `load` evals a component file and returns the named functions from it.
export function makeIo (here) {
  const read = f => readFileSync(join(here, f), 'utf8')
  const load = (file, names) =>
    eval('(function(){' + read(file) + '\n return {' + names.join(',') + '};})()') // eslint-disable-line no-eval
  return { read, load }
}

// Deterministic RNG. `rnd` returns a float in [0,1); `pick` chooses from an array.
export function makeRng (seed = 12345) {
  let rng = seed
  const rnd = () => { rng = (rng * 1103515245 + 12345) & 0x7fffffff; return rng / 0x7fffffff }
  const pick = arr => arr[(rnd() * arr.length) | 0]
  return { rnd, pick }
}

// A mock puzzle over a truth map (cell -> true value). Each cell starts with a
// candidate set that always contains its true value. `seed(cell, value)` returns
// the starting candidate array.
export function makePuzzle (truth, seed) {
  const cand = new Map()
  for (const [c, v] of Object.entries(truth)) cand.set(+c, new Set(seed(+c, v)))
  return {
    _cand: cand,
    hasValue: c => cand.get(c).size === 1,
    getValue: c => [...cand.get(c)][0],
    // A fresh DigitSet per call, as in the app — mutating it is safe.
    getCandidates: c => DigitSet.from(cand.get(c)),
    getCandidatesBitMask: c => DigitSet.from(cand.get(c)).mask,
    getCellsAreFilled: cs => cs.every(c => cand.get(c).size === 1),
    removeCandidateFromCell: (d, c) => { cand.get(c).delete(d) },
    removeCandidatesFromCell: (s, c) => { const set = cand.get(c); for (const d of s) set.delete(d) }
  }
}

// Run a component's update to a fixpoint (bounded), then report a cell that lost
// its true value or went empty. Returns null when the true values all survive.
export function violates (mod, inst, p, truth) {
  for (let pass = 0; pass < 20; pass++) {
    let sizes = 0
    for (const s of p._cand.values()) sizes += s.size
    Array.from(mod.update(inst, p)) // drain
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
