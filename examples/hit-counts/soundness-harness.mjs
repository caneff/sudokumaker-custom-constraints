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
// A second pass runs the component over real grids, where both clues of a line
// are true together, and a third names the mirrored-pair exclusion by running
// one state as a house and again as bare.

import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { installGlobals, makeIo, makeRng, makeLine, makePuzzle, violates } from '../_shared/harness-lib.mjs'
import { frameGeometry } from '../_shared/frame-geometry.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
const { rnd } = makeRng()

installGlobals(0, 9)

const joint = load('HitCountsJointComponent.js', ['setParams', 'update', 'initialize', 'validate'])
const mod = load('HitCountsComponent.js', ['setParams', 'update', 'initialize', 'validate'])
const sideMod = load('SideSumComponent.js', ['setParams', 'update'])

// A random candidate seed keeping the true value. `hi` bounds the range: line
// cells use 1..n, a clue cell uses 0..n (it can be 0).
function seeder (lo, hi) {
  return (c, v) => {
    const mode = [1, 2, 3][(rnd() * 3) | 0]
    if (mode === 1) return [v] // pinned
    const s = new Set([v])
    for (let d = lo; d <= hi; d++) if (rnd() < 0.5) s.add(d) // subset keeping truth
    return [...s]
  }
}

const A = 100
const B = 101
const hits = line => line.reduce((k, x, i) => k + (x === i + 1 ? 1 : 0), 0)
const rev = a => a.slice().reverse()

// One line-kind fuzz. `kind` is what the mock answers for
// `getCellsCanHaveRepeats`, declared per case and never inferred from the
// digits. Both clues of the line are true together, which is what the joint
// component reads.
function fuzzLines (label, { kind, lines, lo, hi, clueHi, iters }) {
  let tests = 0
  let bad = 0
  let fired = 0
  const seen = new Set()
  for (let iter = 0; iter < iters; iter++) {
    const line = lines[iter % lines.length]
    const cells = line.map((_, i) => i)
    const truth = { [A]: hits(line), [B]: hits(rev(line)) }
    seen.add(truth[A])
    for (let i = 0; i < line.length; i++) truth[i] = line[i]
    const lineSeed = seeder(lo, hi)
    const clueSeed = seeder(0, clueHi)
    const p = makePuzzle(truth, (c, v) => (c === A || c === B ? clueSeed : lineSeed)(c, v), { kind, digitCount: 9 })
    const total = () => [...p._cand.values()].reduce((s, x) => s + x.size, 0)
    const before = total()
    const inst = {}
    joint.setParams(inst, A, B, cells)
    Array.from(joint.initialize(inst, p))
    const v = violates(joint, inst, p, truth)
    tests++
    if (total() < before) fired++
    if (v) { bad++; if (bad <= 5) console.log(label, 'violation', v, 'line', line.join('')) }
  }
  console.log(`${label}:`, tests, 'tests,', bad, 'violations,', fired, 'states pruned')
  return { bad, fired, seen }
}

// ---- full house: a permutation of 1..9, plus the two forced extremes ----
const fullLines = [[1, 2, 3, 4, 5, 6, 7, 8, 9], [2, 3, 4, 5, 6, 7, 8, 9, 1]] // identity (9), derangement (0)
for (let i = 0; i < 400; i++) fullLines.push(makeLine(rnd, 'fullHouse', 9, 9))
const full = fuzzLines('joint line, full house', { kind: 'fullHouse', lines: fullLines, lo: 1, hi: 9, clueHi: 9, iters: 40000 })
console.log('clue values exercised:', [...full.seen].sort((a, b) => a - b).join(' '))

// ---- bare: an author-drawn line, digits may repeat and n - 1 hits is legal ----
const bareLines = [[1, 2, 3, 4, 5, 6, 7, 8, 1]] // eight hits on nine cells: clue 8 = n - 1
for (let i = 0; i < 400; i++) bareLines.push(makeLine(rnd, 'bare', 9, 9))
const bare = fuzzLines('joint line, bare      ', { kind: 'bare', lines: bareLines, lo: 1, hi: 9, clueHi: 9, iters: 40000 })

// ---- house: six distinct digits out of nine, so n - 1 hits is legal ----
const houseLines = [[1, 2, 3, 4, 5, 9]] // five hits on six cells: clue 5 = n - 1
for (let i = 0; i < 400; i++) houseLines.push(makeLine(rnd, 'house', 6, 9))
const house = fuzzLines('joint line, house     ', { kind: 'house', lines: houseLines, lo: 1, hi: 9, clueHi: 9, iters: 40000 })

