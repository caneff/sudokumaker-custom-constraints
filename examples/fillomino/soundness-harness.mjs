// Soundness fuzz for the fillomino component. Soundness = a component never
// removes a cell's TRUE value. We seed random partial states in which every
// cell still allows its true value, run the component to a fixpoint, and check
// the true value survived.
//
//   node examples/fillomino/soundness-harness.mjs
//
// Two fuzz fixtures:
//   shipped — the grid of gen.json, the board the example ships (size follows
//             whatever gen.json holds).
//   varied  — a second, fixed 6x6 grid, a different mix of region sizes.
// The directed checks below run on their own fixed 6x6 grid (`directed`),
// independent of gen.json — they hardcode cell indices and a 1-6 digit range
// tied to that grid's specific region layout, not to whatever ships.
//
// `update` is a dispatcher over four named rule generators (RULES below).
// Each directed check is owned by the rule that reaches it, or by the two that
// both do (SHARED), and the deletion test stubs rules out: exactly the owned
// checks must fail, so a rule that quietly stops deducing, or starts reaching
// another rule's deduction, shows here. Each rule is fuzzed alone as well.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import { installGlobals, makeIo, makeRng, makePuzzle, makeSeeder, patchSource, violates } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const { rnd } = makeRng()

const NAMES = ['setParams', 'update', 'validate', 'scan', 'islandRule', 'cutStarveRule', 'doorRules', 'componentBound', 'DEAD']
const mod = load('FillominoComponent.js', NAMES)

// The rule generators, and the directed checks only that rule reaches.
const RULES = {
  islandRule: ['seal', 'overflow', 'force'],
  cutStarveRule: ['cut starve'],
  doorRules: ['merge overflow'],
  componentBound: ['growth test']
}
// Two checks two rules reach, so removing either owner alone leaves them
// passing. Starve: a walk under k cells means the island's component of cells
// allowing k is under k too, so the component bound empties it as well. One
// door: dropping the only door starves the walk, so cut starve places it too.
const SHARED = {
  starve: ['islandRule', 'componentBound'],
  'one door': ['cutStarveRule', 'doorRules']
}

// The component with some rule generators' bodies gone: each deduces nothing
// and hands the dispatcher the verdict that lets the later rules run.
const without = (...rules) => load('FillominoComponent.js', NAMES, src => rules.reduce((out, rule) =>
  patchSource(out, `function * ${rule} (`, `function * ${rule} () { return OPEN }\nfunction * ${rule}Removed (`), src))

const gridOf = rows => {
  const n = rows.length
  const truth = {}
  rows.forEach((row, r) => [...row].forEach((ch, x) => { truth[r * n + x] = Number(ch) }))
  return { truth, n }
}

// shipped — the grid of gen.json, the board the example ships.
const shipped = gridOf(JSON.parse(readFileSync(join(HERE, 'gen.json'), 'utf8')).grid)
// varied — a second valid solution: many 1s, 2s and 3s and one 4-region.
const varied = gridOf(['121212', '323232', '313131', '323234', '121214', '333144'])

function run (truth, seed, CELLS) {
  const p = makePuzzle(truth, seed)
  const inst = {}
  mod.setParams(inst, CELLS)
  return { p, v: violates(mod, inst, p, truth) }
}

let bad = 0

// ---- Fuzz: true values survive, on both fixtures ----
const FUZZ = Number(process.env.FUZZ) || 20000
for (const [name, { truth, n }] of [['shipped', shipped], ['varied', varied]]) {
  installGlobals(1, n)
  const CELLS = Array.from({ length: n * n }, (_, i) => i)
  const ALL = Array.from({ length: n }, (_, d) => d + 1)
  // pinned, full, or a subset that keeps true
  const seed = makeSeeder(rnd, ALL)
  let fails = 0
  for (let iter = 0; iter < FUZZ; iter++) {
    const { v } = run(truth, seed, CELLS)
    if (v) { fails++; if (fails <= 5) console.log(name, 'violation', v) }
  }
  console.log('fillomino', name, `fixture: ${FUZZ} tests,`, fails, 'violations')
  bad += fails
}

