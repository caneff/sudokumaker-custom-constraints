// The open-cell-count screen's library (#327): the variant is the shipped
// component plus a board-wide room check, loaded as a source patch.
//
// Seams: the variant answers every board the baseline answers, the same way;
// the room check fires on a state no per-island rule kills; and the variant
// never keeps a candidate on a state it does not kill that the baseline removed.

import assert from 'assert'
import { loadVariants, fixtureBoards, roomShort } from './open-count-lib.mjs'
import { score } from './hunt-lib.mjs'
import { installGlobals, makePuzzle, makeRng, makeSeeder, randomCandidates, fixpoint, compareStrength, fuzzSoundness } from '../_shared/harness-lib.mjs'
import { shipped, varied } from './fixture.mjs'

const HERE = import.meta.dirname
const { baseline, incremental, recount } = loadVariants(HERE)

const rowsToGivens = rows => Object.fromEntries(rows.flat().map((d, i) => [i, d]))
const GRID3 = [[1, 2, 2], [2, 1, 3], [2, 3, 3]]

for (const board of [
  { side: 3, cap: 3, givens: rowsToGivens(GRID3) },
  { side: 3, cap: 3, givens: { 0: 1, 4: 1, 8: 3 } },
  { side: 3, cap: 3, givens: { 0: 1, 4: 1 } },
  { side: 2, cap: 2, givens: {} }
]) {
  const want = score(baseline, board)
  for (const v of [incremental, recount]) {
    const got = score(v, board)
    assert.strictEqual(got.verdict, want.verdict)
    assert.deepStrictEqual(got.grid, want.grid)
  }
}

// The room check in isolation: the sum of what each placed digit still needs
// against the cells left open.
assert.strictEqual(roomShort([3, 2, 1, 0, 0, 0, 0, 0, 0]), false)
// 3 placed once needs 2, 2 placed once needs 1, and one 1 is whole: with no
// open cell left the need of 3 is more than the room, whatever the layout.
assert.strictEqual(roomShort([3, 2, 1, 1, 1, 1, 1, 1, 1]), true)

// A 9x9, digits 1-12 state the island rules and the component bound all leave
// alive after one call, that has no room: the room check is the only rule that
// kills it. Found by a random sweep of 9x12 states at a 30% placement rate.
const SHORT = [0, 0, 0, 0, 1, 0, 0, 12, 0, 0, 1, 12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 3, 10, 0, 11, 0, 0, 0, 1, 0, 4, 0, 0, 1, 0, 5, 11, 0, 0, 0, 0, 7, 7, 4, 0, 0, 0, 0, 0, 0, 0, 1, 9, 0, 0, 2, 3, 0, 12, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 8]
{
  assert.strictEqual(roomShort(SHORT), true)
  installGlobals(1, 12)
  const CELLS = Array.from({ length: 81 }, (_, i) => i)
  const ALL = Array.from({ length: 12 }, (_, i) => i + 1)
  const build = row => makePuzzle(Object.fromEntries(CELLS.map(c => [c, 0])), c => (row[c] ? [row[c]] : ALL))
  const dead = p => [...p._cand.values()].some(s => s.size === 0)
  const once = (mod, inst, row) => { const p = build(row); Array.from(mod.update(inst, p)); return p }
  const fresh = mod => { const inst = {}; mod.setParams(inst, CELLS); return inst }

  assert.strictEqual(dead(once(baseline, fresh(baseline), SHORT)), false, 'no other rule reaches this state')
  for (const v of [incremental, recount]) {
    assert.strictEqual(dead(once(v, fresh(v), SHORT)), true)
  }

  // The count follows the board both ways: one instance sees the short state,
  // then an open board, then the short state again. A count that only ever
  // grows would kill the open board.
  const OPEN = Array(81).fill(0)
  const inst = fresh(incremental)
  assert.strictEqual(dead(once(incremental, inst, SHORT)), true)
  assert.strictEqual(dead(once(incremental, inst, OPEN)), false, 'a restored board is open again')
  assert.strictEqual(dead(once(incremental, inst, SHORT)), true)
}

// On a state around a real solution the variant is the baseline: it removes
// no more and no fewer candidates, and never dies.
{
  const { truth, n } = shipped
  installGlobals(1, n)
  const CELLS = Array.from({ length: n * n }, (_, i) => i)
  const { rnd } = makeRng(327)
  const apply = (mod, p) => { const inst = {}; mod.setParams(inst, CELLS); fixpoint(mod, inst, p) }
  for (let rep = 0; rep < 150; rep++) {
    const start = new Map()
    for (const c of CELLS) start.set(c, randomCandidates(rnd, 1, n, truth[c]))
    for (const v of [incremental, recount]) {
      assert.deepStrictEqual(compareStrength(v, baseline, apply, start), [])
      assert.deepStrictEqual(compareStrength(baseline, v, apply, start), [])
    }
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
    for (const [label, mod] of [['incremental', incremental], ['recount', recount]]) {
      const { failures } = fuzzSoundness(`open count ${label}, ${name}`, {
        iters: 3000,
        draw: () => {
          const inst = {}
          mod.setParams(inst, CELLS)
          return { truth, seed, parts: [{ mod, inst }] }
        }
      })
      assert.strictEqual(failures, 0)
    }
  }
}

console.log('open-count-lib.test.mjs: all seams pass')
