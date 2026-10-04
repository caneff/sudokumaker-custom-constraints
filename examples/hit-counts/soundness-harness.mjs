// Soundness fuzz for the Hit Counts components. Soundness = a component never
// removes a cell's TRUE value. We seed random partial states in which every cell
// still allows its true value, run the component to a fixpoint, and check the
// true value survived. A removed true value is a bug that can make a real puzzle
// unsolvable.
//
//   node examples/hit-counts/soundness-harness.mjs
//
// Both line components are fuzzed on all three line kinds (docs/line-contract.md):
// a bare line an author drew, a house, and a full house. The hit sweep is sound
// on every kind; the mirrored-pair exclusion needs a house, and the no-n-1 rule
// needs a full house whose digit set is {1..n}. So each pool carries a line
// whose true clue IS n - 1 — on a bare line, on a house, and on a nine-cell
// house of {0..8}. Ungated, the rule removes that true clue value and the run
// goes red.
//
// A second pass runs the pair components and the side hit matching over real grids, where both clues of a
// line are true together, all to one fixpoint as the solver runs them, and a
// third names the mirrored-pair exclusion by running one state as a house and
// again as bare.
//
// The side hit matching reads a whole side at once, so its corpus is whole
// grids only. Run after the pair components it sees only states they have already
// narrowed, so it is fuzzed on freshly seeded grids by itself as well. It
// forces hits as well as forbidding them, which is why it gets its own gate
// probe: while the clue ring's 0 is still live on the inner grid a
// position is not a house of 1..n, and a component that pruned there would take
// true values out.

import { readFileSync } from 'fs'
import { join } from 'path'
import { installGlobals, makeIo, makeRng, makeLine, makePuzzle, makeSeeder, housesOf, patchSource, shuffle, total, fixpoint, fixpointAll, violates, fuzzSoundness, makeWaker, finishHarness } from '../_shared/harness-lib.mjs'
import { frameGeometry } from '../_shared/frame-geometry.mjs'
import { CLUES, cell, LINES, CANDS, TRUTH, HOUSES } from './fixture.mjs'

const HERE = import.meta.dirname
const { load, loadAt } = makeIo(HERE)
// The pair component with the case sweep alone, before the permutation sweep.
// It is the floor that sweep's coverage counter measures against.
const CASE_SWEEP_COMMIT = '4cc09eb'
const { rnd } = makeRng()

installGlobals(0, 9)

const pairComp = load('HitCountsPairComponent.js', ['setParams', 'update', 'validate'])
const mod = load('HitCountsComponent.js', ['setParams', 'update', 'noNMinusOne', 'validate'])
const SIDE_NAMES = ['getAffectedCells', 'setParams', 'update']
const sideMod = load('SideSumComponent.js', SIDE_NAMES)
const matchMod = load('SideHitMatchingComponent.js', ['setParams', 'update', 'validate'])

const seeder = (lo, hi) => makeSeeder(rnd, Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), ['pin', 'subset', 'subset'])

const A = 100
const B = 101
const hits = line => line.reduce((k, x, i) => k + (x === i + 1 ? 1 : 0), 0)
const rev = a => a.slice().reverse()

// One line-kind fuzz. `kind` declares the line's houses, which is what the mock
// answers `getCellsCanHaveRepeats` from, per case and never inferred from the
// digits. Both clues of the line are true together, which is what the pair
// component reads.
function fuzzLines (label, { kind, lines, lo, hi, clueHi, iters }) {
  const seen = new Set()
  const r = fuzzSoundness(label, {
    iters,
    draw: iter => {
      const line = lines[iter % lines.length]
      const cells = line.map((_, i) => i)
      const truth = { [A]: hits(line), [B]: hits(rev(line)) }
      seen.add(truth[A])
      for (let i = 0; i < line.length; i++) truth[i] = line[i]
      const lineSeed = seeder(lo, hi)
      const clueSeed = seeder(0, clueHi)
      const inst = { cells: [A, B, ...cells] }
      pairComp.setParams(inst, A, B, cells)
      return {
        truth,
        seed: (c, v) => (c === A || c === B ? clueSeed : lineSeed)(c, v),
        houses: housesOf(kind, cells),
        parts: [{ mod: pairComp, inst }],
        note: `line ${line.join('')}`
      }
    }
  })
  return { ...r, seen }
}

