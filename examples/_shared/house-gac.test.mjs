// The shared house filter: `HouseGacComponent.js` filters one all-different
// house to generalized arc consistency, and `house-gac.js` registers it on
// every interior row, column and box of a frame board.
//
//   node examples/_shared/house-gac.test.mjs
//
// Why this matters. The app's own house constraints are below GAC: neither
// `HouseComponent` nor `DifferentDigitsComponent` finds a Hall set, and a plain
// 9x9 that stalls at 53/81 under AutoStep reaches 81/81 with a GAC filter added
// (#406, docs/research/all-different-gac.md). The filter is only worth that if
// it is exactly GAC -- naked subsets capped below n-1 miss a quarter of all
// states -- and it is only safe if it never drops a digit the solution needs.
//
// The reference is the matching-based `AllDiffGacComponent.js` the #406 demo
// ran, so the zero-disagreement count here is the same measurement as the
// ticket's 3000-state one (#408).
//
// `ReadableHouseGacComponent.js` states the same rule in digit sets and plain
// words. It must land on exactly what `HouseGacComponent.js` lands on in every
// fuzz below, and it takes every fixed test the bitmask one takes.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'
import { installGlobals, makeIo, makePuzzle, makeRng } from './harness-lib.mjs'
import { runBackend } from './backend-runner.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const NAMES = ['getAffectedCells', 'setParams', 'update']
const gac = makeIo(here).load('HouseGacComponent.js', NAMES)
const readable = makeIo(here).load('ReadableHouseGacComponent.js', NAMES)
const COMPONENTS = [['HouseGacComponent', gac], ['ReadableHouseGacComponent', readable]]
const ref = makeIo(join(here, '../../docs/research/406-gac-demo/tools')).load('AllDiffGacComponent.js', NAMES)

const CELLS = [11, 12, 13, 14, 15, 16, 17, 18, 19]

// One update call of `mod` on a house seeded with `cands` (one candidate array
// per cell). Returns each cell's surviving candidates, sorted, or 'stop'.
function runOnce (mod, cands, kind = 'fullHouse') {
  const cells = CELLS.slice(0, cands.length)
  const truth = Object.fromEntries(cells.map(c => [c, 0]))
  const p = makePuzzle(truth, c => cands[cells.indexOf(c)], { kind })
  const inst = { name: 'row 1' }
  mod.setParams(inst, cells)
  Array.from(mod.update(inst, p))
  if (p._stopped !== null) return 'stop'
  return cells.map(c => [...p._cand.get(c)].sort((a, b) => a - b))
}

function shuffle (rnd, a) {
  for (let i = a.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]] }
  return a
}

// A house state that still allows the solution `perm`: each cell keeps its
// true digit and gains each other digit in lo..hi with probability `rate`.
function consistentState (rnd, lo, hi, rate) {
  const perm = shuffle(rnd, Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)).slice(0, 9)
  const cands = perm.map(v => {
    const s = [v]
    for (let d = lo; d <= hi; d++) if (d !== v && rnd() < rate) s.push(d)
    return s
  })
  return { perm, cands }
}

installGlobals(1, 9)
const { rnd } = makeRng(408)

// ---- exactly GAC, and sound, on 9 cells of digits 1..9 -------------------
// The ticket's 3000 states, drawn the way `tools/bench.mjs` drew them: a hidden
// permutation plus each other digit at 35%. Every state has a solution, so the
// filter must keep every true digit and never stop.
{
  let disagree = 0
  let readableDisagree = 0
  for (let t = 0; t < 3000; t++) {
    const { perm, cands } = consistentState(rnd, 1, 9, 0.35)
    const got = runOnce(gac, cands)
    assert.notStrictEqual(got, 'stop', `state ${t}: stopped on a house that has a solution`)
    got.forEach((s, i) => assert.ok(s.includes(perm[i]),
      `state ${t}: cell ${i} lost its true digit ${perm[i]} -- unsound`))
    if (JSON.stringify(got) !== JSON.stringify(runOnce(ref, cands))) disagree++
    if (JSON.stringify(runOnce(readable, cands)) !== JSON.stringify(got)) readableDisagree++
  }
  assert.strictEqual(disagree, 0, `${disagree} of 3000 states disagree with matching GAC`)
  assert.strictEqual(readableDisagree, 0, `${readableDisagree} of 3000 states: the readable filter disagrees with the bitmask one`)
}

