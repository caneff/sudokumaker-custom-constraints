// Soundness fuzz for both Running Start components. Soundness = a component
// never removes a cell's TRUE value. We seed random partial states in which
// every cell still allows its true value, run the component to a fixpoint, and
// check the true value survived. A removed true value is a bug that can make a
// real puzzle unsolvable.
//
//   node examples/running-start/soundness-harness.mjs
//
// The line component carries an `ALLOW_TIES` constant (docs/line-contract.md),
// so every pool runs twice: once with a tie ending the run, once with a tie
// continuing it. It claims soundness on every line kind, so each reading meets
// bare, house, and full-house lines, plus a bare pool whose lines tie right
// after the run — the state the break rule reads. The pair has no flag of its
// own; its pools still derive their truth clues under both readings.
//
// The pair test also uses a synthetic mountain line, because no line in the
// seed-104 puzzle reaches the A + B === n + 1 case that drives the pair's
// unimodal branch.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo, makeRng, makeLine, makePuzzle, violates, fixpoint } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { read, load, loadSource } = makeIo(HERE)
const { rnd, pick } = makeRng()

const N = 9
installGlobals(1, N)

// The components as they would read with the constant set either way. The app
// pastes each file as its own segment, so a flag is a source edit, not a
// parameter: the harness makes the same edit.
const TIES_FLAG = /^const ALLOW_TIES = (?:true|false)$/m
function loader (file, names) {
  const src = read(file)
  if (!TIES_FLAG.test(src)) throw new Error(`${file} has no 'const ALLOW_TIES = ...' line to flip`)
  return allowTies => loadSource(src.replace(TIES_FLAG, `const ALLOW_TIES = ${allowTies}`), names)
}
const loadLine = loader('RunningStartComponent.js', ['setParams', 'update', 'validate'])
// The pair carries no flag of its own -- it only prunes on a house, where the
// two readings coincide -- so it loads once, and every pair pool below runs it
// against truth clues derived under both readings all the same.
const pairMod = load('RunningStartPairComponent.js', ['setParams', 'update'])

// The truth clue for one line of digits: the length of the first run read
// inward. A tie ends the run when ties are hidden and continues it when they
// are allowed. A third statement of the rule (CODING_STANDARDS.md, "The rule
// has one home") — it must agree with the component and with build_size.rs.
function runWith (allowTies, vals) {
  let k = 1
  for (let i = 1; i < vals.length; i++) {
    if (allowTies ? vals[i] >= vals[i - 1] : vals[i] > vals[i - 1]) k++
    else break
  }
  return k
}

// A random candidate seed for a cell: pinned, full, or a subset that keeps true.
function seeder (c, v) {
  const mode = pick(['pin', 'full', 'subset'])
  if (mode === 'pin') return [v]
  if (mode === 'full') return [...Array(N).keys()].map(i => i + 1)
  const s = new Set([v])
  for (let d = 1; d <= N; d++) if (rnd() < 0.5) s.add(d)
  return [...s]
}

const total = p => { let n = 0; for (const s of p._cand.values()) n += s.size; return n }

// A bare line that ties right after its ascending run: an ascending run, the
// last digit again, then random filler. This is the state the two descent
// rules read, and the one a pool of uniform random digits almost never draws.
function makeTieLine (n) {
  const line = []
  let v = 1 + ((rnd() * 3) | 0)
  const run = 1 + ((rnd() * 4) | 0)
  for (let i = 0; i < run; i++) { line.push(v); v += 1 + ((rnd() * 2) | 0) }
  line.push(line[line.length - 1]) // the tie
  while (line.length < n) line.push(1 + ((rnd() * N) | 0))
  return line.slice(0, n)
}

// ---- Line component: three kinds, both readings, plus the tie pool ----

const LINE_CLUE = 200