const fullLines = [[1, 2, 3, 4, 5, 6, 7, 8, 9], [2, 3, 4, 5, 6, 7, 8, 9, 1]] // identity (9), derangement (0)
for (let i = 0; i < 400; i++) fullLines.push(makeLine(rnd, 'fullHouse', 9, 9))
const full = fuzzLines('pair line, full house', { kind: 'fullHouse', lines: fullLines, lo: 1, hi: 9, clueHi: 9, iters: 40000 })
console.log('clue values exercised:', [...full.seen].sort((a, b) => a - b).join(' '))

const bareLines = [[1, 2, 3, 4, 5, 6, 7, 8, 1]] // eight hits on nine cells: clue 8 = n - 1
for (let i = 0; i < 400; i++) bareLines.push(makeLine(rnd, 'bare', 9, 9))
const bare = fuzzLines('pair line, bare      ', { kind: 'bare', lines: bareLines, lo: 1, hi: 9, clueHi: 9, iters: 40000 })

const houseLines = [[1, 2, 3, 4, 5, 9]] // five hits on six cells: clue 5 = n - 1
for (let i = 0; i < 400; i++) houseLines.push(makeLine(rnd, 'house', 6, 9))
const house = fuzzLines('pair line, house     ', { kind: 'house', lines: houseLines, lo: 1, hi: 9, clueHi: 9, iters: 40000 })

// The board runs minDigit 0 for the clue ring. A line whose live digits are
// {0..8} passes the full-house count (nine digits over nine cells) yet can hit
// n - 1 times, so the no-n-1 rule must check the digit set itself. The sweep
// must also read a 0 as an ordinary miss, not as a cell with no case open.
const zeroLines = [[1, 2, 3, 4, 5, 6, 7, 8, 0]] // eight hits: clue 8 = n - 1
for (let i = 0; i < 400; i++) {
  zeroLines.push(makeLine(rnd, 'fullHouse', 9, 9).map(d => d - 1))
}
const zero = fuzzLines('pair line, {0..8}    ', { kind: 'fullHouse', lines: zeroLines, lo: 0, hi: 8, clueHi: 8, iters: 40000 })

// A drawn line with no clue at its far end keeps this component, so it meets
// the same four pools: the count bounds are bare, the no-n-1 rule is gated.
function fuzzLine (label, { kind, lines, lo, hi, clueHi, iters }) {
  let prunes = 0
  const CLUE = 102
  const r = fuzzSoundness(label, {
    iters,
    draw: iter => {
      const line = lines[iter % lines.length]
      const cells = line.map((_, i) => i)
      const truth = { [CLUE]: hits(line) }
      for (let i = 0; i < line.length; i++) truth[i] = line[i]
      const lineSeed = seeder(lo, hi)
      const clueSeed = seeder(0, clueHi)
      const inst = { cells: [CLUE, ...cells] }
      mod.setParams(inst, CLUE, cells)
      const nMinus1 = line.length - 1
      return {
        truth,
        seed: (c, v) => (c === CLUE ? clueSeed : lineSeed)(c, v),
        houses: housesOf(kind, cells),
        parts: [{ mod, inst }],
        note: `line ${line.join('')}`,
        // Bracket the no-n-1 rule alone, so this counts that rule's firings.
        // Over the whole fixpoint the bare count bounds also take n - 1 in
        // plenty of states, which says nothing about the gate.
        inspect: p => {
          const had = p.getCandidates(CLUE).has(nMinus1)
          Array.from(mod.noNMinusOne(inst, p))
          if (had && !p.getCandidates(CLUE).has(nMinus1)) prunes++
        }
      }
    }
  })
  return { ...r, prunes }
}

