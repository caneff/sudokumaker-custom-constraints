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

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'
import { installGlobals, makeIo, makePuzzle, makeRng, housesOf, shuffle } from './harness-lib.mjs'
import { runBackend } from './backend-runner.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const NAMES = ['getAffectedCells', 'setParams', 'update']
const ref = makeIo(join(here, '../../docs/research/406-gac-demo/tools')).load('AllDiffGacComponent.js', NAMES)

// The component sizes its digit table from helpers.digits when its code loads,
// as the app loads it once per puzzle, so each board's globals are installed
// before a fresh load.
let gac
function board (minDigit, maxDigit) {
  installGlobals(minDigit, maxDigit)
  gac = makeIo(here).load('HouseGacComponent.js', NAMES)
}

const CELLS = [11, 12, 13, 14, 15, 16, 17, 18, 19]

// An instance as the app's compiled constructor builds one: it stores
// `getAffectedCells`'s list as `instance.cells`, then calls `setParams`
// (docs/research/bundle-api-reference.md, the custom component wrapper).
function appInstance (mod, name, cells) {
  const inst = { name, cells: mod.getAffectedCells(cells) }
  mod.setParams(inst, cells)
  return inst
}

// One update call of `mod` on a house seeded with `cands` (one candidate array
// per cell). Returns each cell's surviving candidates, sorted, or 'stop'.
function runOnce (mod, cands, kind = 'fullHouse') {
  const cells = CELLS.slice(0, cands.length)
  const truth = Object.fromEntries(cells.map(c => [c, 0]))
  const p = makePuzzle(truth, c => cands[cells.indexOf(c)], { houses: housesOf(kind, cells) })
  const inst = appInstance(mod, 'row 1', cells)
  Array.from(mod.update(inst, p))
  if (p._stopped !== null) return 'stop'
  return cells.map(c => [...p._cand.get(c)].sort((a, b) => a - b))
}

// A house state that still allows the solution `perm`: each cell keeps its
// true digit and gains each other digit in lo..hi with probability `rate`.
function consistentState (rnd, lo, hi, rate, size = 9) {
  const perm = shuffle(rnd, Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)).slice(0, size)
  const cands = perm.map(v => {
    const s = [v]
    for (let d = lo; d <= hi; d++) if (d !== v && rnd() < rate) s.push(d)
    return s
  })
  return { perm, cands }
}

// A house state with no planted solution: each cell gains each digit in lo..hi
// with probability `rate`, or one random digit if that leaves it empty.
function openState (rnd, lo, hi, rate, size = 9) {
  return Array.from({ length: size }, () => {
    const s = []
    for (let d = lo; d <= hi; d++) if (rnd() < rate) s.push(d)
    return s.length ? s : [lo + ((rnd() * (hi - lo + 1)) | 0)]
  })
}

board(1, 9)
const { rnd } = makeRng(408)

// ---- exactly GAC, and sound, on 9 cells of digits 1..9 -------------------
// The ticket's 3000 states, drawn the way `tools/bench.mjs` drew them: a hidden
// permutation plus each other digit at 35%. Every state has a solution, so the
// filter must keep every true digit and never stop.
{
  let disagree = 0
  for (let t = 0; t < 3000; t++) {
    const { perm, cands } = consistentState(rnd, 1, 9, 0.35)
    const got = runOnce(gac, cands)
    assert.notStrictEqual(got, 'stop', `state ${t}: stopped on a house that has a solution`)
    got.forEach((s, i) => assert.ok(s.includes(perm[i]),
      `state ${t}: cell ${i} lost its true digit ${perm[i]} -- unsound`))
    if (JSON.stringify(got) !== JSON.stringify(runOnce(ref, cands))) disagree++
  }
  assert.strictEqual(disagree, 0, `${disagree} of 3000 states disagree with matching GAC`)
}

// ---- exactly GAC on 9 cells of ten digits (hit-counts runs 0..9) ---------
// A house shorter than its digit range: a Hall set still prunes, but no digit
// is forced to appear, so the subset form must not read "9 cells" as "every
// digit once".
board(0, 9)
{
  let disagree = 0
  for (let t = 0; t < 1000; t++) {
    const { perm, cands } = consistentState(rnd, 0, 9, 0.25)
    const got = runOnce(gac, cands, 'house')
    assert.notStrictEqual(got, 'stop', `0..9 state ${t}: stopped on a house that has a solution`)
    got.forEach((s, i) => assert.ok(s.includes(perm[i]), `0..9 state ${t}: cell ${i} lost ${perm[i]}`))
    if (JSON.stringify(got) !== JSON.stringify(runOnce(ref, cands, 'house'))) disagree++
  }
  assert.strictEqual(disagree, 0, `${disagree} of 1000 digit-0..9 states disagree with matching GAC`)
}
board(1, 9)