// ---- exactly GAC on 9 cells of ten digits (hit-counts runs 0..9) ---------
// A house shorter than its digit range: a Hall set still prunes, but no digit
// is forced to appear, so the subset form must not read "9 cells" as "every
// digit once".
installGlobals(0, 9)
{
  let disagree = 0
  let readableDisagree = 0
  for (let t = 0; t < 1000; t++) {
    const { perm, cands } = consistentState(rnd, 0, 9, 0.25)
    const got = runOnce(gac, cands, 'house')
    assert.notStrictEqual(got, 'stop', `0..9 state ${t}: stopped on a house that has a solution`)
    got.forEach((s, i) => assert.ok(s.includes(perm[i]), `0..9 state ${t}: cell ${i} lost ${perm[i]}`))
    if (JSON.stringify(got) !== JSON.stringify(runOnce(ref, cands, 'house'))) disagree++
    if (JSON.stringify(runOnce(readable, cands, 'house')) !== JSON.stringify(got)) readableDisagree++
  }
  assert.strictEqual(disagree, 0, `${disagree} of 1000 digit-0..9 states disagree with matching GAC`)
  assert.strictEqual(readableDisagree, 0, `${readableDisagree} of 1000 digit-0..9 states: the readable filter disagrees with the bitmask one`)
}
installGlobals(1, 9)

// ---- a house with no solution stops, exactly when matching says so -------
// Sparse random states with no planted solution: many have none, and the filter
// must declare that branch dead rather than quietly leave it open.
{
  let stops = 0
  for (let t = 0; t < 2000; t++) {
    const cands = CELLS.map(() => {
      const s = []
      for (let d = 1; d <= 9; d++) if (rnd() < 0.2) s.push(d)
      return s.length ? s : [1 + ((rnd() * 9) | 0)]
    })
    const want = runOnce(ref, cands)
    const got = runOnce(gac, cands)
    if (want === 'stop') stops++
    assert.deepStrictEqual(got, want, `open state ${t}: ${JSON.stringify(cands)}`)
    assert.deepStrictEqual(runOnce(readable, cands), got, `open state ${t}, readable vs bitmask: ${JSON.stringify(cands)}`)
  }
  assert.ok(stops > 100, `only ${stops} of 2000 open states had no solution; the case is not exercised`)
}

// ---- a worked Hall set, independent of any reference ----------------------
// Cells 0-2 hold only {1,2,3}: a naked triple, so 1, 2 and 3 leave the other
// six cells. Cell 3 is then left with 4 alone, a naked single, so 4 leaves the
// last five as well -- all in one call.
for (const [label, mod] of COMPONENTS) {
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const got = runOnce(mod, [[1, 2], [2, 3], [1, 3], [3, 4], all, all, all, all, all])
  assert.deepStrictEqual(got.slice(0, 4), [[1, 2], [2, 3], [1, 3], [4]], label)
  for (const s of got.slice(4)) assert.deepStrictEqual(s, [5, 6, 7, 8, 9], `${label}: the triple and the single are not removed from the rest`)
}

// ---- gated: a line that may repeat is left alone --------------------------
// docs/line-contract.md: all-different only holds where the app says the cells
// cannot repeat. The same Hall set on a bare line removes nothing.
for (const [label, mod] of COMPONENTS) {
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const cands = [[1, 2], [2, 3], [1, 3], [3, 4], all, all, all, all, all]
  assert.deepStrictEqual(runOnce(mod, cands, 'bare'), cands, `${label}: pruned a line whose digits may repeat`)
}

// ---- refuses a house above 9 cells, loudly --------------------------------
// 2^n subsets per call: in the bare-mask probe, 25 us at n=10 and 676 us at
// n=14 against matching's 22 and 79 (docs/research/all-different-gac.md,
// "Cost"). Registering one there is a mistake the author must see at setup.
for (const [label, mod] of COMPONENTS) {
  assert.throws(() => mod.setParams({ name: 'row 1' }, Array.from({ length: 10 }, (_, i) => i)), /9 cells/, label)
}