const lineFull = fuzzLine('line, full house', { kind: 'fullHouse', lines: fullLines, lo: 1, hi: 9, clueHi: 9, iters: 40000 })
const lineBare = fuzzLine('line, bare      ', { kind: 'bare', lines: bareLines, lo: 1, hi: 9, clueHi: 9, iters: 40000 })
const lineHouse = fuzzLine('line, house     ', { kind: 'house', lines: houseLines, lo: 1, hi: 9, clueHi: 9, iters: 40000 })
const lineZero = fuzzLine('line, {0..8}    ', { kind: 'fullHouse', lines: zeroLines, lo: 0, hi: 8, clueHi: 8, iters: 40000 })

// The line pools above give one line at a time. A real grid gives every line of
// a board at once, over the three shipped sizes and band/stack shuffles of them,
// which keep a grid valid while moving every hit.
// Digit relabelling would not be safe here: a hit compares a digit to a
// position, so relabelling changes the rule, not just the grid.
function reshuffle (grid, bh, bw) {
  const n = grid.length
  const rowOrder = []
  for (let b = 0; b < n; b += bh) rowOrder.push(shuffle(rnd, Array.from({ length: bh }, (_, k) => b + k)))
  const colOrder = []
  for (let b = 0; b < n; b += bw) colOrder.push(shuffle(rnd, Array.from({ length: bw }, (_, k) => b + k)))
  const rows = shuffle(rnd, rowOrder).flat()
  const cols = shuffle(rnd, colOrder).flat()
  return rows.map(r => cols.map(c => grid[r][c]))
}

// The whole-grid corpus: each shipped size, its committed grid first and then
// band/stack shuffles of it, every cell seeded with a random candidate superset
// that keeps its true value, and the grid's rows and columns declared as its
// houses. `pairComps` adds one pair component per pair of opposite clues and
// `sides` adds the side hit matching over each of the four sides; the parts
// chosen run together to one fixpoint, pair components first, as the solver runs them.
// The side hit matching forces hits as well as forbidding them, so an
// assignment bug takes a true value straight out.
const ITERS = 4000
function fuzzGrids (label, { pairComps, sides }) {
  const sum = { tests: 0, failures: 0, fired: 0 }
  for (const file of ['gen_4x4.json', 'gen_6x6.json', 'gen.json']) {
    const gen = JSON.parse(readFileSync(join(HERE, file), 'utf8'))
    const { n, box: [bh, bw] } = gen
    const { interior, clueCell, lineCells, keys } = frameGeometry(n, [bh, bw])
    const clueCells = new Set(keys.map(k => clueCell(k[0], +k.slice(1))))
    const houses = [
      ...Array.from({ length: n }, (_, i) => lineCells('L', i)),
      ...Array.from({ length: n }, (_, i) => lineCells('T', i))
    ]
    const r = fuzzSoundness(`${label} ${file}`, {
      iters: ITERS,
      draw: iter => {
        const grid = iter === 0 ? gen.grid : reshuffle(gen.grid, bh, bw)
        const truth = {}
        for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) truth[interior(r, c)] = grid[r][c]
        for (const k of keys) {
          const side = k[0]; const i = +k.slice(1)
          truth[clueCell(side, i)] = hits(lineCells(side, i).map(c => truth[c]))
        }
        const lineSeed = seeder(1, n)
        const clueSeed = seeder(0, n)
        const parts = []
        for (const [sa, sb] of pairComps ? [['L', 'R'], ['T', 'B']] : []) {
          for (let i = 0; i < n; i++) {
            const inst = { cells: [clueCell(sa, i), clueCell(sb, i), ...lineCells(sa, i)] }
            pairComp.setParams(inst, clueCell(sa, i), clueCell(sb, i), lineCells(sa, i))
            parts.push({ mod: pairComp, inst })
          }
        }
        for (const side of sides ? ['L', 'R', 'T', 'B'] : []) {
          const clues = Array.from({ length: n }, (_, i) => clueCell(side, i))
          const lines = Array.from({ length: n }, (_, i) => lineCells(side, i))
          const inst = { cells: [...clues, ...lines.flat()] }
          matchMod.setParams(inst, clues, lines)
          parts.push({ mod: matchMod, inst })
        }
        return { truth, seed: (c, v) => (clueCells.has(c) ? clueSeed : lineSeed)(c, v), houses, parts, note: `${file} iter ${iter}` }
      }
    })
    sum.tests += r.tests
    sum.failures += r.failures
    sum.fired += r.fired
  }
  return sum
}
const grids = fuzzGrids('pair and side hit matching, whole grids', { pairComps: true, sides: true })
console.log('pair and side hit matching, whole grids:', grids.tests, 'tests,', grids.failures, 'failures,', grids.fired, 'states pruned')
const sideGrids = fuzzGrids('side hit matching alone, whole grids', { pairComps: false, sides: true })
console.log('side hit matching alone, whole grids:', sideGrids.tests, 'tests,', sideGrids.failures, 'failures,', sideGrids.fired, 'states pruned')