// ---- minDigit 0: a nine-cell house of {0..8}, all different but not {1..9} ----
// The board runs minDigit 0 for the clue ring. A line whose live digits are
// {0..8} passes the full-house count (nine digits over nine cells) yet can hit
// n - 1 times, so the no-n-1 rule must check the digit set itself. The sweep
// must also read a 0 as an ordinary miss, not as a cell with no case open.
const zeroLines = [[1, 2, 3, 4, 5, 6, 7, 8, 0]] // eight hits: clue 8 = n - 1
for (let i = 0; i < 400; i++) {
  zeroLines.push(makeLine(rnd, 'fullHouse', 9, 9).map(d => d - 1)) // a permutation of 0..8
}
const zero = fuzzLines('joint line, {0..8}    ', { kind: 'fullHouse', lines: zeroLines, lo: 0, hi: 8, clueHi: 8, iters: 40000 })

// ---- the per-line component on the same pools ----
// A drawn line with no clue at its far end keeps this component, so it meets
// the same four pools: the count bounds are bare, the no-n-1 rule is gated.
function fuzzLine (label, { kind, lines, lo, hi, clueHi, iters }) {
  let tests = 0
  let bad = 0
  let prunes = 0
  const CLUE = 102
  for (let iter = 0; iter < iters; iter++) {
    const line = lines[iter % lines.length]
    const cells = line.map((_, i) => i)
    const clueVal = hits(line)
    const truth = { [CLUE]: clueVal }
    for (let i = 0; i < line.length; i++) truth[i] = line[i]
    const lineSeed = seeder(lo, hi)
    const clueSeed = seeder(0, clueHi)
    const p = makePuzzle(truth, (c, v) => (c === CLUE ? clueSeed : lineSeed)(c, v), { kind, digitCount: 9 })
    const inst = {}
    mod.setParams(inst, CLUE, cells)
    const nMinus1 = line.length - 1
    // Bracket `initialize` alone: it runs the no-n-1 rule and nothing else, so
    // this counts that rule's firings. Over the whole fixpoint the bare count
    // bounds also take n - 1 in plenty of states, which says nothing about the
    // gate.
    const had = p.getCandidates(CLUE).has(nMinus1)
    Array.from(mod.initialize(inst, p))
    if (had && !p.getCandidates(CLUE).has(nMinus1)) prunes++
    const v = violates(mod, inst, p, truth)
    tests++
    if (v) { bad++; if (bad <= 5) console.log(label, 'violation', v, 'line', line.join('')) }
  }
  console.log(`${label}:`, tests, 'tests,', bad, 'violations,', prunes, 'n-1 prunes')
  return { bad, prunes }
}

const lineFull = fuzzLine('line, full house', { kind: 'fullHouse', lines: fullLines, lo: 1, hi: 9, clueHi: 9, iters: 40000 })
const lineBare = fuzzLine('line, bare      ', { kind: 'bare', lines: bareLines, lo: 1, hi: 9, clueHi: 9, iters: 40000 })
const lineHouse = fuzzLine('line, house     ', { kind: 'house', lines: houseLines, lo: 1, hi: 9, clueHi: 9, iters: 40000 })
const lineZero = fuzzLine('line, {0..8}    ', { kind: 'fullHouse', lines: zeroLines, lo: 0, hi: 8, clueHi: 8, iters: 40000 })

// ---- Joint component, house lines: real grids, both clues of every line ----
// The line pools above give one line at a time. A real grid gives every line of
// a board at once, over the three shipped sizes and band/stack shuffles of them,
// which keep a grid valid while moving every hit.
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]] } return a }

// Digit relabelling would not be safe here: a hit compares a digit to a
// position, so relabelling changes the rule, not just the grid.
function reshuffle (grid, bh, bw) {
  const n = grid.length
  const rowOrder = []
  for (let b = 0; b < n; b += bh) rowOrder.push(shuffle(Array.from({ length: bh }, (_, k) => b + k)))
  const colOrder = []
  for (let b = 0; b < n; b += bw) colOrder.push(shuffle(Array.from({ length: bw }, (_, k) => b + k)))
  const rows = shuffle(rowOrder).flat()
  const cols = shuffle(colOrder).flat()
  return rows.map(r => cols.map(c => grid[r][c]))
}