// ---- a house with no solution stops, exactly when matching says so -------
// Sparse random states with no planted solution: many have none, and the filter
// must declare that branch dead rather than quietly leave it open.
{
  let stops = 0
  for (let t = 0; t < 2000; t++) {
    const cands = openState(rnd, 1, 9, 0.2)
    const want = runOnce(ref, cands)
    const got = runOnce(gac, cands)
    if (want === 'stop') stops++
    assert.deepStrictEqual(got, want, `open state ${t}: ${JSON.stringify(cands)}`)
  }
  assert.ok(stops > 100, `only ${stops} of 2000 open states had no solution; the case is not exercised`)
}

// ---- digits above 9 (a 16-digit board) -------------------------------------
// Digit counts come from a table sized to the board's digits, so a 16-digit
// board needs every entry up to digit 16. Nine cells over digits 1..16, with and
// without a planted solution, land exactly where the matching filter lands.
board(1, 16)
{
  let stops = 0
  let high = 0
  for (let t = 0; t < 2000; t++) {
    const planted = t % 2 === 0
    const cands = planted
      ? consistentState(rnd, 1, 16, 0.2).cands
      : openState(rnd, 1, 16, 0.08)
    if (cands.some(s => s.some(d => d > 9))) high++
    const want = runOnce(ref, cands, 'house')
    if (want === 'stop') stops++
    assert.deepStrictEqual(runOnce(gac, cands, 'house'), want, `1..16 state ${t}: ${JSON.stringify(cands)}`)
  }
  assert.ok(stops > 100, `only ${stops} of 2000 digit-1..16 states stop; the stop is not exercised`)
  assert.ok(high > 1900, `only ${high} of 2000 states use a digit above 9; the table above digit 9 is not exercised`)
}
board(1, 9)

// ---- houses shorter than 9 cells ------------------------------------------
// A frame board's 6x6 or 8x8 interior hands the backend houses of 6 or 8 cells,
// and nothing about the rule depends on the house holding 9. Every size from 1
// to 8 over digits 1..9, with and without a planted solution, lands exactly
// where the matching filter lands.
for (let size = 1; size <= 8; size++) {
  let stops = 0
  for (let t = 0; t < 400; t++) {
    const planted = t % 2 === 0
    const cands = planted
      ? consistentState(rnd, 1, 9, 0.3, size).cands
      : openState(rnd, 1, 9, 0.15, size)
    const want = runOnce(ref, cands, 'house')
    if (want === 'stop') stops++
    assert.deepStrictEqual(runOnce(gac, cands, 'house'), want, `${size} cells, state ${t}: ${JSON.stringify(cands)}`)
  }
  if (size >= 3) assert.ok(stops > 10, `${size} cells: only ${stops} of 400 states had no filling; the stop is not exercised`)
}

// ---- a worked Hall set, independent of any reference ----------------------
// Cells 0-2 hold only {1,2,3}: a naked triple, so 1, 2 and 3 leave the other
// six cells. Cell 3 is then left with 4 alone, a naked single, so 4 leaves the
// last five as well -- all in one call.
{
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const got = runOnce(gac, [[1, 2], [2, 3], [1, 3], [3, 4], all, all, all, all, all])
  assert.deepStrictEqual(got.slice(0, 4), [[1, 2], [2, 3], [1, 3], [4]])
  for (const s of got.slice(4)) assert.deepStrictEqual(s, [5, 6, 7, 8, 9], 'the triple and the single are not removed from the rest')
}

// ---- placed cells are stripped from the house before the free-cell walk --
// Cells 0 and 1 are already solved (1, then 2), and the walk itself only ever
// runs over cells 2-8 (#435: filled cells are excluded from the subset walk
// entirely). Cells 2 and 3 hold {1, 2, 3, 4} apiece: that is a naked pair on
// {3, 4} only once 1 and 2 are gone, so this fails without the strip step --
// cells 2 and 3 would stay {1, 2, 3, 4}, no pair would be found, and 1, 2, 3, 4
// would all still sit in cells 4-8's candidates too. Checked directly: with
// the strip loop deleted from `update` (keeping the free-cell walk), this
// suite's earlier 3000-state property check already disagrees with matching
// GAC on 668 of 3000 states, well before this block runs.
{
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const cands = [[1], [2], [1, 2, 3, 4], [1, 2, 3, 4], all, all, all, all, all]
  const got = runOnce(gac, cands)
  assert.deepStrictEqual(got.slice(0, 4), [[1], [2], [3, 4], [3, 4]])
  for (const s of got.slice(4)) assert.deepStrictEqual(s, [5, 6, 7, 8, 9], 'placed digits or the pair were not fully cleared from the rest')
  assert.deepStrictEqual(got, runOnce(ref, cands), 'disagrees with matching GAC once cells are pre-filled')
}

// ---- gated: a line that may repeat is left alone --------------------------
// docs/line-contract.md: all-different only holds where the app says the cells
// cannot repeat. The same Hall set on a bare line removes nothing.
{
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const cands = [[1, 2], [2, 3], [1, 3], [3, 4], all, all, all, all, all]
  assert.deepStrictEqual(runOnce(gac, cands, 'bare'), cands, 'pruned a line whose digits may repeat')
}

