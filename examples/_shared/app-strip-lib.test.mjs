// Focused tests of the pure decision/formatting logic used by app-strip.mjs
// (greedy clue removal against the live app), independent of a real browser
// run. Run: node examples/_shared/app-strip-lib.test.mjs

import assert from 'assert'
import { parseArgs, seededShuffle, settleVerdict, outputJson } from './app-strip-lib.mjs'

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

// ---- parseArgs: the driver's command line ----
{
  // the documented order, seed given
  assert.deepStrictEqual(
    parseArgs(['link.txt', 'out.json', '5', '--grid', 'puzzle.json']),
    { linkFile: 'link.txt', outFile: 'out.json', gridFile: 'puzzle.json', seed: 5 }
  )

  // no seed: seed 1, so a run is reproducible without asking for one
  assert.strictEqual(
    parseArgs(['link.txt', 'out.json', '--grid', 'puzzle.json']).seed, 1
  )

  // --grid may sit anywhere: it and its value never become positionals
  assert.deepStrictEqual(
    parseArgs(['--grid', 'puzzle.json', 'link.txt', 'out.json', '9']),
    { linkFile: 'link.txt', outFile: 'out.json', gridFile: 'puzzle.json', seed: 9 }
  )
  assert.deepStrictEqual(
    parseArgs(['link.txt', '--grid', 'puzzle.json', 'out.json']),
    { linkFile: 'link.txt', outFile: 'out.json', gridFile: 'puzzle.json', seed: 1 }
  )

  // every missing path is a usage error, never a run with a null path -- a
  // missing --grid in particular would otherwise strip clues from a grid the
  // driver never read
  const incomplete = [
    [],
    ['link.txt'],
    ['link.txt', 'out.json'], // no --grid
    ['link.txt', '--grid', 'puzzle.json'], // no out file
    ['--grid', 'puzzle.json'], // no link file
    ['link.txt', 'out.json', '--grid'] // --grid with no value
  ]
  for (const argv of incomplete) {
    assert.throws(() => parseArgs(argv), /usage: app-strip.mjs/, `accepted ${JSON.stringify(argv)}`)
  }
}

console.log('app-strip-lib.test.mjs: all seams pass')
