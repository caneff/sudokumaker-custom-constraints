// Soundness fuzz and strength comparison for RequiredDigitsGacComponent, the
// full-strength replacement for the built-in RequiredDigits
// (bundle.claude.js:3234). Run through `soundness-harness.mjs` beside this
// file (`just soundness`).
//
// Three checks, each of which fails the run:
//   1. Soundness. Random satisfiable states in which every cell still allows
//      its true value: the component must never remove a true value, never
//      stop the branch, and its `validate` must accept the true solution. A
//      removed true value makes a real puzzle unsolvable. Run by the shared
//      `fuzzSoundness` loop.
//   2. Strength against the built-in. The built-in's `update` rule is ported
//      here verbatim from the bundle body and run on the same states: every
//      candidate it removes, the component must remove too.
//   3. Completeness on small instances. A brute-force oracle keeps a candidate
//      only when some system of distinct representatives places every required
//      digit with that candidate in place. The GAC component must remove no
//      more than the oracle (sound); we report how much less it removes.

import { fuzzSoundness, installGlobals, makeIo, makePuzzle, makeRng, makeSeeder } from '../_shared/harness-lib.mjs'

const HERE = import.meta.dirname
const { load } = makeIo(HERE)

const N = 9
installGlobals(1, N)

const mod = load('RequiredDigitsGacComponent.js', ['setParams', 'update', 'validate'])
const seeder = makeSeeder(rndSeeder(), [...Array(N).keys()].map(i => i + 1))
const { rnd } = makeRng()
function rndSeeder () { return makeRng(777).rnd }

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
  if (unsolved.length !== remaining.length) return []
  const removed = []
  const keep = new Set(remaining)
  for (const cell of unsolved) {
    for (const d of [...p._cand.get(cell)]) {
      if (!keep.has(d)) { p._cand.get(cell).delete(d); removed.push(`${cell}:${d}`) }
    }
  }
  return removed
}

function hasSdr (values, cells, candOf) {
  const matchOf = new Map()
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
  const removed = new Set()
  for (const cell of cells) {
    for (const d of [...sets.get(cell)]) {
      const candOf = c => (c === cell ? new Set([d]) : sets.get(c))
      if (!hasSdr(values, cells, candOf)) removed.add(`${cell}:${d}`)
    }
  }
  return removed
}

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
  return { cells, values, truth, houses }
}

// One shape: `iters` states through the shared soundness loop, then checks 2
// and 3 read off each state's puzzle, which the loop left at its fixpoint.
function run (label, { cellCount, valueCount, iters, houses = [], forceRepeat = false }) {
  const records = []
  const result = fuzzSoundness(label, {
    iters,
    draw: () => {
      const { cells, values, truth, houses: declared } = makeState(cellCount, valueCount, { houses, forceRepeat })
      const inst = { name: 'required digits' }
      mod.setParams(inst, values, cells)
      return {
        truth,
        seed: seeder,
        houses: declared,
        parts: [{ mod, inst }],
        note: `values ${values.join('')} truth ${cells.map(c => truth[c]).join('')}`,
        inspect: p => records.push({ cells, values, truth, houses: declared, p, snapshot: new Map([...p._cand].map(([c, s]) => [c, new Set(s)])) })
      }
    }
  })

  let bad = result.failures
  let removedGac = 0
  let removedBuiltin = 0
  let removedOracle = 0
  let oracleChecked = 0
  for (const { cells, values, truth, houses: declared, p, snapshot } of records) {
    const gacRemoved = new Set()
    for (const [c, s] of snapshot) for (const d of s) if (!p._cand.get(c).has(d)) gacRemoved.add(`${c}:${d}`)
    removedGac += gacRemoved.size

    const q = makePuzzle(truth, () => [], { houses: declared })
    for (const [c, s] of snapshot) q._cand.set(c, new Set(s))
    const builtinRemoved = builtinUpdate(values, cells, q)
    removedBuiltin += builtinRemoved.length
    for (const key of builtinRemoved) {
      if (gacRemoved.has(key)) continue
      bad++
      if (bad <= 5) console.log(label, 'WEAKER THAN BUILT-IN', key, 'values', values.join(''), 'truth', cells.map(c => truth[c]).join(''))
    }

    if (cellCount <= 6) {
      const oracleRemoved = oracleRemovals(values, cells, snapshot)
      removedOracle += oracleRemoved.size
      oracleChecked++
      for (const key of gacRemoved) {
        if (oracleRemoved.has(key)) continue
        bad++
        if (bad <= 5) console.log(label, 'REMOVED MORE THAN THE ORACLE', key, 'values', values.join(''), 'truth', cells.map(c => truth[c]).join(''))
      }
    }
  }
  const oracle = oracleChecked > 0 ? `  oracle removed ${removedOracle} over ${oracleChecked} states` : ''
  console.log(`${label}: gac removed ${removedGac}  builtin removed ${removedBuiltin}${oracle}`)
  return bad
}

export function requiredDigitsSoundness () {
  let failures = 0
  failures += run('required: 4 cells, 3 digits, bare   ', { cellCount: 4, valueCount: 3, iters: 4000 })
  failures += run('required: 4 cells, 4 digits, bare   ', { cellCount: 4, valueCount: 4, iters: 4000 })
  failures += run('required: 6 cells, 3 digits, bare   ', { cellCount: 6, valueCount: 3, iters: 4000 })
  failures += run('required: 6 cells, 6 digits, house  ', { cellCount: 6, valueCount: 6, iters: 4000, houses: [[0, 1, 2, 3, 4, 5]] })
  failures += run('required: 9 cells, 4 digits, bare   ', { cellCount: 9, valueCount: 4, iters: 4000 })
  failures += run('required: 4 cells, 2+2 repeat, bare ', { cellCount: 4, valueCount: 4, iters: 4000, forceRepeat: true })
  failures += run('required: 9 cells, 9 digits, house  ', { cellCount: 9, valueCount: 9, iters: 4000, houses: [[0, 1, 2, 3, 4, 5, 6, 7, 8]] })
  return failures
}
