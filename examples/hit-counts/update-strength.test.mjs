// Strength checks for the Hit Counts components. Soundness (never remove a true
// value) lives in soundness-harness.mjs; this file checks the other direction —
// that a rewrite does not quietly prune LESS than before.
//
//   node examples/hit-counts/update-strength.test.mjs
//
// A line clued at both ends gets the joint component, which carries the work the
// per-line and pair components used to split between them, so its floor is
// those two run together at the commit that last shipped them: on random states
// the joint update must leave a subset of what they left, cell for cell. A line
// clued at one end keeps the per-line component, compared against itself. So is
// the side sum. One deterministic case pins the inference the joint component
// adds — a mirrored pair can never give one A hit and one B hit — which the
// pair component's count-only cap cannot reach.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import assert from 'assert'
import { installGlobals, makeIo, makeRng, makeLine, makePuzzle, fixpoint, randomCandidates, compareStrength } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load, loadAt } = makeIo(HERE)

// The floor: the components as they stand at the commit that pins this test.
const REF_COMMIT = 'db93523'
// The per-line and pair components no longer exist in the tree. This is the
// commit that last shipped them, gates and all — the strength the joint
// component has to match.
const REPLACED_COMMIT = '7b3f9af'

const { rnd } = makeRng(2024)
const randomSet = (lo, hi) => randomCandidates(rnd, lo, hi)

// Run a set of already-parameterised components to a joint fixpoint. Each entry
// is { mod, inst }; a pass drains every update, and the loop stops when a whole
// pass removes nothing.
function jointFixpoint (comps, p) {
  const total = () => { let n = 0; for (const s of p._cand.values()) n += s.size; return n }
  for (let pass = 0; pass < 20; pass++) {
    const before = total()
    for (const { mod, inst } of comps) Array.from(mod.update(inst, p))
    if (total() === before) break
  }
}

// ---- 1. HitCountsJointComponent against the per-line + pair floor ----
{
  const cur = load('HitCountsJointComponent.js', ['setParams', 'update', 'initialize'])
  const lineRef = loadAt(REPLACED_COMMIT, 'HitCountsComponent.js', ['setParams', 'update', 'initialize'])
  const pairRef = loadAt(REPLACED_COMMIT, 'HitCountsPairComponent.js', ['setParams', 'update'])
  const PA = 300
  const PB = 301

  // The joint component reads clue A's line; clue B reads the same cells from
  // the far end, so its own line is the reverse.
  const candidate = LINE => ({
    run: p => {
      const inst = {}
      cur.setParams(inst, PA, PB, LINE)
      Array.from(cur.initialize(inst, p))
      fixpoint(cur, inst, p)
    }
  })
  const floor = LINE => ({
    run: p => {
      const a = {}
      const b = {}
      const pr = {}
      lineRef.setParams(a, PA, LINE)
      lineRef.setParams(b, PB, LINE.slice().reverse())
      pairRef.setParams(pr, PA, PB, LINE)
      Array.from(lineRef.initialize(a, p))
      Array.from(lineRef.initialize(b, p))
      jointFixpoint([{ mod: lineRef, inst: a }, { mod: lineRef, inst: b }, { mod: pairRef, inst: pr }], p)
    }
  })

  // Both sides gate the no-n-1 rule on a line the component can prove holds
  // 1..m once each (docs/line-contract.md). That is the state to compare on, so
  // each line cell keeps one digit of a random permutation: the seed declares
  // the full house and every digit 1..m stays live somewhere on the line.
  let states = 0
  let weaker = 0
  for (const m of [4, 6, 9]) {
    installGlobals(0, m)
    const LINE = Array.from({ length: m }, (_, i) => 10 + i)
    const apply = (mod, p) => mod.run(p)
    for (let rep = 0; rep < 10000; rep++) {
      const perm = makeLine(rnd, 'fullHouse', m, m)
      const start = new Map()
      start.set(PA, randomSet(0, m))
      start.set(PB, randomSet(0, m))
      LINE.forEach((c, j) => start.set(c, randomCandidates(rnd, 1, m, perm[j])))
      const w = compareStrength(candidate(LINE), floor(LINE), apply, start, { kind: 'fullHouse', digitCount: m })
      if (w === null) continue
      states++
      weaker += w.length
      if (w.length > 0 && weaker <= 5) console.log('joint weaker at', w[0], 'start', [...start])
    }
  }
  console.log('hit-counts joint:', states, 'states,', weaker, 'weaker cells')
  assert.ok(states > 10000, 'the dead-state filter must leave most states to compare')
  assert.strictEqual(weaker, 0)
}