// A state run by the component under test, set against a rival's leftover
// candidates on the same state: `draw` also returns `rivalLeft`, the total the
// rival leaves, and `beaten` counts the states where the component left less.
function fuzzBeating (label, { iters, draw }) {
  const runs = []
  const r = fuzzSoundness(label, {
    iters,
    draw: iter => {
      const { rivalLeft, ...state } = draw(iter)
      return { ...state, inspect: p => runs.push({ p, rivalLeft }) }
    }
  })
  return { ...r, beaten: runs.filter(({ p, rivalLeft }) => total(p) < rivalLeft).length }
}

// The counters above show that SOMETHING pruned; this one names the rule. It
// runs the same random state twice — once declared a full house, once bare —
// and counts the states where the house run removed strictly more. The kind
// gates two rules, so the clue seeds drop n - 1 up front: with that value gone
// the no-n-1 rule can never fire, and the only difference left between the two
// runs is the mirrored-pair exclusion.
const exclusion = fuzzBeating('mirrored-pair exclusion', {
  iters: 20000,
  draw: () => {
    const n = 4 + ((rnd() * 6) | 0)
    const perm = makeLine(rnd, 'fullHouse', n, n)
    const cells = Array.from({ length: n }, (_, j) => j)
    const truth = { [A]: hits(perm), [B]: hits(rev(perm)) }
    for (let j = 0; j < n; j++) truth[j] = perm[j]
    const lineSeed = seeder(1, n)
    const clueSeed = seeder(0, n)
    const cands = new Map()
    for (const c of Object.keys(truth)) {
      const isClue = +c === A || +c === B
      const set = (isClue ? clueSeed : lineSeed)(+c, truth[c])
      cands.set(+c, isClue ? set.filter(d => d !== n - 1) : set)
    }
    const part = () => {
      const inst = { cells: [A, B, ...cells] }
      pairComp.setParams(inst, A, B, cells)
      return [{ mod: pairComp, inst }]
    }
    const bare = makePuzzle(truth, c => cands.get(c), { houses: housesOf('bare', cells) })
    fixpointAll(part(), bare)
    return { truth, seed: c => cands.get(c), houses: housesOf('fullHouse', cells), parts: part(), note: `n = ${n}`, rivalLeft: total(bare) }
  }
})
console.log('mirrored-pair exclusion:', exclusion.beaten, 'states where the house run pruned more')

// The counters above show the pair component pruned; this one names the
// permutation sweep, by running the same state through the component as it stands
// and through the case sweep it replaced on a full house of 1..n. Every state is
// seeded around a real permutation and its two true clues, so a state where the
// matching removed a true value is a soundness bug, not a strength win.
// The file carried a different name at the pinned commit, so the floor names its own path.
const CASE_SWEEP_REF_FILE = 'HitCountsJointComponent.js'
const caseSweep = loadAt(CASE_SWEEP_COMMIT, CASE_SWEEP_REF_FILE, ['setParams', 'update', 'validate'])
const permutation = fuzzBeating('permutation sweep', {
  iters: 20000,
  draw: () => {
    const n = 4 + ((rnd() * 6) | 0)
    const perm = makeLine(rnd, 'fullHouse', n, n)
    const cells = Array.from({ length: n }, (_, j) => j)
    const truth = { [A]: hits(perm), [B]: hits(rev(perm)) }
    for (let j = 0; j < n; j++) truth[j] = perm[j]
    const lineSeed = seeder(1, n)
    const clueSeed = seeder(0, n)
    const cands = new Map()
    for (const c of Object.keys(truth)) {
      const isClue = +c === A || +c === B
      cands.set(+c, (isClue ? clueSeed : lineSeed)(+c, truth[c]))
    }
    const part = component => {
      const inst = { cells: [A, B, ...cells] }
      component.setParams(inst, A, B, cells)
      return [{ mod: component, inst }]
    }
    const old = makePuzzle(truth, c => cands.get(c), { houses: [cells] })
    fixpointAll(part(caseSweep), old)
    return { truth, seed: c => cands.get(c), houses: [cells], parts: part(pairComp), note: `n = ${n}`, rivalLeft: total(old) }
  }
})
console.log('permutation sweep:', permutation.beaten, 'states where the permutation sweep pruned more')