function fuzzLine (label, { allowTies, kind, n, iters, digitsOf }) {
  const mod = loadLine(allowTies)
  const cells = Array.from({ length: n }, (_, i) => i)
  let bad = 0
  let fired = 0
  for (let iter = 0; iter < iters; iter++) {
    const digits = digitsOf ? digitsOf(n) : makeLine(rnd, kind, n, N)
    const truth = { [LINE_CLUE]: runWith(allowTies, digits) }
    for (let i = 0; i < n; i++) truth[i] = digits[i]
    const p = makePuzzle(truth, seeder, { kind, digitCount: N })
    const inst = {}
    mod.setParams(inst, LINE_CLUE, cells)
    const before = total(p)
    const v = violates(mod, inst, p, truth)
    if (total(p) < before) fired++
    if (v) { bad++; if (bad <= 5) console.log(label, 'violation', v, 'line', digits.join('')) }
  }
  console.log(`${label}:`, iters, 'tests,', bad, 'violations,', fired, 'states pruned')
  return { bad, fired }
}

let lineBad = 0
let lineSilent = 0
for (const allowTies of [false, true]) {
  const tag = allowTies ? 'ties continue' : 'ties end     '
  // A bare line is shorter than the digit count and may repeat; a house is six
  // distinct digits out of nine; a full house is a permutation of 1..9.
  const pools = [
    ['bare', 7, null],
    ['house', 6, null],
    ['fullHouse', N, null],
    ['bare', 7, makeTieLine]
  ]
  for (const [kind, n, digitsOf] of pools) {
    const name = digitsOf ? 'bare, tied' : kind
    const r = fuzzLine(`line, ${name.padEnd(10)} ${tag}`, { allowTies, kind, n, iters: 20000, digitsOf })
    lineBad += r.bad
    if (r.fired === 0) lineSilent++
  }
}
// The same component against the real seed-104 puzzle, whose lines are the
// frame rows and columns of a shipped board: full houses drawn from a grid a
// generator actually proved unique, not from makeLine.
const sol = JSON.parse(read('seed104_solution.json'))
let realBad = 0
for (const allowTies of [false, true]) {
  const mod = loadLine(allowTies)
  let bad = 0
  for (let iter = 0; iter < 20000; iter++) {
    const [clue, line] = sol.groups[iter % sol.groups.length]
    const truth = {}
    for (const c of [clue, ...line]) truth[c] = sol.val[c]
    const p = makePuzzle(truth, seeder, { kind: 'fullHouse', digitCount: N })
    const inst = {}
    mod.setParams(inst, clue, line)
    const v = violates(mod, inst, p, truth)
    if (v) { bad++; if (bad <= 5) console.log('seed-104 violation', v, 'clue', clue) }
  }
  console.log(`line, seed 104   ${allowTies ? 'ties continue' : 'ties end     '}:`, 20000, 'tests,', bad, 'violations')
  realBad += bad
}

console.log('line component:', lineBad + realBad, 'violations,', lineSilent, 'pools that never pruned')

// ---- `validate` and `update` agree on a tie ----
//
// On a line pinned to its digits, `feasibleClues` is exact: exactly one clue
// value survives, and it is the one `validate` accepts. Running that over the
// tie pool under both readings holds the two halves of the component to the
// same rule — the case where a tie right after the run decides the answer.
let agreeBad = 0
let agreeRuns = 0
for (const allowTies of [false, true]) {
  const mod = loadLine(allowTies)
  const n = 7
  const cells = Array.from({ length: n }, (_, i) => i)
  const inst = {}
  mod.setParams(inst, LINE_CLUE, cells)
  for (let iter = 0; iter < 2000; iter++) {
    const digits = makeTieLine(n)
    const truth = { [LINE_CLUE]: runWith(allowTies, digits) }
    for (let i = 0; i < n; i++) truth[i] = digits[i]
    const openClue = [...Array(N).keys()].map(i => i + 1)
    const p = makePuzzle(truth, (c, v) => (c === LINE_CLUE ? openClue : [v]), { kind: 'bare', digitCount: N })
    fixpoint(mod, inst, p)
    const kept = [...p._cand.get(LINE_CLUE)]
    const accepted = openClue.filter(k => {
      const filled = { ...truth, [LINE_CLUE]: k }
      return mod.validate(inst, makePuzzle(filled, (c, v) => [v], { kind: 'bare', digitCount: N }))
    })
    agreeRuns++
    if (kept.length !== accepted.length || accepted.some(k => !kept.includes(k))) {
      agreeBad++
      if (agreeBad <= 5) console.log('update/validate disagree on', digits.join(''), 'update kept', kept, 'validate accepts', accepted)
    }
  }
}
console.log('update/validate agreement on tied lines:', agreeRuns, 'lines,', agreeBad, 'disagreements')

