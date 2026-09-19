// Soundness fuzz, strength and completeness for CountDigitsGacComponent, the
// pruning replacement for the built-in CountDigits (bundle.claude.js:5092).
//
//   node docs/research/count-digits-gac/soundness-harness.mjs
//
// Three checks:
//   1. Soundness. Random states built around a true solution, every cell still
//      holding its true value: the component must never remove a true value and
//      never stop the branch. A removed true value makes a real puzzle
//      unsolvable, silently.
//   2. Strength against the built-in. The built-in defines no `update` and so
//      removes nothing; what it does have is `validate`, ported verbatim in
//      BuiltinCountDigitsComponent.js. The interesting count is the states the
//      built-in's validate accepts while the GAC component still prunes -- the
//      deductions the search would otherwise have to find by trial.
//   3. Completeness. A brute-force oracle enumerates every assignment the
//      candidates allow, keeps the ones obeying the rule, and reads each cell's
//      supported digits off them. The component must remove no more than the
//      oracle (sound) and we report how much less it removes (weak).

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo, makePuzzle, makeRng, makeSeeder, total, violates } from '../../../examples/_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)

installGlobals(1, 9)

const gac = load('CountDigitsGacComponent.js', ['setParams', 'update', 'validate'])
const builtin = load('BuiltinCountDigitsComponent.js', ['setParams', 'validate'])

const { rnd } = makeRng(4242)
function maskOf (digits) { let m = 0; for (const d of digits) m |= 1 << d; return m }

// ---- states: always satisfiable, always keeping every true value ----
// `counterIsTarget` puts the counter cell in its own target list, which the
// built-in's constructor allows (its cellIds are [counterCell, ...targetCells]
// either way). The truth then has to be a fixed point of the count, so it is
// searched for rather than computed.
function makeState ({ targetCount, digitCount, digitRange, counterIsTarget }) {
  const allDigits = [...Array(digitRange).keys()].map(i => i + 1)
  const digits = allDigits.slice().sort(() => rnd() - 0.5).slice(0, digitCount)
  const digitMask = maskOf(digits)
  const inSet = new Set(digits)
  const counter = 0
  const targets = [...Array(targetCount).keys()].map(i => i + 1)
  if (counterIsTarget) targets[(rnd() * targets.length) | 0] = counter

  const truth = {}
  for (const cell of [counter, ...targets]) truth[cell] = 1 + ((rnd() * digitRange) | 0)
  const countWith = value => {
    truth[counter] = value
    return targets.reduce((n, cell) => n + (inSet.has(truth[cell]) ? 1 : 0), 0)
  }
  const fixed = allDigits.filter(value => countWith(value) === value)
  if (fixed.length === 0) return null // no legal counter digit: redraw
  truth[counter] = fixed[(rnd() * fixed.length) | 0]

  const seeder = makeSeeder(rnd, allDigits)
  const seed = new Map([counter, ...targets].map(cell => [cell, seeder(cell, truth[cell])]))
  return { counter, targets, digitMask, truth, seed }
}

const puzzleOf = state => makePuzzle(state.truth, cell => state.seed.get(cell))
const candidatesOf = p => new Map([...p._cand].map(([cell, set]) => [cell, new Set(set)]))

function runComponent (mod, state) {
  const instance = { name: 'count digits' }
  mod.setParams(instance, state.digitMask, state.counter, state.targets)
  return instance
}

// ---- oracle: every assignment the candidates allow that obeys the rule ----
// Independent of the component: it enumerates digits and counts hits, rather
// than reasoning about bounds. Returns cell -> Set of supported digits, or null
// when nothing satisfies the rule (the state is dead).
function supportedDigits (state, candidates) {
  const { counter, targets, digitMask } = state
  const supported = new Map([...candidates.keys()].map(cell => [cell, new Set()]))
  const assigned = new Map()
  const hits = () => targets.reduce((n, cell) => n + (((1 << assigned.get(cell)) & digitMask) ? 1 : 0), 0)
  const distinct = [...new Set([counter, ...targets])]
  let found = 0
  const walk = (index) => {
    if (index === distinct.length) {
      if (assigned.get(counter) !== hits()) return
      found++
      for (const [cell, digit] of assigned) supported.get(cell).add(digit)
      return
    }
    const cell = distinct[index]
    for (const digit of candidates.get(cell)) {
      assigned.set(cell, digit)
      walk(index + 1)
    }
  }
  walk(0)
  return found === 0 ? null : supported
}