// On a hit-counts board 0 is live on the inner grid at the first update and a
// cage takes it away during solving. While 0 is live the line is not a full
// house of {1..n} and the no-n-1 rule must stand down; once 0 goes, the SAME
// instance must notice and prune n - 1. n = 4, so n - 1 = 3.
const R = [0, 1, 2, 3]
const rTruth = { [A]: 0, [B]: 0, 0: 2, 1: 1, 2: 4, 3: 3 } // a derangement both ways
function gateProbe (seed) {
  const p = makePuzzle(rTruth, () => seed.slice(), { houses: [R] })
  const inst = {}
  pairComp.setParams(inst, A, B, R)
  Array.from(pairComp.update(inst, p)) // the load pass: the base initialize runs update once
  return { p, inst }
}
// Five digits over four cells: not a full house at all, so the gate is shut.
const cage = gateProbe([0, 1, 2, 3, 4])
const heldWhileZeroLive = cage.p.getCandidates(A).has(3)
for (const c of R) cage.p._cand.get(c).delete(0) // the cage bites
Array.from(pairComp.update(cage.inst, cage.p))
const retestOk = heldWhileZeroLive && !cage.p.getCandidates(A).has(3)
console.log('minDigit 0 re-test:', retestOk ? 'OK' : `FAIL (held ${heldWhileZeroLive})`)

// Four cells holding {0..3} are four digits over four cells, so the line counts
// as a full house while its digit set is still wrong. Cache the answer on the
// kind there and the gate would stay shut for good. It must keep asking: once
// the digits settle on {1..4} the same instance prunes n - 1.
const wrong = gateProbe([0, 1, 2, 3])
const heldOnWrongSet = wrong.p.getCandidates(A).has(3)
for (const c of R) { wrong.p._cand.get(c).delete(0); wrong.p._cand.get(c).add(4) }
Array.from(pairComp.update(wrong.inst, wrong.p))
const wrongSetOk = heldOnWrongSet && !wrong.p.getCandidates(A).has(3)
console.log('{0..n-1} full house re-test:', wrongSetOk ? 'OK' : `FAIL (held ${heldOnWrongSet})`)

// The app shares one component object across every search node, so a fact
// written on `instance` deep in a branch is still there when the search returns
// to the parent state -- where a union that was {1..n} has regained digits.
// n = 4 here and the true line is (1,2,3,9): clue A is 3 = n - 1, legal because
// the line is not a permutation of 1..4. Latch `oneToN` in the deep state and
// the no-n-1 rule takes that true value out of the parent.
const LATCH = [0, 1, 2, 3]
const lTruth = { [A]: 3, [B]: 0, 0: 1, 1: 2, 2: 3, 3: 9 }
const latchState = fill => makePuzzle(lTruth, c => (c === A || c === B ? [0, 1, 2, 3, 4] : fill), { houses: [LATCH] })
function latchProbe (component, params) {
  const inst = {}
  component.setParams(inst, ...params)
  Array.from(component.update(inst, latchState([1, 2, 3, 4]))) // deep node: the union is exactly {1..4}
  return violates(component, inst, latchState([1, 2, 3, 4, 5, 6, 7, 8, 9]), lTruth) // the parent it backtracks to
}
const latchPair = latchProbe(pairComp, [A, B, LATCH])
const latchLine = latchProbe(mod, [A, LATCH])
const latchOk = latchPair === null && latchLine === null
console.log('backtrack re-test:', latchOk ? 'OK' : `FAIL (pair ${JSON.stringify(latchPair)}, line ${JSON.stringify(latchLine)})`)