// ---- no scratch state crosses a yield --------------------------------------
// The solver may run another instance's `update` while this one is suspended at
// a yield. Suspend house A after its first removal, run house B to the end on a
// different state, then finish A: A must end where it ends when run alone.
//
// The states are chosen so shared scratch would show. A's first Hall set is
// cells 0 and 3, subset 0b1001; a filter that yielded there and read its
// subset unions after would take cell 3's union from B, a solved house where
// it is {4}, and read cells 1 and 3 as a false pair on {4, 5}.
for (const [label, mod] of COMPONENTS) {
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const aCands = [[1, 2], [4, 5], all, [1, 2], all, all, all, all, all]
  const bCands = [[1], [2], [3], [4], [5], [6], [7], [8], [9]]
  const truth = Object.fromEntries(CELLS.map(c => [c, 0]))
  const pa = makePuzzle(truth, c => aCands[CELLS.indexOf(c)], { kind: 'fullHouse' })
  const pb = makePuzzle(truth, c => bCands[CELLS.indexOf(c)], { kind: 'fullHouse' })
  const a = { name: 'A' }
  const b = { name: 'B' }
  mod.setParams(a, CELLS)
  mod.setParams(b, CELLS)
  const genA = mod.update(a, pa)
  assert.strictEqual(genA.next().done, false, `${label}: house A yields no removal to suspend at`)
  Array.from(mod.update(b, pb))
  Array.from(genA)
  const got = CELLS.map(c => [...pa._cand.get(c)].sort((x, y) => x - y))
  assert.deepStrictEqual(got, runOnce(mod, aCands), `${label}: house A changed because house B ran at its yield`)
}

// ---- the backend: one filter per interior row, column and box -------------
// A frame board: the ring is the first and last row and column, and the region
// constraint gives the interior boxes and leaves the ring out. The board is
// rectangular so a backend that reads one dimension twice is caught.
{
  const SRC = readFileSync(join(here, 'house-gac.js'), 'utf8')
  for (const [W, H, bw, bh] of [[11, 11, 3, 3], [8, 6, 3, 2]]) {
    const id = (x, y) => new Number(x + y * W) // eslint-disable-line no-new-wrappers -- ids must be coerced
    const iw = W - 2
    const ih = H - 2
    const regions = []
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const r = Math.floor((y - 1) / bh) * (iw / bw) + Math.floor((x - 1) / bw)
        ;(regions[r] ||= []).push(x + y * W)
      }
    }
    const registered = []
    runBackend(SRC, {
      puzzle: { addConstraintComponent: c => registered.push(c), getRegions: () => regions },
      helpers: {
        geometry: {
          * getAllRows () { for (let y = 0; y < H; y++) yield Array.from({ length: W }, (_, x) => id(x, y)) },
          * getAllColumns () { for (let x = 0; x < W; x++) yield Array.from({ length: H }, (_, y) => id(x, y)) }
        }
      }
    })
    const where = `${W}x${H}`
    const rows = Array.from({ length: ih }, (_, y) => Array.from({ length: iw }, (_, x) => (x + 1) + (y + 1) * W))
    const cols = Array.from({ length: iw }, (_, x) => Array.from({ length: ih }, (_, y) => (x + 1) + (y + 1) * W))
    assert.deepStrictEqual([...new Set(registered.map(c => c.ctor))], ['HouseGacComponent'], `${where}: wrong component`)
    assert.deepStrictEqual(registered.map(c => c.args[1]), [...rows, ...cols, ...regions],
      `${where}: the houses are not the interior rows, then columns, then boxes`)
    for (const c of registered) {
      assert.ok(c.args[1].every(x => typeof x === 'number'), `${where}: ${c.args[0]} carries uncoerced ids (#276, #394)`)
    }
    const names = registered.map(c => c.args[0])
    assert.strictEqual(new Set(names).size, names.length, `${where}: house names are not distinct`)
    assert.deepStrictEqual([names[0], names[ih], names[ih + iw]], ['row 1', 'column 1', 'box 1'], `${where}: misnamed`)
  }
}

console.log('house-gac self-check OK')
