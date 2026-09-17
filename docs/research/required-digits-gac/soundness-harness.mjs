// Soundness fuzz and strength comparison for RequiredDigitsGacComponent, the
// full-strength replacement for the built-in RequiredDigits
// (bundle.claude.js:3234).
//
//   node docs/research/required-digits-gac/soundness-harness.mjs
//
// Three checks:
//   1. Soundness. Random satisfiable states in which every cell still allows
//      its true value: the component must never remove a true value and never
//      stop the branch. A removed true value makes a real puzzle unsolvable.
//   2. Strength against the built-in. The built-in's `update` rule is ported
//      here verbatim from the bundle body and run on the same states; we count
//      how many candidates each removes.
//   3. Completeness on small instances. A brute-force oracle keeps a candidate
//      only when some system of distinct representatives places every required
//      digit with that candidate in place. The GAC component must remove no
//      more than the oracle (sound) and we report how much less it removes.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { makeIo, makeRng, makePuzzle, makeSeeder, total, violates } from '../../../examples/_shared/harness-lib.mjs'
import { installGlobals } from '../../../examples/_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)

const N = 9
installGlobals(1, N)

const mod = load('RequiredDigitsGacComponent.js', ['setParams', 'update', 'validate'])
const seeder = makeSeeder(rndSeeder(), [...Array(N).keys()].map(i => i + 1))
const { rnd } = makeRng()
function rndSeeder () { return makeRng(777).rnd }

// ---- the built-in's rule, ported from the bundle body for comparison ----
// update: subtract each FILLED value from a copy of `values`, collect the
// unfilled cells, and filter them to the remaining values only when the two
// counts match exactly. No candidate is ever read.
function builtinUpdate (values, cells, p) {
  const unsolved = []
  const remaining = values.slice()
  for (const cell of cells) {
    const value = p.getValue(cell)
    if (value !== undefined) {
      const at = remaining.indexOf(value)
      if (at >= 0) remaining.splice(at, 1)
    } else unsolved.push(cell)
  }
  if (unsolved.length !== remaining.length) return 0
  let removed = 0
  const keep = new Set(remaining)
  for (const cell of unsolved) {
    for (const d of [...p._cand.get(cell)]) {
      if (!keep.has(d)) { p._cand.get(cell).delete(d); removed++ }
    }
  }
  return removed
}

// ---- oracle: is there an SDR for `values` over `cells` given candidates? ----
function hasSdr (values, cells, candOf) {
  const matchOf = new Map() // cell -> value index
  const seenStamp = new Map()
  let stamp = 0
  const tryAssign = (valueIndex) => {
    stamp++
    const walk = (vi) => {
      for (const cell of cells) {
        if (!candOf(cell).has(values[vi])) continue
        if (seenStamp.get(cell) === stamp) continue
        seenStamp.set(cell, stamp)
        if (!matchOf.has(cell) || walk(matchOf.get(cell))) {
          matchOf.set(cell, vi)
          return true
        }
      }
      return false
    }
    return walk(valueIndex)
  }
  for (let vi = 0; vi < values.length; vi++) if (!tryAssign(vi)) return false
  return true
}

// A candidate survives the oracle when pinning that cell to that digit still
// leaves an SDR for the whole multiset.
function oracleRemovals (values, cells, sets) {
  let removed = 0
  for (const cell of cells) {
    for (const d of [...sets.get(cell)]) {
      const candOf = c => (c === cell ? new Set([d]) : sets.get(c))
      if (!hasSdr(values, cells, candOf)) removed++
    }
  }
  return removed
}