// A clue of n - 1 is illegal only on a full house of {1..n}. On a bare line it
// is a legal state and validate must accept it.
function validateAt (kind) {
  const truth = { [A]: 8, [B]: 0 }
  for (let i = 0; i < 9; i++) truth[i] = i + 1
  // The line's live digits are exactly {1..9}; clue B stays open so the line is
  // not filled, which is what puts the reject on the gate rather than on the
  // exact hit count.
  const line = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const p = makePuzzle(truth, c => {
    if (c === A) return [8]
    if (c === B) return [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
    return line
  }, { houses: housesOf(kind, [0, 1, 2, 3, 4, 5, 6, 7, 8]) })
  const inst = { cells: [A, B, 0, 1, 2, 3, 4, 5, 6, 7, 8] }
  pairComp.setParams(inst, A, B, [0, 1, 2, 3, 4, 5, 6, 7, 8])
  return pairComp.validate(inst, p)
}
const validateOk = validateAt('bare') === true && validateAt('fullHouse') === false
console.log('validate gate:', validateOk ? 'OK' : 'FAIL')

// The assignment needs each position to be a house holding 1..n exactly once.
// A hit-counts board runs minDigit 0 for its clue ring, so until the cage takes
// the 0 off the inner grid a position holds {0..n} and the component must stay
// silent. Once 0 goes the SAME instance must notice and prune -- and when a
// backtrack puts the 0 back, it must stand down again. That last leg is why the
// digit-set half of the gate is not cached: this component forces placements, so
// a gate held open over a restored 0 would put a digit in a cell that need not
// hold it.
//
// The side below is the one shape that pins the matching outright; it lives in
// fixture.mjs, shared with the other hit-counts tests. A 0 read as anything
// but an ordinary miss would change its answer.
function sideGateProbe (withZero) {
  const truth = {}
  for (const c of CLUES) truth[c] = 1
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) truth[cell(r, c)] = TRUTH[r][c]
  const p = makePuzzle(truth, c => (c >= 400 ? [1] : CANDS[(c / 4) | 0][c % 4].concat(withZero ? [0] : [])),
    { houses: HOUSES })
  const inst = {}
  matchMod.setParams(inst, CLUES, LINES)
  return { p, inst, v: violates(matchMod, inst, p, truth) }
}
const zeroLive = sideGateProbe(true)
const gateShut = [0, 1, 2, 3].every(i => zeroLive.p.getCandidates(cell(i, i)).size > 1)
for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) zeroLive.p._cand.get(cell(r, c)).delete(0) // the cage bites
fixpoint(matchMod, zeroLive.inst, zeroLive.p)
const gateOpened = [0, 1, 2, 3].every(i => zeroLive.p.getCandidates(cell(i, i)).size === 1)
// A backtrack: the state goes back to where it was and the 0 comes back with
// it. The same instance must forget it ever opened.
const undone = sideGateProbe(true)
Array.from(matchMod.update(undone.inst, undone.p))
for (const c of LINES.flat()) undone.p._cand.get(c).delete(0)
fixpoint(matchMod, undone.inst, undone.p)
for (const c of LINES.flat()) undone.p._cand.set(c, new Set(CANDS[(c / 4) | 0][c % 4].concat([0])))
Array.from(matchMod.update(undone.inst, undone.p))
const gateReshut = LINES.flat().every(c => undone.p._cand.get(c).has(0))
const sideGateOk = gateShut && gateOpened && gateReshut && !zeroLive.v && !sideGateProbe(false).v
console.log('side hit matching, minDigit 0 gate:', sideGateOk ? 'OK' : `FAIL (shut ${gateShut}, reopened ${gateOpened}, re-shut ${gateReshut})`)

