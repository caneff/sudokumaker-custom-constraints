// Focused tests of the pure decision/formatting logic used by app-strip.mjs
// (greedy clue removal against the live app), independent of a real browser
// run. Run: node examples/_shared/app-strip-lib.test.mjs

import assert from 'assert'
import { seededShuffle, settleVerdict, outputJson } from './app-strip-lib.mjs'

// ---- seededShuffle: a fixed seed reproduces one exact, known permutation ----
{
  const a = seededShuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 7)
  assert.deepStrictEqual(a, [6, 5, 8, 1, 2, 3, 4, 7, 9, 0])
  const b = seededShuffle([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], 7)
  assert.deepStrictEqual(a, b, 'same seed must reproduce the same order')
}

// ---- settleVerdict: a non-'?' first verdict is final, v2 unread ----
assert.strictEqual(settleVerdict('unique', undefined), 'unique')
assert.strictEqual(settleVerdict('not-unique', undefined), 'not-unique')
assert.strictEqual(settleVerdict('timeout', undefined), 'timeout')

// ---- settleVerdict: a '?' first verdict settles on the retry's verdict, ----
// ---- whatever that is -- never a second retry ----
assert.strictEqual(settleVerdict('?', 'unique'), 'unique')
assert.strictEqual(settleVerdict('?', 'not-unique'), 'not-unique')
assert.strictEqual(settleVerdict('?', '?'), '?')

// ---- output JSON sorts the surviving clues and keeps the grid as given ----
{
  const grid = ['01', '23']
  const json = outputJson(grid, [[1, 1], [0, 0]])
  assert.strictEqual(json, '{"grid":["01","23"],"clues":[[0,0],[1,1]]}\n')
}

console.log('app-strip-lib.test.mjs: all seams pass')