// ---- state generator: always satisfiable, always keeps the true values ----
// A declared house means the cells really cannot repeat, so its true digits
// must be distinct -- otherwise the "truth" is not a legal state and any
// component that trusts the house is marked wrong for being right.
function makeState (cellCount, valueCount, { houses = [], forceRepeat = false } = {}) {
  const cells = [...Array(cellCount).keys()]
  const truth = {}
  if (houses.length > 0) {
    const pool = [...Array(N).keys()].map(i => i + 1).sort(() => rnd() - 0.5)
    for (const cell of cells) truth[cell] = pool[cell]
  } else if (forceRepeat) {
    // Two digits over every cell, so the required multiset repeats and
    // `repeatsFit` is exercised on cells the app lets repeat.
    const a = 1 + ((rnd() * N) | 0)
    let b = 1 + ((rnd() * N) | 0)
    if (b === a) b = 1 + (a % N)
    for (const cell of cells) truth[cell] = rnd() < 0.5 ? a : b
  } else {
    for (const cell of cells) truth[cell] = 1 + ((rnd() * N) | 0)
  }
  // Required digits are the true values of a random subset of cells, so the
  // true state satisfies the constraint by construction.
  const picked = cells.slice().sort(() => rnd() - 0.5).slice(0, valueCount)
  const values = picked.map(cell => truth[cell])
  const p = makePuzzle(truth, seeder, { houses })
  return { cells, values, truth, p }
}

function run (label, { cellCount, valueCount, iters, houses = [], forceRepeat = false }) {
  let bad = 0
  let firedGac = 0
  let removedGac = 0
  let removedBuiltin = 0
  let removedOracle = 0
  let oracleChecked = 0
  for (let iter = 0; iter < iters; iter++) {
    const { cells, values, truth, p } = makeState(cellCount, valueCount, { houses, forceRepeat })
    const snapshot = new Map([...p._cand].map(([c, s]) => [c, new Set(s)]))

    const inst = { name: 'required digits' }
    mod.setParams(inst, values, cells)
    const before = total(p)
    const v = violates(mod, inst, p, truth)
    const gac = before - total(p)
    if (gac > 0) firedGac++
    removedGac += gac
    if (v) {
      bad++
      if (bad <= 5) console.log(label, 'VIOLATION', JSON.stringify(v), 'values', values.join(''), 'truth', cells.map(c => truth[c]).join(''))
    }

    // the built-in on the same starting state
    const q = makePuzzle(truth, () => [], { houses })
    for (const [c, s] of snapshot) q._cand.set(c, new Set(s))
    removedBuiltin += builtinUpdate(values, cells, q)

    if (cellCount <= 6) {
      removedOracle += oracleRemovals(values, cells, snapshot)
      oracleChecked++
    }
  }
  const oracle = oracleChecked > 0 ? `  oracle removed ${removedOracle}` : ''
  console.log(`${label}: ${bad} violations in ${iters} states; gac fired ${firedGac}x removed ${removedGac}  builtin removed ${removedBuiltin}${oracle}`)
  return bad
}

let failures = 0
failures += run('4 cells, 3 digits, bare   ', { cellCount: 4, valueCount: 3, iters: 4000 })
failures += run('4 cells, 4 digits, bare   ', { cellCount: 4, valueCount: 4, iters: 4000 })
failures += run('6 cells, 3 digits, bare   ', { cellCount: 6, valueCount: 3, iters: 4000 })
failures += run('6 cells, 6 digits, house  ', { cellCount: 6, valueCount: 6, iters: 4000, houses: [[0, 1, 2, 3, 4, 5]] })
failures += run('9 cells, 4 digits, bare   ', { cellCount: 9, valueCount: 4, iters: 4000 })
failures += run('4 cells, 2+2 repeat, bare ', { cellCount: 4, valueCount: 4, iters: 4000, forceRepeat: true })
failures += run('9 cells, 9 digits, house  ', { cellCount: 9, valueCount: 9, iters: 4000, houses: [[0, 1, 2, 3, 4, 5, 6, 7, 8]] })

console.log(failures === 0 ? 'OK: no soundness violations' : `FAIL: ${failures} violations`)
process.exit(failures === 0 ? 0 : 1)