// ---- Pair component ----
//
// The pair reads both ends of one line. With ties hidden the two runs share at
// most the peak on any line, so A + B <= n + 1 holds everywhere. With ties
// allowed a repeated digit can sit in both runs at once, so the rule needs a
// house — the component asks for one in `update`, and must go quiet on a bare
// line rather than prune what the line needs.

const CA = 100
const CB = 101

// line[0..8] strictly up to the peak (9 at index 3) then strictly down. From
// the left the run is 2<4<7<9 -> A = 4, from the right 1<3<5<6<8<9 -> B = 6,
// so A + B = 10 = n + 1 and the unimodal branch fires.
const mountain = [2, 4, 7, 9, 8, 6, 5, 3, 1]

function fuzzPair (label, { allowTies, kind, digitsOf, iters }) {
  const mod = pairMod
  let bad = 0
  let fired = 0
  let unimodal = 0
  for (let iter = 0; iter < iters; iter++) {
    const digits = digitsOf()
    const line = digits.map((_, i) => i)
    const truth = { [CA]: runWith(allowTies, digits), [CB]: runWith(allowTies, [...digits].reverse()) }
    for (let i = 0; i < digits.length; i++) truth[i] = digits[i]
    const p = makePuzzle(truth, seeder, { kind, digitCount: N })
    const inst = {}
    mod.setParams(inst, CA, CB, line)
    if (Math.min(...p.getCandidates(CA)) + Math.min(...p.getCandidates(CB)) === line.length + 1) unimodal++
    const before = total(p)
    const v = violates(mod, inst, p, truth)
    if (total(p) < before) fired++
    if (v) { bad++; if (bad <= 5) console.log(label, 'violation', v, 'line', digits.join('')) }
  }
  console.log(`${label}:`, iters, 'tests,', bad, 'violations,', fired, 'states pruned,', unimodal, 'unimodal firings')
  return { bad, fired, unimodal }
}

let pairBad = 0
let pairUnimodal = 0
let pairHouseFired = 0
let pairBareFired = 0
for (const allowTies of [false, true]) {
  const tag = allowTies ? 'ties continue' : 'ties end     '
  const mountainRun = fuzzPair(`pair, mountain   ${tag}`, {
    allowTies, kind: 'fullHouse', digitsOf: () => mountain, iters: 20000
  })
  const houseRun = fuzzPair(`pair, house      ${tag}`, {
    allowTies, kind: 'house', digitsOf: () => makeLine(rnd, 'house', 6, N), iters: 10000
  })
  const bareRun = fuzzPair(`pair, bare, tied ${tag}`, {
    allowTies, kind: 'bare', digitsOf: () => makeTieLine(7), iters: 10000
  })
  pairBad += mountainRun.bad + houseRun.bad + bareRun.bad
  pairUnimodal += mountainRun.unimodal
  pairHouseFired += mountainRun.fired + houseRun.fired
  pairBareFired += bareRun.fired
}
console.log('pair component:', pairBad, 'violations,', pairUnimodal, 'unimodal firings')

// The pair's house gate, stated as behaviour rather than read off the source:
// it must prune on a house and prune nothing at all on a bare line, under
// either reading of the run. Dropping the gate turns the bare figure positive
// and the violation count with it.
console.log('pair gate: pruned', pairHouseFired, 'house states,', pairBareFired, 'bare states')

const ok = lineBad === 0 && realBad === 0 && lineSilent === 0 && agreeBad === 0 && agreeRuns > 0 &&
  pairBad === 0 && pairUnimodal > 0 &&
  pairHouseFired > 0 && pairBareFired === 0
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