// ---- 2. HitCountsComponent: one clue over a nine-cell line ----
// A drawn line with no clue at its far end still gets this component, so it
// keeps its own floor.
{
  const NAMES = ['setParams', 'update', 'initialize']
  const cur = load('HitCountsComponent.js', NAMES)
  const ref = loadAt(REF_COMMIT, 'HitCountsComponent.js', NAMES)
  const CLUE = 100
  const LINE = [0, 1, 2, 3, 4, 5, 6, 7, 8]
  installGlobals(0, 9)
  const apply = (mod, p) => {
    const inst = {}
    mod.setParams(inst, CLUE, LINE)
    Array.from(mod.initialize(inst, p))
    fixpoint(mod, inst, p)
  }
  // The no-n-1 rule is behind a gate: it fires only on a line the component can
  // prove is a full house of {1..9} (docs/line-contract.md). That is the state
  // to compare on, so the seed declares the full house and every digit 1..9 is
  // left live somewhere on the line.
  const OPTS = { kind: 'fullHouse', digitCount: 9 }
  const coverLine = start => {
    const live = new Set()
    for (const c of LINE) for (const d of start.get(c)) live.add(d)
    for (let d = 1; d <= 9; d++) {
      if (live.has(d)) continue
      const c = LINE[(rnd() * LINE.length) | 0]
      start.set(c, [...new Set([...start.get(c), d])])
    }
  }
  let states = 0
  let weaker = 0
  for (let rep = 0; rep < 20000; rep++) {
    const start = new Map()
    start.set(CLUE, randomSet(0, 9))
    for (const c of LINE) start.set(c, randomSet(1, 9))
    coverLine(start)
    const w = compareStrength(cur, ref, apply, start, OPTS)
    if (w === null) continue
    states++
    weaker += w.length
    if (w.length > 0 && weaker <= 5) console.log('line weaker at', w[0], 'start', [...start])
  }
  console.log('hit-counts line:', states, 'states,', weaker, 'weaker cells')
  assert.ok(states > 10000, 'the dead-state filter must leave most states to compare')
  assert.strictEqual(weaker, 0)
}

// ---- 3. The mirrored-pair exclusion, deterministic ----
// n = 4. Position j hits for clue A with digit j+1 and for clue B with digit
// 4-j, so the mirrored pair (0, 3) shares digit 1 (A at position 0, B at
// position 3) and digit 4 (B at position 0, A at position 3). On a house one
// digit cannot sit in both cells, so that pair can never give one A hit and one
// B hit.
//
// Both clues are pinned to 1. Positions 1 and 2 are pinned to digits that hit
// neither way for B (4 and 1) but can still hit for A (2 and 3), so the pair
// (1, 2) contributes 0, 1 or 2 A hits and never a B hit. B's single hit must
// therefore come from the pair (0, 3), and with one A hit already needed from
// (1, 2) that pair must give exactly one B hit and no A hit. So neither
// position 0 nor position 3 may take its A digit: digit 1 goes from position 0
// and digit 4 from position 3.
{
  installGlobals(0, 4)
  const cur = load('HitCountsJointComponent.js', ['setParams', 'update'])
  const pairRef = loadAt(REPLACED_COMMIT, 'HitCountsPairComponent.js', ['setParams', 'update'])
  const CA = 400
  const CB = 401
  const LINE = [20, 21, 22, 23]
  const start = new Map([
    [CA, [1]], [CB, [1]],
    [20, [1, 2, 4]], [21, [2, 4]], [22, [1, 3]], [23, [1, 2, 4]]
  ])
  const state = () => {
    const cells = {}
    for (const c of start.keys()) cells[c] = 0
    return makePuzzle(cells, c => start.get(c), { kind: 'fullHouse', digitCount: 4 })
  }

  const pj = state()
  const ij = {}
  cur.setParams(ij, CA, CB, LINE)
  fixpoint(cur, ij, pj)

  const pp = state()
  const ip = {}
  pairRef.setParams(ip, CA, CB, LINE)
  fixpoint(pairRef, ip, pp)

  const show = (p, c) => [...p._cand.get(c)].sort((x, y) => x - y)
  assert.deepStrictEqual(show(pj, 20), [2, 4], 'joint drops the A hit at position 0')
  assert.deepStrictEqual(show(pj, 23), [1, 2], 'joint drops the A hit at position 3')
  assert.deepStrictEqual(show(pj, 21), [2, 4], 'position 1 keeps both cases')
  assert.deepStrictEqual(show(pj, 22), [1, 3], 'position 2 keeps both cases')
  for (const c of start.keys()) {
    assert.deepStrictEqual(show(pp, c), start.get(c).slice().sort((x, y) => x - y),
      'the pair component reaches this state and removes nothing')
  }
  console.log('hit-counts mirrored pair: joint removes 2 candidates, the pair component 0')
}