// Once the whole side is filled every line must realise its own clue exactly.
// The grid above hits once per line, so clues of 1 are right and anything else
// is not; a side still holding an open cell is not yet judged either way.
function sideValidate (clueVals, openCell) {
  const truth = {}
  CLUES.forEach((c, i) => { truth[c] = clueVals[i] })
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) truth[cell(r, c)] = TRUTH[r][c]
  const p = makePuzzle(truth, (c, v) => (c === openCell ? [v, (v % 4) + 1] : [v]), { houses: HOUSES })
  const inst = { cells: [...CLUES, ...LINES.flat()] }
  matchMod.setParams(inst, CLUES, LINES)
  return matchMod.validate(inst, p)
}
const sideValidateOk = sideValidate([1, 1, 1, 1], null) === true &&
  sideValidate([1, 2, 1, 1], null) === false &&
  sideValidate([1, 2, 1, 1], cell(2, 2)) === true
console.log('side hit matching, validate:', sideValidateOk ? 'OK' : 'FAIL')

// The proof regroups the side's hits by the perpendicular line each lands on:
// every such line holds its own digit exactly once, so it contributes one hit,
// n in all. The component therefore gets the n perpendicular lines and fires
// only while each is a full house of {1..n}.
const N = 9
const SIDE = [200, 201, 202, 203, 204, 205, 206, 207, 208]
const PERP = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => 1000 + i * N + j))
function composition () {
  const v = new Array(N).fill(0)
  for (let h = 0; h < N; h++) v[(rnd() * N) | 0]++
  return v
}
const perpValue = (i, j) => ((i + j) % N) + 1

// `sums` decides the clue truths: full-house perpendiculars come with a side
// that really does sum to N; the bare run uses clues that do not, which the
// gate must leave alone.
function fuzzSide (label, { kind, sums, iters }) {
  return fuzzSoundness(label, {
    iters,
    draw: () => {
      const vals = sums()
      const truth = {}
      for (let i = 0; i < N; i++) truth[SIDE[i]] = vals[i]
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) truth[PERP[i][j]] = perpValue(i, j)
      const clueSeed = seeder(0, 9)
      const inst = {}
      sideMod.setParams(inst, SIDE, N, PERP)
      return {
        truth,
        seed: (c, v) => (c >= 1000 ? [v] : clueSeed(c, v)),
        houses: kind === 'bare' ? [] : PERP,
        parts: [{ mod: sideMod, inst }],
        note: `vals ${vals.join('')}`
      }
    }
  })
}

const sideFull = fuzzSide('side-sum, full-house perpendiculars', { kind: 'fullHouse', sums: composition, iters: 20000 })
// Bare perpendiculars: the clues need not sum to N at all, so any pruning the
// component does is unsound. It must stay silent.
const sideBare = fuzzSide('side-sum, bare perpendiculars      ', {
  kind: 'bare',
  sums: () => Array.from({ length: N }, () => 1 + ((rnd() * 9) | 0)),
  iters: 20000
})

// The gate is not cached, for the reason the line gate is not: the app shares
// one component object across every search node, so a gate latched open deep in
// a branch is still open in the parent state the search returns to -- where the
// perpendiculars have regained their 0 and the side need not sum to N at all.
const sideLatchInst = {}
sideMod.setParams(sideLatchInst, SIDE, N, PERP)
function sideSumState (vals, fill, clueSeed) {
  const truth = {}
  for (let i = 0; i < N; i++) truth[SIDE[i]] = vals[i]
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) truth[PERP[i][j]] = perpValue(i, j)
  return { truth, p: makePuzzle(truth, (c, v) => (c >= 1000 ? fill(v) : clueSeed(c, v)), { houses: PERP }) }
}
const deepSide = sideSumState(composition(), v => [v], (c, v) => [v]) // perpendiculars pinned to 1..9: the gate opens
Array.from(sideMod.update(sideLatchInst, deepSide.p))
// The parent: a 0 live on every perpendicular, so the side need not sum to N --
// and it does not, summing to 11. Eight clues are pinned to 1, so a gate still
// open forces the ninth to 1 and takes its true 3 away.
const backSide = sideSumState([3, 1, 1, 1, 1, 1, 1, 1, 1], v => [0, v], (c, v) => (c === SIDE[0] ? [0, 3] : [v]))
const sideLatchBad = violates(sideMod, sideLatchInst, backSide.p, backSide.truth)
console.log('side-sum gate after a backtrack:', sideLatchBad === null ? 'gate re-shuts' : `STAYS OPEN ${JSON.stringify(sideLatchBad)}`)