function run (label, shape) {
  const { iters, oracle = false } = shape
  let drawn = 0
  let bad = 0
  let removedGac = 0
  let firedGac = 0
  let stoppedGac = 0
  let builtinBlind = 0
  let oracleChecked = 0
  let removedOracle = 0
  let missedByGac = 0
  for (let iter = 0; iter < iters; iter++) {
    const state = makeState(shape)
    if (state === null) continue
    drawn++

    // 1. soundness, run to a fixpoint on a state that still holds its solution
    const p = puzzleOf(state)
    const start = candidatesOf(p)
    const before = total(p)
    const violation = violates(gac, runComponent(gac, state), p, state.truth)
    const removed = before - total(p)
    removedGac += removed
    if (removed > 0) firedGac++
    if (p._stopped !== null) stoppedGac++
    if (violation) {
      bad++
      if (bad <= 5) console.log(label, 'VIOLATION', JSON.stringify(violation), 'digits', state.digitMask.toString(2), 'truth', JSON.stringify(state.truth))
    }

    // 2. what the built-in's validate makes of the same starting state
    if (removed > 0 || p._stopped !== null) {
      const q = puzzleOf(state)
      for (const [cell, set] of start) q._cand.set(cell, new Set(set))
      if (builtin.validate(runComponent(builtin, state), q)) builtinBlind++
    }

    // 3. completeness against the oracle, on the shapes small enough to
    //    enumerate. The component ran to a fixpoint above, so compare its final
    //    sets with the oracle's supported digits on the same start.
    if (oracle) {
      const support = supportedDigits(state, start)
      oracleChecked++
      if (support === null) continue // dead state: the fuzz never builds one
      for (const [cell, startSet] of start) {
        for (const digit of startSet) {
          const supportedHere = support.get(cell).has(digit)
          const keptHere = p._stopped === null && p._cand.get(cell).has(digit)
          if (!supportedHere) removedOracle++
          if (!supportedHere && keptHere) missedByGac++
          if (supportedHere && !keptHere) {
            bad++
            if (bad <= 5) console.log(label, 'OVER-PRUNED', { cell, digit }, 'truth', JSON.stringify(state.truth))
          }
        }
      }
    }
  }
  const oracleRow = oracle ? `  oracle: ${removedOracle} removable, ${missedByGac} missed over ${oracleChecked} states` : ''
  console.log(`${label}: ${bad} violations in ${drawn} states; gac fired ${firedGac}x (${stoppedGac} stops) removed ${removedGac}; builtin validate accepted ${builtinBlind} of those${oracleRow}`)
  return bad
}

let failures = 0
failures += run('5 targets, 2 digits, oracle  ', { targetCount: 5, digitCount: 2, digitRange: 5, counterIsTarget: false, iters: 4000, oracle: true })
failures += run('5 targets, 3 digits, oracle  ', { targetCount: 5, digitCount: 3, digitRange: 5, counterIsTarget: false, iters: 4000, oracle: true })
failures += run('4 targets, 2 digits, counter ', { targetCount: 4, digitCount: 2, digitRange: 4, counterIsTarget: true, iters: 4000, oracle: true })
failures += run('9 targets, 3 digits, bare    ', { targetCount: 9, digitCount: 3, digitRange: 9, counterIsTarget: false, iters: 4000 })
failures += run('12 targets, 4 digits, bare   ', { targetCount: 12, digitCount: 4, digitRange: 9, counterIsTarget: false, iters: 4000 })
failures += run('20 targets, 3 digits, bare   ', { targetCount: 20, digitCount: 3, digitRange: 9, counterIsTarget: false, iters: 4000 })
failures += run('12 targets, 4 digits, counter', { targetCount: 12, digitCount: 4, digitRange: 9, counterIsTarget: true, iters: 4000 })

console.log(failures === 0 ? 'OK: no soundness violations' : `FAIL: ${failures} violations`)
process.exit(failures === 0 ? 0 : 1)