// ---- 3b. A forced side hit the per-line scan misses, deterministic ----
// A 4x4 left side: four rows, each clued 1, so the four clues host the four
// positions between them, one line each. Position i is live on line L while
// digit i + 1 is still a candidate at line L's cell i. Here position 0 is live
// on lines 0 and 1, position 1 on lines 1 and 2, position 2 on lines 2 and 3,
// and position 3 on line 3 alone. So the assignment of positions to lines has
// exactly one answer: line 3 takes position 3, which leaves position 2 to line
// 2, position 1 to line 1 and position 0 to line 0. Every cell on that diagonal
// is pinned to its target, and every other live edge dies.
//
// The per-line scan reaches only the first of those. Line 0 has one possible
// hit for a clue of 1, so it forces that cell on its own; lines 1, 2 and 3 each
// have two possible hits for one clued hit and cannot choose between them. The
// side does choose.
{
  installGlobals(0, 4)
  const side = load('SideHitMatchingComponent.js', ['setParams', 'update'])
  const line = load('HitCountsComponent.js', ['setParams', 'update', 'initialize'])
  const CLUES = [400, 401, 402, 403]
  const cell = (r, c) => r * 4 + c
  const LINES = [0, 1, 2, 3].map(r => [0, 1, 2, 3].map(c => cell(r, c)))
  // Row r's cell in column c drops digit c + 1 exactly where the shape above
  // wants that edge dead. Every column still shows all of 1..4, which is the
  // fact that makes position c the home of digit c + 1 exactly once.
  const CANDS = [
    [[1, 2, 3, 4], [1, 3, 4], [1, 2, 4], [1, 2, 3]],
    [[1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 4], [1, 2, 3]],
    [[2, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4], [1, 2, 3]],
    [[2, 3, 4], [1, 3, 4], [1, 2, 3, 4], [1, 2, 3, 4]]
  ]
  const start = new Map()
  for (const c of CLUES) start.set(c, [1])
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) start.set(cell(r, c), CANDS[r][c])
  const state = () => {
    const cells = {}
    for (const c of start.keys()) cells[c] = 0
    return makePuzzle(cells, c => start.get(c), { kind: 'fullHouse', digitCount: 4 })
  }
  const show = (p, c) => [...p._cand.get(c)].sort((x, y) => x - y)

  const ps = state()
  const is = {}
  side.setParams(is, CLUES, LINES)
  fixpoint(side, is, ps)

  const pl = state()
  for (let r = 0; r < 4; r++) {
    const inst = {}
    line.setParams(inst, CLUES[r], LINES[r])
    Array.from(line.initialize(inst, pl))
    fixpoint(line, inst, pl)
  }

  for (let i = 0; i < 4; i++) {
    assert.deepStrictEqual(show(ps, cell(i, i)), [i + 1], `the side pins line ${i} at position ${i}`)
  }
  assert.deepStrictEqual(show(ps, cell(1, 0)), [2, 3, 4], 'the side kills the spare edge on line 1')
  assert.deepStrictEqual(show(ps, cell(2, 1)), [1, 3, 4], 'the side kills the spare edge on line 2')
  assert.deepStrictEqual(show(ps, cell(3, 2)), [1, 2, 4], 'the side kills the spare edge on line 3')
  assert.deepStrictEqual(show(pl, cell(0, 0)), [1], 'the per-line scan forces line 0 on its own')
  for (let i = 1; i < 4; i++) {
    assert.deepStrictEqual(show(pl, cell(i, i)), CANDS[i][i],
      `the per-line scan cannot choose position ${i} on line ${i}`)
  }
  console.log('hit-counts side matching: the side pins 4 cells, the per-line scan 1')
}

// ---- 4. SideSumComponent: nine clues on a side summing to nine ----
{
  const NAMES = ['setParams', 'update']
  const cur = load('SideSumComponent.js', NAMES)
  const ref = loadAt(REF_COMMIT, 'SideSumComponent.js', NAMES)
  const N = 9
  const SIDE = [200, 201, 202, 203, 204, 205, 206, 207, 208]
  // The side sum fires only while all N perpendicular lines are full houses of
  // {1..N} (docs/line-contract.md), so the comparison hands it N such lines:
  // a Latin square, every cell pinned to its own digit.
  const PERP = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => 1000 + i * N + j))
  const OPTS = { kind: 'fullHouse', digitCount: N }
  installGlobals(0, 9)
  const apply = (mod, p) => {
    const inst = {}
    mod.setParams(inst, SIDE, N, PERP)
    fixpoint(mod, inst, p)
  }
  let states = 0
  let weaker = 0
  for (let rep = 0; rep < 20000; rep++) {
    const start = new Map()
    // Nine clues that must sum to nine: seeding from 0..9 leaves almost every
    // state dead, so the side test draws small clue values.
    for (const c of SIDE) start.set(c, randomSet(0, 3))
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) start.set(PERP[i][j], [((i + j) % N) + 1])
    const w = compareStrength(cur, ref, apply, start, OPTS)
    if (w === null) continue
    states++
    weaker += w.length
    if (w.length > 0 && weaker <= 5) console.log('side-sum weaker at', w[0], 'start', [...start])
  }
  console.log('hit-counts side-sum:', states, 'states,', weaker, 'weaker cells')
  assert.ok(states > 5000, 'the dead-state filter must leave most states to compare')
  assert.strictEqual(weaker, 0)
}

console.log('PASS')