// ---- refuses a house above 9 cells, loudly --------------------------------
// It checks all 2^n groups of cells, so its cost doubles with each cell and it
// is slower than the matching filter from n=12-13
// (docs/research/all-different-gac.md, "Larger houses"). Registering one on a
// larger house is a mistake the author must see at setup.
assert.throws(() => gac.setParams({ name: 'row 1' }, Array.from({ length: 10 }, (_, i) => i)), /9 cells/)

// ---- refuses a board with digits above 16, loudly -------------------------
// Its digit table holds an entry per digit set, 2^(maxDigit+1) of them: 131 KB
// at 16 digits, doubling with each digit after. Loading on such a board must
// still work, since the app loads the code before any house is registered.
for (const maxDigit of [17, 30]) {
  board(1, maxDigit)
  assert.throws(() => gac.setParams({ name: 'row 1' }, CELLS), /digits up to 16/, `digits 1..${maxDigit}`)
}
board(1, 9)

// ---- no scratch state crosses a yield --------------------------------------
// The solver may run another instance's `update` while this one is suspended at
// a yield. Suspend house A after its first removal, run house B to the end on a
// different state, then finish A: A must end where it ends when run alone.
//
// The states are chosen so shared scratch would show. A's first Hall set is
// cells 0 and 3, group 0b1001. A filter that yielded there and read its
// `pooledDigitsOf` table after would take cell 3's entry from B, a solved
// house where it is {4}, and read cells 1 and 3 as a false pair on {4, 5}.
{
  const all = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  const aCands = [[1, 2], [4, 5], all, [1, 2], all, all, all, all, all]
  const bCands = [[1], [2], [3], [4], [5], [6], [7], [8], [9]]
  const truth = Object.fromEntries(CELLS.map(c => [c, 0]))
  const pa = makePuzzle(truth, c => aCands[CELLS.indexOf(c)], { houses: [CELLS] })
  const pb = makePuzzle(truth, c => bCands[CELLS.indexOf(c)], { houses: [CELLS] })
  const a = appInstance(gac, 'A', CELLS)
  const b = appInstance(gac, 'B', CELLS)
  const genA = gac.update(a, pa)
  assert.strictEqual(genA.next().done, false, 'house A yields no removal to suspend at')
  Array.from(gac.update(b, pb))
  Array.from(genA)
  const got = CELLS.map(c => [...pa._cand.get(c)].sort((x, y) => x - y))
  assert.deepStrictEqual(got, runOnce(gac, aCands), 'house A changed because house B ran at its yield')
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
    // Plain numbers on the right, so an uncoerced id object also fails here (#276, #394).
    assert.deepStrictEqual(registered.map(c => c.args[1]), [...rows, ...cols, ...regions],
      `${where}: the houses are not the interior rows, then columns, then boxes, as plain numbers`)
    const names = registered.map(c => c.args[0])
    assert.strictEqual(new Set(names).size, names.length, `${where}: house names are not distinct`)
    assert.deepStrictEqual([names[0], names[ih], names[ih + iw]], ['row 1', 'column 1', 'box 1'], `${where}: misnamed`)
  }
}

// ---- the repeats answer is latched both ways ----
// Geometry-fixed once update first runs. The bare arm witnesses #451; the
// fullHouse arm guards the latch that already held.
for (const kind of ['bare', 'fullHouse']) {
  const cells = CELLS.slice(0, 4)
  const p = makePuzzle(Object.fromEntries(cells.map(c => [c, 0])), () => [1, 2, 3, 4], { houses: housesOf(kind, cells) })
  const real = p.getCellsCanHaveRepeats
  let asked = 0
  p.getCellsCanHaveRepeats = cs => { asked++; return real(cs) }
  const inst = appInstance(gac, 'row 1', cells)
  Array.from(gac.update(inst, p))
  Array.from(gac.update(inst, p))
  assert.strictEqual(asked, 1, `${kind}: asked once, not per update`)
}

// ---- setParams leaves instance.cells to the app ----
// The compiled constructor already stores getAffectedCells's list as
// instance.cells, so setParams has nothing to add.
{
  const inst = { name: 'row 1' }
  gac.setParams(inst, CELLS)
  assert.deepStrictEqual(inst, { name: 'row 1' }, 'setParams wrote to the instance')
}

// ---- removals go to the app as raw masks ----
// The removal builders take a bitmask (docs/research/bundle-api-reference.md),
// so a SudokuDigitSet per removal is an allocation nothing reads. With a
// SudokuDigitSet that throws, the worked Hall set must still be removed.
{
  const real = globalThis.SudokuDigitSet
  globalThis.SudokuDigitSet = class { constructor () { throw new Error('SudokuDigitSet built') } static from () { throw new Error('SudokuDigitSet built') } }
  try {
    const all = [1, 2, 3, 4, 5, 6, 7, 8, 9]
    const got = runOnce(gac, [[1, 2], [2, 3], [1, 3], [3, 4], all, all, all, all, all])
    assert.deepStrictEqual(got[3], [4], 'the naked triple was not removed from cell 3')
  } finally {
    globalThis.SudokuDigitSet = real
  }
}

console.log('house-gac self-check OK')