// ---- Directed checks below: their own fixed 6x6 grid, not gen.json ----
const N = 6
installGlobals(1, N)
const CELLS = Array.from({ length: N * N }, (_, i) => i)
const ALL = Array.from({ length: N }, (_, d) => d + 1)
const { truth: directed } = gridOf(['554444', '553221', '353352', '335552', '225144', '133344'])
const empty = p => CELLS.some(c => p.getCandidates(c).size === 0)

// Each directed check: its name, the seed it runs `update` once on, and
// whether the puzzle after that one call shows the deduction.
const NO_SIX = ALL.filter(d => d !== 6)
const NO_FIVE = ALL.filter(d => d !== 5)
const CORRIDOR = new Set([1, 6, 7, 13, 19])
const DIRECTED = [
  // Seal (transfer doc §1): r5c0 holds 1, an island of one cell, so it is a
  // finished region. Both its orthogonal neighbours lose the candidate 1.
  ['seal', c => (c === 30 ? [1] : ALL), p => ![24, 31].some(c => p.getCandidates(c).has(1))],
  // Overflow (transfer doc §1): r0c0 and r0c1 both hold 1, one island of two
  // cells for a region of one. A dead branch: a cell is emptied so the solver
  // sees it.
  ['overflow', c => (c === 0 || c === 1 ? [1] : ALL), p => empty(p)],
  // Starve (transfer doc §3, reading b): r0c0 holds 5, and both its neighbours
  // hold another digit. The walk out of that island covers one cell, under the
  // five its region needs, so the branch is dead.
  ['starve', c => (c === 0 ? [5] : c === 1 ? [1] : c === 6 ? [2] : ALL), p => p.getCandidates(0).size === 0],
  // Force (transfer doc §2): r0c0 holds 2 and r0c1 holds 3, so the walk out of
  // the 2 reaches r1c0 and nothing more. Two cells for a region of two: the
  // walk IS the region, so r1c0 holds 2.
  ['force', c => (c === 0 ? [2] : c === 1 ? [3] : ALL), p => pinned(p, 6, 2)],
  // One door (transfer doc §3): r0c0 holds 4 and r0c1 holds 1, so r1c0 is the
  // only open cell beside that island still allowing 4. The region has to
  // grow, and that is the only way out, so r1c0 holds 4. The walk does not
  // settle this one: it runs well past four cells.
  ['one door', c => (c === 0 ? [4] : c === 1 ? [1] : ALL), p => pinned(p, 6, 4)],
  // Merge overflow (transfer doc §3): r0c0 and r0c2 both hold 2, two islands
  // of one cell. r0c1 touches both, so a 2 there would make one region of
  // three cells for a digit of two.
  ['merge overflow', c => (c === 0 || c === 2 ? [2] : ALL), p => !p.getCandidates(1).has(2)],
  // Growth test (transfer doc §6): the silent-region win. No cell on the board
  // is placed, so every rule that starts from a placed island is idle. r0c0
  // keeps every digit; its two neighbours drop 6. The cells that allow 6
  // around r0c0 are r0c0 alone, one cell for a region of six, so r0c0 cannot
  // hold 6.
  ['growth test', c => (c === 1 || c === 6 ? NO_SIX : ALL), p => !p.getCandidates(0).has(6)],
  // Cut starve (transfer doc §4): r0c0 holds 5, and the only other cells that
  // still allow 5 are r0c1, r1c0, r1c1, r2c1 and r3c1 -- a fork at r0c1/r1c0
  // that closes again at r1c1 and then runs on alone. The walk out of that
  // island covers six cells for a region of five, so the force is idle; the
  // island has two doors, so the one-door rule is idle too. Drop r1c1 from
  // the walk and it starves at three cells, drop r2c1 and it starves at four:
  // neither can be outside the region, so both hold 5. No other rule here
  // reaches either cell.
  ['cut starve', c => (c === 0 ? [5] : CORRIDOR.has(c) ? ALL : NO_FIVE), p => [7, 13].every(c => pinned(p, c, 5))]
]
const pinned = (p, c, d) => p.getCandidates(c).size === 1 && p.getCandidates(c).has(d)

