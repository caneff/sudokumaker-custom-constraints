// One end-to-end test for the hard-classic search (spec #427: slices #429,
// #430, #432; #431 closed unbuilt).
//
// The spec's pipeline, driven at its command lines on a throwaway directory,
// in the order the search ran it:
//
//   1. grid_to_link.py turns a grid string into a link file, and
//      bundle-solve.mjs runs the app's own solver on that file: one solution;
//   2. hard-sweep.mjs `run` scores a small corpus as two shards: each grid is
//      scored by exactly one shard, and a known miss is skipped;
//   3. a shard killed mid-row resumes: the cut-off row is truncated and the
//      grid is scored again, so the table holds every grid once;
//   4. `merge` writes the table slowest first, and refuses, writing nothing,
//      while a shard is not done or a shard logged a solver error (that shard
//      also exits 1);
//
// WHAT A GREEN RUN DOES NOT COVER (this seam is blind to it):
//   - the app: the browser rows on record (#432's top five, `just time-link`)
//     and any solve time in sudokumaker.app. The Node milliseconds here are a
//     ranking, never the number on record (docs/research/
//     429-headless-solver-calibration.md); no browser is opened.
//   - the committed pass-1 record (docs/research/sudoku-hard-corpus-pass1/):
//     its corpora, their provenance, and its sweep table are not read here,
//     since examples/ code does not load docs/research/ (check_layout.py's
//     research rule); nor is the 50,710-grid sweep re-run, an 8-core job.
//
// Run: node examples/_shared/spec_427_closing.test.mjs

import assert from 'assert'
import { execFileSync, spawnSync } from 'child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const HERE = import.meta.dirname
const tmp = mkdtempSync(join(tmpdir(), 'spec-427-'))

// Platinum Blonde's unique solution (hard-sweep-lib.test.mjs); a solved grid
// with one row blanked is unique too and solves in milliseconds.
const SOLVED = '839465712146782953752391486391824675564173829287659341628537194913248567475916238'
const rowBlank = r => SOLVED.slice(0, 9 * r) + '.'.repeat(9) + SOLVED.slice(9 * r + 9)
const GRIDS = [0, 1, 2, 3, 4].map(rowBlank)

const gridToLink = (grid, file) => execFileSync('uv', ['run', join(HERE, 'grid_to_link.py'), grid, file])
const sweep = (...args) => spawnSync('node', [join(HERE, 'hard-sweep.mjs'), ...args], { encoding: 'utf8' })

// 1. a grid string becomes a link the headless solver solves: one solution.
{
  const link = join(tmp, 'grid.txt')
  gridToLink(GRIDS[0], link)
  const out = execFileSync('node', [join(HERE, 'bundle-solve.mjs'), link, '1'], { encoding: 'utf8' })
  assert.match(out, /solutions: 1\n/)
}

const template = join(tmp, 'blank.txt')
gridToLink('.'.repeat(81), template)
const corpus = join(tmp, 'corpus.txt')
writeFileSync(corpus, GRIDS.join('\n') + '\n')
const misses = join(tmp, 'misses.txt')
writeFileSync(misses, GRIDS[2].replace(/\./g, '0') + '\n') // the same grid, spelled with zeros

const runShard = (out, shard, file = corpus) =>
  sweep('run', '--template', template, '--out', out, '--shard', shard, '--skip', misses, `c=${file}`)
const table = (out, file) => sweep('merge', '--out', out, '--table', file)
const tableRows = file => readFileSync(file, 'utf8').trim().split('\n').slice(1).map(t => t.split('\t'))

// 2 and 4. two shards partition the corpus, the known miss is skipped, and
// merge waits for both shards before it writes a table.
{
  const out = join(tmp, 'sweep')
  const first = runShard(out, '0/2')
  assert.strictEqual(first.status, 0, first.stdout + first.stderr)
  const early = table(out, join(out, 'early.tsv'))
  assert.notStrictEqual(early.status, 0)
  assert.match(early.stderr, /merge refused, no table written: shard\(s\) 1 of 2 not done/)
  assert.ok(!existsSync(join(out, 'early.tsv')))

  assert.strictEqual(runShard(out, '1/2').status, 0)
  const merged = table(out, join(out, 'table.tsv'))
  assert.strictEqual(merged.status, 0, merged.stderr)
  const rows = tableRows(join(out, 'table.tsv'))
  assert.deepStrictEqual(rows.map(r => Number(r[1])).sort(), [1, 2, 4, 5]) // line 3 is the miss
  assert.ok(rows.every(r => r[2] === '1'))
  const ms = rows.map(r => Number(r[3]))
  assert.deepStrictEqual(ms, [...ms].sort((a, b) => b - a))

  // 3. a kill mid-row: the cut-off row is truncated and scored again.
  const shard0 = join(out, 'shard-0.tsv')
  const whole = readFileSync(shard0, 'utf8').trim().split('\n')
  writeFileSync(shard0, whole[0] + '\n' + whole[1].split('\t').slice(0, 3).join('\t') + '\t')
  assert.strictEqual(runShard(out, '0/2').status, 0)
  const resumed = readFileSync(shard0, 'utf8').trim().split('\n')
  assert.deepStrictEqual(resumed.map(t => t.split('\t')[1]).sort(), whole.map(t => t.split('\t')[1]).sort())
  assert.strictEqual(table(out, join(out, 'table2.tsv')).status, 0)
  assert.strictEqual(tableRows(join(out, 'table2.tsv')).length, 4)
}

// 4. a solver error: the shard exits 1 and merge refuses.
{
  const out = join(tmp, 'broken')
  const bad = join(tmp, 'bad.txt')
  writeFileSync(bad, GRIDS[0] + '\n' + GRIDS[1].slice(0, 80) + 'x\n')
  const failed = runShard(out, '0/1', bad)
  assert.strictEqual(failed.status, 1, failed.stdout)
  assert.match(failed.stdout, /FAILED, 1 solver error/)
  const refused = table(out, join(out, 'table.tsv'))
  assert.notStrictEqual(refused.status, 0)
  assert.match(refused.stderr, /merge refused, no table written: solver errors in shard-0\.err/)
}

console.log('ok')