// The component can run on a line state it was never told about: the app
// restores a backtrack's candidates without waking anyone. The case: a solver
// that calls `update` only when an affected cell has lost a candidate since
// the last call. A branch opens the gate (a line cell loses its 0, which wakes
// the component, then a clue narrows), the search backtracks to a state whose
// line has its 0 again, and a clue narrows there.
// The truth has the 0 in that line, so the side need not sum to N: a gate
// still open would force the first clue to 1 and take its true 3 away.
function staleWakeRun (mod) {
  const inst = {}
  mod.setParams(inst, SIDE, N, PERP)
  const affected = mod.getAffectedCells(SIDE, N, PERP)
  const truth = {}
  const vals = [3, 1, 1, 1, 1, 1, 1, 1, 1]
  for (let i = 0; i < N; i++) truth[SIDE[i]] = vals[i]
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) truth[PERP[i][j]] = perpValue(i, j)
  truth[PERP[0][0]] = 0
  const start = c => (c === SIDE[0] ? [0, 1, 3] : c === SIDE[2] ? [1, 2] : c === PERP[0][0] ? [0, 1] : [truth[c]])
  const p = makePuzzle(truth, start, { houses: PERP })
  const { wake, settle } = makeWaker(mod, inst, p, affected)
  wake() // the root: 0 live on line 0, the gate shut
  p._cand.get(PERP[0][0]).delete(0) // branch: the line's 0 goes, woken, gate open
  wake()
  p._cand.get(SIDE[2]).delete(2) // a clue narrows in the branch: woken
  wake()
  for (const [c] of p._cand) p._cand.set(c, new Set(start(c))) // backtrack: the 0 is back, and nobody is woken
  settle()
  p._cand.get(SIDE[0]).delete(0) // a clue narrows in the parent: woken
  wake()
  return [...p._cand].find(([c, set]) => !set.has(truth[c])) || null
}
const staleWakeLost = staleWakeRun(sideMod)
// The same run against a gate that latches once open, to show the case bites.
const latchedSide = load('SideSumComponent.js', SIDE_NAMES, src => patchSource(src,
  '  for (const line of lines) if (!lineKind(instance, puzzle, line).oneToN) return false\n  return true\n',
  '  if (instance.latched) return true\n  for (const line of lines) if (!lineKind(instance, puzzle, line).oneToN) return false\n  instance.latched = true\n  return true\n'))
const staleWakeBites = staleWakeRun(latchedSide) !== null
console.log('side-sum stale wake:', staleWakeLost === null ? 'sound' : `LOST ${JSON.stringify(staleWakeLost)}`,
  '/ a latched gate:', staleWakeBites ? 'loses a true value' : 'DOES NOT BITE')

const ok = staleWakeLost === null && staleWakeBites &&
  full.failures === 0 && bare.failures === 0 && house.failures === 0 && zero.failures === 0 &&
  lineFull.failures === 0 && lineBare.failures === 0 && lineHouse.failures === 0 && lineZero.failures === 0 &&
  lineFull.prunes > 0 && lineBare.prunes === 0 && lineHouse.prunes === 0 && lineZero.prunes === 0 &&
  grids.failures === 0 && sideGrids.failures === 0 && exclusion.failures === 0 && permutation.failures === 0 && sideFull.failures === 0 && sideBare.failures === 0 &&
  full.fired > 0 && bare.fired > 0 && house.fired > 0 && zero.fired > 0 &&
  grids.fired > 0 && sideGrids.fired > 0 && exclusion.beaten > 0 && permutation.beaten > 0 && sideFull.fired > 0 && sideBare.fired === 0 &&
  retestOk && wrongSetOk && latchOk && sideLatchBad === null && validateOk && sideGateOk && sideValidateOk &&
  !full.seen.has(8) && full.seen.has(0) && full.seen.has(9)
finishHarness(ok)
