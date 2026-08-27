// Focused tests of the pure decision/formatting logic used by app-strip.mjs
// (greedy clue removal against the live app), independent of a real browser
// run. Run: node examples/_shared/app-strip-lib.test.mjs

import assert from 'assert'
import { seededShuffle, decideRemoval, keptLine, keepLine, minimumLine, outputJson } from './app-strip-lib.mjs'

// ---- seededShuffle: same seed -> same order, different seed -> (usually) different order ----
{
  const a = seededShuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 7)
  const b = seededShuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 7)
  assert.deepStrictEqual(a, b, 'same seed must reproduce the same order')
  assert.strictEqual(a.length, 10)
  assert.deepStrictEqual([...a].sort((x, y) => x - y), [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 'a shuffle is a permutation')
  const c = seededShuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 8)
  assert.notDeepStrictEqual(a, c, 'a different seed should (for this input) reorder differently')
}

// ---- decideRemoval: a unique verdict on the first attempt removes the clue, no retry ----
{
  const r = decideRemoval('unique')
  assert.strictEqual(r.needsRetry, false)
  assert.strictEqual(r.remove, true)
  assert.strictEqual(r.finalVerdict, 'unique')
}

// ---- decideRemoval: not-unique keeps the given, no retry ----
{
  const r = decideRemoval('not-unique')
  assert.strictEqual(r.needsRetry, false)
  assert.strictEqual(r.remove, false)
  assert.strictEqual(r.finalVerdict, 'not-unique')
}

// ---- decideRemoval: a timeout keeps the given, no retry ----
{
  const r = decideRemoval('timeout')
  assert.strictEqual(r.needsRetry, false)
  assert.strictEqual(r.remove, false)
  assert.strictEqual(r.finalVerdict, 'timeout')
}

// ---- decideRemoval: a first '?' with no second verdict yet asks for one retry ----
{
  const r = decideRemoval('?')
  assert.strictEqual(r.needsRetry, true)
  assert.strictEqual(r.remove, false)
  assert.strictEqual(r.finalVerdict, '?')
}

// ---- decideRemoval: '?' then 'unique' on retry removes the clue ----
{
  const r = decideRemoval('?', 'unique')
  assert.strictEqual(r.needsRetry, false)
  assert.strictEqual(r.remove, true)
  assert.strictEqual(r.finalVerdict, 'unique')
}

// ---- decideRemoval: '?' then '?' again keeps the given -- one retry only, never a loop ----
{
  const r = decideRemoval('?', '?')
  assert.strictEqual(r.needsRetry, false)
  assert.strictEqual(r.remove, false)
  assert.strictEqual(r.finalVerdict, '?')
}

// ---- print lines match the format proto_strip_app.py established ----
assert.strictEqual(keptLine(34, 'unique', 200), '34 givens  unique  200 ms')
assert.strictEqual(keptLine(34, 'unique', null), '34 givens  unique  null ms')
assert.strictEqual(keepLine([2, 5], 'not-unique'), 'keep (2,5)  (not-unique)')
assert.strictEqual(minimumLine(35), 'minimum 35 givens')

// ---- output JSON sorts the surviving clues and keeps the grid as given ----
{
  const grid = ['01', '23']
  const json = outputJson(grid, [[1, 1], [0, 0]])
  assert.strictEqual(json, JSON.stringify({ grid, clues: [[0, 0], [1, 1]] }) + '\n')
}

console.log('app-strip-lib.test.mjs: all seams pass')