const ITERS = 4000
let gTests = 0
let gBad = 0
let gFired = 0
for (const file of ['gen_4x4.json', 'gen_6x6.json', 'gen_9x9.json']) {
  const gen = JSON.parse(readFileSync(join(HERE, file), 'utf8'))
  const { n, box: [bh, bw] } = gen
  const { interior, clueCell, lineCells, keys } = frameGeometry(n, [bh, bw])
  const clueCells = new Set(keys.map(k => clueCell(k[0], +k.slice(1))))
  for (let iter = 0; iter < ITERS; iter++) {
    const grid = iter === 0 ? gen.grid : reshuffle(gen.grid, bh, bw)
    const truth = {}
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) truth[interior(r, c)] = grid[r][c]
    for (const k of keys) {
      const side = k[0]; const i = +k.slice(1)
      truth[clueCell(side, i)] = hits(lineCells(side, i).map(c => truth[c]))
    }
    const lineSeed = seeder(1, n)
    const clueSeed = seeder(0, n)
    const p = makePuzzle(truth, (c, v) => (clueCells.has(c) ? clueSeed : lineSeed)(c, v), { kind: 'fullHouse', digitCount: n })
    const total = () => [...Object.keys(truth)].reduce((s, c) => s + p.getCandidates(+c).size, 0)
    const before = total()
    for (const [sa, sb] of [['L', 'R'], ['T', 'B']]) {
      for (let i = 0; i < n; i++) {
        const inst = {}
        joint.setParams(inst, clueCell(sa, i), clueCell(sb, i), lineCells(sa, i))
        Array.from(joint.initialize(inst, p))
        const v = violates(joint, inst, p, truth)
        gTests++
        if (v) { gBad++; if (gBad <= 5) console.log('JOINT grid violation', file, sa + i, v) }
      }
    }
    if (total() < before) gFired++
  }
}
console.log('joint, whole grids:', gTests, 'tests,', gBad, 'violations,', gFired, 'states pruned')

// ---- The mirrored-pair exclusion fires, and only on a house ----
// The counters above show that SOMETHING pruned; this one names the rule. It
// runs the same random state twice — once declared a full house, once bare —
// and counts the states where the house run removed strictly more. The kind
// gates two rules, so the clue seeds drop n - 1 up front: with that value gone
// the no-n-1 rule can never fire, and the only difference left between the two
// runs is the mirrored-pair exclusion.
let exTests = 0
let exFired = 0
let exBad = 0
for (let iter = 0; iter < 20000; iter++) {
  const n = 4 + ((rnd() * 6) | 0) // 4..9
  const perm = makeLine(rnd, 'fullHouse', n, n)
  const cells = Array.from({ length: n }, (_, j) => j)
  const truth = { [A]: hits(perm), [B]: hits(rev(perm)) }
  for (let j = 0; j < n; j++) truth[j] = perm[j]
  const lineSeed = seeder(1, n)
  const clueSeed = seeder(0, n)
  const draw = new Map()
  for (const c of Object.keys(truth)) {
    const isClue = +c === A || +c === B
    const set = (isClue ? clueSeed : lineSeed)(+c, truth[c])
    draw.set(+c, isClue ? set.filter(d => d !== n - 1) : set)
  }
  const run = kind => {
    const p = makePuzzle(truth, c => draw.get(c), { kind, digitCount: n })
    const inst = {}
    joint.setParams(inst, A, B, cells)
    const v = violates(joint, inst, p, truth)
    return { v, left: [...p._cand.values()].reduce((s, x) => s + x.size, 0) }
  }
  const asHouse = run('fullHouse')
  const asBare = run('bare')
  exTests++
  if (asHouse.v) { exBad++; if (exBad <= 5) console.log('EXCLUSION violation, n =', n, asHouse.v) }
  if (asHouse.left < asBare.left) exFired++
}
console.log('mirrored-pair exclusion:', exTests, 'tests,', exBad, 'violations,', exFired, 'states where the house run pruned more')

// ---- the gate re-opens once the cage removes 0 ----
// On a hit-counts board 0 is live on the inner grid at the first update and a
// cage takes it away during solving. While 0 is live the line is not a full
// house of {1..n} and the no-n-1 rule must stand down; once 0 goes, the SAME
// instance must notice and prune n - 1. n = 4, so n - 1 = 3.
const R = [0, 1, 2, 3]
const rTruth = { [A]: 0, [B]: 0, 0: 2, 1: 1, 2: 4, 3: 3 } // a derangement both ways
function gateProbe (seed) {
  const p = makePuzzle(rTruth, () => seed.slice(), { kind: 'fullHouse', digitCount: 4 })
  const inst = {}
  joint.setParams(inst, A, B, R)
  Array.from(joint.initialize(inst, p))
  return { p, inst }
}
// Five digits over four cells: not a full house at all, so the gate is shut.
const cage = gateProbe([0, 1, 2, 3, 4])
const heldWhileZeroLive = cage.p.getCandidates(A).has(3)
for (const c of R) cage.p._cand.get(c).delete(0) // the cage bites
Array.from(joint.update(cage.inst, cage.p))
const retestOk = heldWhileZeroLive && !cage.p.getCandidates(A).has(3)
console.log('minDigit 0 re-test:', retestOk ? 'OK' : `FAIL (held ${heldWhileZeroLive})`)