// The names of the directed checks `m` fails.
function directedFailures (m) {
  return DIRECTED.filter(([, seed, shows]) => {
    const p = makePuzzle(directed, seed)
    const inst = {}
    m.setParams(inst, CELLS)
    Array.from(m.update(inst, p))
    return !shows(p)
  }).map(([name]) => name)
}

for (const name of directedFailures(mod)) { console.log(`fillomino ${name}: the deduction did not happen`); bad++ }

// ---- Deletion: removing a rule generator removes exactly its deductions ----
const deletions = [
  ...Object.entries(RULES).map(([rule, owned]) => [[rule], owned]),
  ...Object.entries(SHARED).map(([check, owners]) => [owners, [check, ...owners.flatMap(r => RULES[r])]])
]
for (const [rules, expected] of deletions) {
  const failed = directedFailures(without(...rules))
  const same = failed.length === expected.length && expected.every(name => failed.includes(name))
  console.log(`fillomino without ${rules.join(' and ')}: fails ${failed.join(', ') || 'nothing'}`)
  if (!same) { console.log(`fillomino deletion: expected exactly ${expected.join(', ')}`); bad++ }
}

// ---- Each rule alone keeps every true value ----
// A dispatcher of one: the scan and one rule. Soundness is per rule, so a rule
// that leans on another having run first shows up as a violation here.
const RULE_FUZZ = Math.ceil(FUZZ / 10)
for (const rule of Object.keys(RULES)) {
  const solo = {
    setParams: mod.setParams,
    * update (inst, p) {
      if (rule === 'componentBound') { yield * mod.componentBound(inst, p); return }
      for (const island of mod.scan(inst, p)) {
        if ((yield * mod[rule](inst, p, island)) === mod.DEAD) return
      }
    }
  }
  for (const [name, { truth, n }] of [['shipped', shipped], ['varied', varied]]) {
    installGlobals(1, n)
    const RCELLS = Array.from({ length: n * n }, (_, i) => i)
    const seed = makeSeeder(rnd, Array.from({ length: n }, (_, d) => d + 1))
    let fails = 0
    for (let iter = 0; iter < RULE_FUZZ; iter++) {
      const p = makePuzzle(truth, seed)
      const inst = {}
      solo.setParams(inst, RCELLS)
      const v = violates(solo, inst, p, truth)
      if (v) { fails++; if (fails <= 5) console.log(rule, name, 'violation', v) }
    }
    console.log(`fillomino ${rule} alone, ${name}:`, RULE_FUZZ, 'tests,', fails, 'violations')
    bad += fails
  }
  installGlobals(1, N)
}

// ---- validate (transfer doc §9): the leaf check. Every same-digit component
// of a full grid must hold as many cells as its digit. ----
function judge (truth) {
  const p = makePuzzle(truth, (c, v) => [v])
  const inst = {}
  mod.setParams(inst, CELLS)
  return mod.validate(inst, p)
}
if (!judge(directed)) { console.log('fillomino validate: rejected a real solution'); bad++ }
// r0c0 turned from 5 to 1: the 1 stands alone and passes, but its 5-region is
// now four cells for a digit of five.
if (judge({ ...directed, 0: 1 })) { console.log('fillomino validate: accepted a broken grid'); bad++ }
// A partly filled grid is not judged yet.
const partial = makePuzzle(directed, (c, v) => (c === 0 ? ALL : [v]))
const partialInst = {}
mod.setParams(partialInst, CELLS)
if (!mod.validate(partialInst, partial)) { console.log('fillomino validate: judged an unfilled grid'); bad++ }

console.log('fillomino soundness-harness:', bad, 'failures')
process.exit(bad ? 1 : 0)
