// Seams of the offline board hunt (#317): the hardness scorer's verdict and
// node/pass counts, the offline strip's closable invariant, and the
// hill-climb's keep/drop rule with its reproduction record.
// Run: node examples/fillomino/hunt-lib.test.mjs
//
// The expected verdicts on 3x3 and 2x2 boards come from generate.py's
// `brute` -- the solver-free reading of the rule -- not from this scorer:
//   3x3, no clues, digits 1-3      -> 38 grids
//   3x3, r0c0=1 r1c1=1 r2c2=3      -> exactly 1
//   3x3, r0c0=1 r1c1=1             -> exactly 2
//   2x2, no clues, digits 1-2      -> 0

import assert from 'assert'
import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { loadComponent, score, stripOffline, givensOf, harder, judgeMutant, spearman } from './hunt-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const mod = loadComponent(HERE)

const rowsToGivens = rows => Object.fromEntries(rows.flat().map((d, i) => [i, d]))
const GRID3 = [[1, 2, 2], [2, 1, 3], [2, 3, 3]]

// ---- A fully given valid grid is read off, not searched: no branch node ----
{
  const s = score(mod, { side: 3, cap: 3, givens: rowsToGivens(GRID3) })
  assert.strictEqual(s.verdict, 'unique')
  assert.strictEqual(s.nodes, 0, 'a full board needs no guess')
  assert.ok(s.passes >= 1, 'propagation runs at least one pass')
  assert.deepStrictEqual(s.grid, GRID3)
}

// ---- The verdicts match brute force on 3x3 and 2x2 ----
{
  const unique = score(mod, { side: 3, cap: 3, givens: { 0: 1, 4: 1, 8: 3 } })
  assert.strictEqual(unique.verdict, 'unique')
  assert.deepStrictEqual(unique.grid, GRID3)
  assert.ok(unique.nodes >= 1, 'a clue set the rules do not close needs a guess')

  assert.strictEqual(score(mod, { side: 3, cap: 3, givens: { 0: 1, 4: 1 } }).verdict, 'multiple')
  assert.strictEqual(score(mod, { side: 3, cap: 3, givens: {} }).verdict, 'multiple')
  assert.strictEqual(score(mod, { side: 2, cap: 2, givens: {} }).verdict, 'none')
}

// ---- Scoring is deterministic: the same clue set scores the same twice ----
{
  const board = { side: 3, cap: 3, givens: { 0: 1, 4: 1, 8: 3 } }
  const a = score(mod, board)
  const b = score(mod, board)
  assert.deepStrictEqual([a.verdict, a.nodes, a.passes], [b.verdict, b.nodes, b.passes])
}

// ---- A node budget spent mid-search reports 'capped', never a verdict ----
{
  const s = score(mod, { side: 3, cap: 3, givens: {} }, { nodeCap: 1 })
  assert.strictEqual(s.verdict, 'capped')
}

// ---- The offline strip keeps the board closable, and only removes ----
{
  const board = { side: 3, cap: 3, grid: GRID3 }
  const clues = stripOffline(mod, board, 7)
  const all = GRID3.flat().length
  assert.ok(clues.length < all, 'a strip that removes nothing is not a strip')
  assert.ok(clues.every(([r, c]) => r >= 0 && r < 3 && c >= 0 && c < 3))
  const left = score(mod, { side: 3, cap: 3, givens: givensOf(GRID3, clues) })
  assert.strictEqual(left.verdict, 'unique', 'the stripped board must still close')
  assert.deepStrictEqual(left.grid, GRID3, 'and close on the grid it was cut from')

  // Every surviving clue is load-bearing: drop one more and the board opens.
  for (const drop of clues) {
    const rest = clues.filter(p => p !== drop)
    assert.notStrictEqual(
      score(mod, { side: 3, cap: 3, givens: givensOf(GRID3, rest) }).verdict,
      'unique',
      `clue ${drop} was removable and the strip left it in`)
  }
}

// ---- The strip is reproducible from its seed, and the seed changes it ----
{
  const board = { side: 3, cap: 3, grid: GRID3 }
  assert.deepStrictEqual(stripOffline(mod, board, 7), stripOffline(mod, board, 7))
}

// ---- Hardness order: nodes first, passes only as the tie-break ----
{
  const s = (nodes, passes) => ({ nodes, passes })
  assert.ok(harder(s(10, 1), s(9, 999)) > 0, 'more nodes is harder whatever the passes')
  assert.ok(harder(s(9, 999), s(10, 1)) < 0)
  assert.ok(harder(s(10, 20), s(10, 19)) > 0, 'equal nodes break on passes')
  assert.strictEqual(harder(s(10, 20), s(10, 20)), 0)
}

// ---- The hill-climb keeps a mutant only when it is unique AND harder ----
{
  const seed = { label: 'seed-1', score: { verdict: 'unique', nodes: 100, passes: 200 } }
  const mut = (verdict, nodes, passes) => ({
    rngSeed: 42, freed: [[0, 0], [1, 1]], score: { verdict, nodes, passes }
  })

  assert.strictEqual(judgeMutant(seed, mut('unique', 101, 1)).kept, true)
  assert.strictEqual(judgeMutant(seed, mut('unique', 100, 201)).kept, true)
  assert.strictEqual(judgeMutant(seed, mut('unique', 100, 200)).kept, false)
  assert.strictEqual(judgeMutant(seed, mut('unique', 99, 9999)).kept, false)
  // A board with more than one solution is not a puzzle, however long it took.
  assert.strictEqual(judgeMutant(seed, mut('multiple', 9999, 9999)).kept, false)
  // A spent node budget is not a verdict -- the same rule CP-SAT timeouts get.
  assert.strictEqual(judgeMutant(seed, mut('capped', 9999, 9999)).kept, false)
}

// ---- Every judged mutant leaves a record that reproduces it ----
{
  const seed = { label: 'seed-1', score: { verdict: 'unique', nodes: 100, passes: 200 } }
  const { record } = judgeMutant(seed,
    { rngSeed: 42, freed: [[0, 0], [1, 1]], score: { verdict: 'unique', nodes: 150, passes: 210 } })
  assert.deepStrictEqual(record, {
    seed: 'seed-1',
    rngSeed: 42,
    freed: [[0, 0], [1, 1]],
    from: { verdict: 'unique', nodes: 100, passes: 200 },
    to: { verdict: 'unique', nodes: 150, passes: 210 },
    kept: true
  })
}

// ---- Spearman's rho, against hand-worked values ----
{
  const near = (got, want) => assert.ok(Math.abs(got - want) < 1e-9, `${got} != ${want}`)
  near(spearman([1, 2, 3], [1, 2, 3]), 1)
  near(spearman([1, 2, 3], [3, 2, 1]), -1)
  // d = 0, -1, 1 -> 1 - 6*2/(3*(9-1)) = 0.5
  near(spearman([1, 2, 3], [1, 3, 2]), 0.5)
  // Tied ranks average: x ranks 1.5, 1.5, 3 against y ranks 1, 2, 3
  near(spearman([1, 1, 2], [1, 2, 3]), 1.5 / Math.sqrt(3))
  // No spread on one side leaves rho undefined, not zero.
  assert.strictEqual(spearman([1, 1, 1], [1, 2, 3]), null)
}

console.log('hunt-lib.test.mjs: all seams pass')