// ---- a full house of the wrong digit set does not lock the gate shut ----
// Four cells holding {0..3} are four digits over four cells, so the line counts
// as a full house while its digit set is still wrong. Cache the answer on the
// kind there and the gate would stay shut for good. It must keep asking: once
// the digits settle on {1..4} the same instance prunes n - 1.
const wrong = gateProbe([0, 1, 2, 3])
const heldOnWrongSet = wrong.p.getCandidates(A).has(3)
for (const c of R) { wrong.p._cand.get(c).delete(0); wrong.p._cand.get(c).add(4) }
Array.from(joint.update(wrong.inst, wrong.p))
const wrongSetOk = heldOnWrongSet && !wrong.p.getCandidates(A).has(3)
console.log('{0..n-1} full house re-test:', wrongSetOk ? 'OK' : `FAIL (held ${heldOnWrongSet})`)

// ---- validate gates on the same fact ----
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
  }, { kind, digitCount: 9 })
  const inst = {}
  joint.setParams(inst, A, B, [0, 1, 2, 3, 4, 5, 6, 7, 8])
  return joint.validate(inst, p)
}
const validateOk = validateAt('bare') === true && validateAt('fullHouse') === false
console.log('validate gate:', validateOk ? 'OK' : 'FAIL')

// ---- Side-sum component: n clues on a side sum to exactly n ----
// The proof regroups the side's hits by the perpendicular line each lands on:
// every such line holds its own digit exactly once, so it contributes one hit,
// n in all. The component therefore gets the n perpendicular lines and fires
// only while each is a full house of {1..n}.
const N = 9
const SIDE = [200, 201, 202, 203, 204, 205, 206, 207, 208]
const PERP = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => 1000 + i * N + j))
function composition () {
  const v = new Array(N).fill(0)
  for (let h = 0; h < N; h++) v[(rnd() * N) | 0]++ // drop nine hits into nine slots
  return v
}
// A Latin square: every perpendicular line holds 1..9 exactly once.
const perpValue = (i, j) => ((i + j) % N) + 1

// `sums` decides the clue truths: full-house perpendiculars come with a side
// that really does sum to N; the bare run uses clues that do not, which the
// gate must leave alone.
function fuzzSide (label, { kind, sums, iters }) {
  let tests = 0
  let bad = 0
  let fired = 0
  for (let iter = 0; iter < iters; iter++) {
    const vals = sums()
    const truth = {}
    for (let i = 0; i < N; i++) truth[SIDE[i]] = vals[i]
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) truth[PERP[i][j]] = perpValue(i, j)
    const clueSeed = seeder(0, 9)
    const p = makePuzzle(truth, (c, v) => (c >= 1000 ? [v] : clueSeed(c, v)), { kind, digitCount: 9 })
    const before = [...p._cand.values()].reduce((s, x) => s + x.size, 0)
    const inst = {}
    sideMod.setParams(inst, SIDE, N, PERP)
    const v = violates(sideMod, inst, p, truth)
    const after = [...p._cand.values()].reduce((s, x) => s + x.size, 0)
    if (after < before) fired++
    tests++
    if (v) { bad++; if (bad <= 5) console.log(label, 'violation', v, 'vals', vals.join('')) }
  }
  console.log(`${label}:`, tests, 'tests,', bad, 'violations,', fired, 'states pruned')
  return { bad, fired }
}

const sideFull = fuzzSide('side-sum, full-house perpendiculars', { kind: 'fullHouse', sums: composition, iters: 20000 })
// Bare perpendiculars: the clues need not sum to N at all, so any pruning the
// component does is unsound. It must stay silent.
const sideBare = fuzzSide('side-sum, bare perpendiculars      ', {
  kind: 'bare',
  sums: () => Array.from({ length: N }, () => 1 + ((rnd() * 9) | 0)),
  iters: 20000
})

const ok = full.bad === 0 && bare.bad === 0 && house.bad === 0 && zero.bad === 0 &&
  lineFull.bad === 0 && lineBare.bad === 0 && lineHouse.bad === 0 && lineZero.bad === 0 &&
  lineFull.prunes > 0 && lineBare.prunes === 0 && lineHouse.prunes === 0 && lineZero.prunes === 0 &&
  gBad === 0 && exBad === 0 && sideFull.bad === 0 && sideBare.bad === 0 &&
  full.fired > 0 && bare.fired > 0 && house.fired > 0 && zero.fired > 0 &&
  gFired > 0 && exFired > 0 && sideFull.fired > 0 && sideBare.fired === 0 &&
  retestOk && wrongSetOk && validateOk &&
  !full.seen.has(8) && full.seen.has(0) && full.seen.has(9)
console.log(ok ? 'PASS' : 'FAIL')
process.exit(ok ? 0 : 1)
