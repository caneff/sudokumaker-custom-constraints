// The line component's `ALLOW_TIES` constant (docs/line-contract.md) is
// patched both ways, and each reading meets bare, house and full-house lines
// plus a bare pool that ties right after the run -- the state the break rule
// reads.
//
// The pair also gets a synthetic mountain line: no line in the seed-104
// puzzle reaches the A + B === n + 1 case that drives its unimodal branch.

import {
  TIES_FLAG, installGlobals, makeIo, makeRng, makeLine, makePuzzle, makeSeeder, housesOf, patchSource, fixpoint, fuzzSoundness, finishHarness
} from '../_shared/harness-lib.mjs'

const HERE = import.meta.dirname
const { read, load } = makeIo(HERE)
const { rnd } = makeRng()

const N = 9
installGlobals(1, N)

const loadLine = allowTies => load('RunningStartComponent.js', ['setParams', 'update', 'validate'],
  src => patchSource(src, TIES_FLAG, `const ALLOW_TIES = ${allowTies}`))
const pairMod = load('RunningStartPairComponent.js', ['setParams', 'update', 'validate'])

// A third statement of the rule (CODING_STANDARDS.md, "The rule has one
// home"): it must agree with the component and with build_size.rs.
function runWith (allowTies, vals) {
  let k = 1
  for (let i = 1; i < vals.length; i++) {
    if (allowTies ? vals[i] >= vals[i - 1] : vals[i] > vals[i - 1]) k++
    else break
  }
  return k
}

const seeder = makeSeeder(rnd, [...Array(N).keys()].map(i => i + 1))

// A bare line that ties right after its ascending run: an ascending run, the
// last digit again, then random filler. This is the state the two descent
// rules read, and the one a pool of uniform random digits almost never draws.
function makeTieLine (n) {
  const line = []
  let v = 1 + ((rnd() * 3) | 0)
  const run = 1 + ((rnd() * 4) | 0)
  for (let i = 0; i < run; i++) { line.push(v); v += 1 + ((rnd() * 2) | 0) }
  line.push(line[line.length - 1])
  while (line.length < n) line.push(1 + ((rnd() * N) | 0))
  return line.slice(0, n)
}

const LINE_CLUE = 200

function fuzzLine (label, { allowTies, kind, n, iters, digitsOf }) {
  const mod = loadLine(allowTies)
  const cells = Array.from({ length: n }, (_, i) => i)
  return fuzzSoundness(label, {
    iters,
    draw: () => {
      const digits = digitsOf ? digitsOf(n) : makeLine(rnd, kind, n, N)
      const truth = { [LINE_CLUE]: runWith(allowTies, digits) }
      for (let i = 0; i < n; i++) truth[i] = digits[i]
      const inst = {}
      mod.setParams(inst, LINE_CLUE, cells)
      return { truth, seed: seeder, houses: housesOf(kind, cells), parts: [{ mod, inst }], note: `line ${digits.join('')}` }
    }
  })
}

let lineBad = 0
let lineSilent = 0
for (const allowTies of [false, true]) {
  const tag = allowTies ? 'ties continue' : 'ties end     '
  const pools = [
    ['bare', 7, null],
    ['house', 6, null],
    ['fullHouse', N, null],
    ['bare', 7, makeTieLine]
  ]
  for (const [kind, n, digitsOf] of pools) {
    const name = digitsOf ? 'bare, tied' : kind
    const r = fuzzLine(`line, ${name.padEnd(10)} ${tag}`, { allowTies, kind, n, iters: 20000, digitsOf })
    lineBad += r.failures
    if (r.fired === 0) lineSilent++
  }
}
const sol = JSON.parse(read('seed104_solution.json'))
let realBad = 0
for (const allowTies of [false, true]) {
  const mod = loadLine(allowTies)
  const r = fuzzSoundness(`line, seed 104   ${allowTies ? 'ties continue' : 'ties end     '}`, {
    iters: 20000,
    draw: iter => {
      const [clue, line] = sol.groups[iter % sol.groups.length]
      const truth = {}
      for (const c of [clue, ...line]) truth[c] = sol.val[c]
      const inst = {}
      mod.setParams(inst, clue, line)
      return { truth, seed: seeder, houses: [line], parts: [{ mod, inst }], note: `clue ${clue}` }
    }
  })
  realBad += r.failures
}

console.log('line component:', lineBad + realBad, 'violations,', lineSilent, 'pools that never pruned')

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
    const p = makePuzzle(truth, (c, v) => (c === LINE_CLUE ? openClue : [v]))
    fixpoint(mod, inst, p)
    const kept = [...p._cand.get(LINE_CLUE)]
    const accepted = openClue.filter(k => {
      const filled = { ...truth, [LINE_CLUE]: k }
      return mod.validate(inst, makePuzzle(filled, (c, v) => [v]))
    })
    agreeRuns++
    if (kept.length !== accepted.length || accepted.some(k => !kept.includes(k))) {
      agreeBad++
      if (agreeBad <= 5) console.log('update/validate disagree on', digits.join(''), 'update kept', kept, 'validate accepts', accepted)
    }
  }
}
console.log('update/validate agreement on tied lines:', agreeRuns, 'lines,', agreeBad, 'disagreements')

// The pair reads both ends of one line. With ties hidden the two runs share at
// most the peak on any line, so A + B <= n + 1 holds everywhere. With ties
// allowed a repeated digit can sit in both runs at once, so the rule needs a
// house — the component asks for one in `update`, and must go quiet on a bare
// line rather than prune what the line needs.

const CA = 100
const CB = 101

const mountain = [2, 4, 7, 9, 8, 6, 5, 3, 1]

function fuzzPair (label, { allowTies, kind, digitsOf, iters }) {
  const mod = pairMod
  let unimodal = 0
  const r = fuzzSoundness(label, {
    iters,
    draw: () => {
      const digits = digitsOf()
      const line = digits.map((_, i) => i)
      const truth = { [CA]: runWith(allowTies, digits), [CB]: runWith(allowTies, [...digits].reverse()) }
      for (let i = 0; i < digits.length; i++) truth[i] = digits[i]
      const inst = {}
      mod.setParams(inst, CA, CB, line)
      return {
        truth,
        seed: seeder,
        houses: housesOf(kind, line),
        parts: [{ mod, inst }],
        note: `line ${digits.join('')}`,
        inspect: p => { if (Math.min(...p.getCandidates(CA)) + Math.min(...p.getCandidates(CB)) === line.length + 1) unimodal++ }
      }
    }
  })
  return { ...r, unimodal }
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
  pairBad += [mountainRun, houseRun, bareRun].reduce((n, r) => n + r.failures, 0)
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
finishHarness(ok)
