// Focused tests of the pure decision/formatting logic used by app-strip.mjs
// (greedy clue removal against the live app), independent of a real browser
// run. Run: node examples/_shared/app-strip-lib.test.mjs

import assert from 'assert'
import { seededShuffle, decideRemoval, keptLine, keepLine, minimumLine, outputJson } from './app-strip-lib.mjs'

// ---- seededShuffle: a fixed seed reproduces one exact, known permutation ----
{
  const a = seededShuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 7)
  assert.deepStrictEqual(a, [6, 5, 8, 1, 2, 3, 4, 7, 9, 0])
  const b = seededShuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 7)
  assert.deepStrictEqual(a, b, 'same seed must reproduce the same order')
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

// ---- decideRemoval: one retry on '?', never a second ----
{
  const cases = [
    // [verdict1, verdict2, needsRetry, remove, finalVerdict]
    ['?', null, true, false, '?'], // no second verdict yet -> ask for one retry
    ['?', 'unique', false, true, 'unique'], // retry came back unique -> remove
    ['?', 'not-unique', false, false, 'not-unique'], // retry came back not-unique -> keep
    ['?', '?', false, false, '?'] // retry still '?' -> keep, no further retry
  ]
  for (const [v1, v2, needsRetry, remove, finalVerdict] of cases) {
    const r = decideRemoval(v1, v2)
    assert.strictEqual(r.needsRetry, needsRetry, `needsRetry for (${v1}, ${v2})`)
    assert.strictEqual(r.remove, remove, `remove for (${v1}, ${v2})`)
    assert.strictEqual(r.finalVerdict, finalVerdict, `finalVerdict for (${v1}, ${v2})`)
  }
}

// ---- print lines ----
assert.strictEqual(keptLine(34, 'unique', 200), '34 givens  unique  200 ms')
assert.strictEqual(keepLine(2, 5, 'not-unique'), 'keep (2,5)  (not-unique)')
assert.strictEqual(minimumLine(35), 'minimum 35 givens')

// ---- output JSON sorts the surviving clues and keeps the grid as given ----
{
  const grid = ['01', '23']
  const json = outputJson(grid, [[1, 1], [0, 0]])
  assert.strictEqual(json, '{"grid":["01","23"],"clues":[[0,0],[1,1]]}\n')
}

console.log('app-strip-lib.test.mjs: all seams pass')
