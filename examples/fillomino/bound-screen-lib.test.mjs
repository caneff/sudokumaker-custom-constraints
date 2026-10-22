// The bound screen's library (#327): the open-cell-count variant is the
// shipped component plus a board-wide room check, loaded as a source patch.
//
// Seams: the variant answers every board the baseline answers, the same way;
// the room check fires on a state no per-island rule kills; and the variant
// never keeps a candidate on a state it does not kill that the baseline removed.

import assert from 'assert'
import { loadVariants, fixtureBoards, runScreen } from './bound-screen-lib.mjs'
import { score } from './hunt-lib.mjs'
import { installGlobals, makePuzzle, makeRng, makeSeeder, randomCandidates, fixpoint, compareStrength, fuzzSoundness } from '../_shared/harness-lib.mjs'
import { shipped, varied } from './fixture.mjs'

const HERE = import.meta.dirname
const { baseline, incremental } = loadVariants(HERE)

const rowsToGivens = rows => Object.fromEntries(rows.flat().map((d, i) => [i, d]))
const GRID3 = [[1, 2, 2], [2, 1, 3], [2, 3, 3]]

for (const board of [
  { side: 3, cap: 3, givens: rowsToGivens(GRID3) },
  { side: 3, cap: 3, givens: { 0: 1, 4: 1, 8: 3 } },
  { side: 3, cap: 3, givens: { 0: 1, 4: 1 } },
  { side: 2, cap: 2, givens: {} }
]) {
  const want = score(baseline, board)
  const got = score(incremental, board)
  assert.strictEqual(got.verdict, want.verdict)
  assert.deepStrictEqual(got.grid, want.grid)
}

// A 9x9, digits 1-12 state the island rules and the component bound all leave
// alive after one call, that has no room: the room check is the only rule that
// kills it. Found by a random sweep of 9x12 states at a 30% placement rate.
const SHORT = [0, 0, 0, 0, 1, 0, 0, 12, 0, 0, 1, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 3, 10, 0, 11, 0, 0, 0, 1, 0, 4, 0, 0, 1, 0, 5, 11, 0, 0, 0, 0, 7, 7, 4, 0, 0, 0, 0, 0, 0, 0, 1, 9, 0, 0, 2, 3, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 8]
{
  installGlobals(1, 12)
  const CELLS = Array.from({ length: 81 }, (_, i) => i)
  const ALL = Array.from({ length: 12 }, (_, i) => i + 1)
  const build = row => makePuzzle(Object.fromEntries(CELLS.map(c => [c, 0])), c => (row[c] ? [row[c]] : ALL))
  const dead = p => [...p._cand.values()].some(s => s.size === 0)
  const once = (mod, inst, row) => { const p = build(row); Array.from(mod.update(inst, p)); return p }
  const fresh = mod => { const inst = {}; mod.setParams(inst, CELLS, 9, 9); return inst }

  assert.strictEqual(dead(once(baseline, fresh(baseline), SHORT)), false, 'no other rule reaches this state')
  assert.strictEqual(dead(once(incremental, fresh(incremental), SHORT)), true)

  // The count follows the board both ways: one instance sees the short state,
  // then an open board, then the short state again, and after every call its
  // running counts are what a count from scratch gives.
  const OPEN = Array(81).fill(0)
  const ONE = OPEN.map((d, i) => (i === 0 ? 12 : 0))
  const inst = fresh(incremental)
  for (const row of [SHORT, OPEN, SHORT, ONE]) {
    const dies = dead(once(incremental, inst, row))
    const placed = row.filter(d => d !== 0)
    assert.strictEqual(inst.openLeft, 81 - placed.length, 'the open count follows the board')
    for (let d = 1; d <= 12; d++) {
      assert.strictEqual(inst.placedBy[d], placed.filter(x => x === d).length, `placed ${d}s follow the board`)
    }
    if (row === OPEN || row === ONE) assert.strictEqual(dies, false, 'a roomy board is not killed')
  }
}

// The strength comparison the ticket asks for: on a state around a real
// solution the variant removes no fewer candidates than the baseline, and no
// more. The room check cannot fire on such a state, so this is a regression
// guard on the shared rules; the soundness fuzz below is what witnesses an
// unsound check.
{
  const { truth, n } = shipped
  installGlobals(1, n)
  const CELLS = Array.from({ length: n * n }, (_, i) => i)
  const { rnd } = makeRng(327)
  const apply = (mod, p) => { const inst = {}; mod.setParams(inst, CELLS, 9, 9); fixpoint(mod, inst, p) }
  for (let rep = 0; rep < 150; rep++) {
    const start = new Map()
    for (const c of CELLS) start.set(c, randomCandidates(rnd, 1, n, truth[c]))
    assert.deepStrictEqual(compareStrength(incremental, baseline, apply, start), [])
    assert.deepStrictEqual(compareStrength(baseline, incremental, apply, start), [])
  }
}

{
  const boards = fixtureBoards(HERE)
  assert.strictEqual(boards.length, 19, 'the frozen fixture set is 19 boards')
  for (const b of boards) {
    assert.strictEqual(b.side, 9)
    assert.ok(Object.keys(b.givens).length >= 28 && Object.keys(b.givens).length <= 35)
  }
}

// Soundness, the one rule that fails silently: the room check never removes a
// candidate a real solution needs.
{
  const { rnd } = makeRng(328)
  for (const [name, { truth, n }] of [['shipped', shipped], ['varied', varied]]) {
    installGlobals(1, n)
    const CELLS = Array.from({ length: n * n }, (_, i) => i)
    const seed = makeSeeder(rnd, Array.from({ length: n }, (_, d) => d + 1))
    const { failures } = fuzzSoundness(`open count incremental, ${name}`, {
      iters: 3000,
      draw: () => {
        const inst = {}
        incremental.setParams(inst, CELLS, 9, 9)
        return { truth, seed, parts: [{ mod: incremental, inst }] }
      }
    })
    assert.strictEqual(failures, 0)
  }
}

// The screen's own loop: a variant that answers differently from the baseline
// is counted, a run that solved nothing is refused, and agreeing variants
// count nothing.
{
  const tiny = [{ name: 'tiny', side: 3, cap: 3, givens: { 0: 1, 4: 1, 8: 3 } }]
  assert.strictEqual(runScreen(tiny, { baseline, incremental }, 1).bad, 0)
  const wrong = { ...baseline, validate: () => false }
  assert.strictEqual(runScreen(tiny, { baseline, wrong }, 1).bad, 1, 'a variant that disagrees is counted')
  for (const reps of [0, -1, 1.5, NaN]) assert.throws(() => runScreen(tiny, { baseline }, reps), /positive integer/)
  assert.throws(() => runScreen(tiny, { incremental }, 1), /baseline/)
}

console.log('bound-screen-lib.test.mjs: all seams pass')
