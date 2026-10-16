// Tests for hard-sweep-lib.mjs: the pure parts of the cold sweep over a grid
// corpus. The seams: the document a grid becomes (it must be the one
// grid_to_link.py builds), which grids a shard owns, what a resumed shard
// skips, and the ranked table.
// Run: node examples/_shared/hard-sweep-lib.test.mjs

import assert from 'assert'
import { execFileSync } from 'child_process'
import { mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { decodeLinkFile, solveDocument } from './bundle-solve-lib.mjs'
import {
  gridToDoc, parseShard, shardOwns, formatRow, parseRow, doneKeys, rankRows, readGrids
} from './hard-sweep-lib.mjs'

const HERE = import.meta.dirname
const PLATINUM = '.......12........3..23..4....18....5.6..7.8.......9.....85.....9...4.5..47...6...'
// CP-SAT's unique solution (docs/research/429-headless-solver-calibration.md's recipe).
const PLATINUM_SOLUTION = '839465712146782953752391486391824675564173829287659341628537194913248567475916238'
const tmp = mkdtempSync(join(tmpdir(), 'hard-sweep-'))

// gridToDoc swaps a grid into a template and equals the document
// grid_to_link.py builds for the same grid, link round trip included.
{
  const linkFile = join(tmp, 'platinum.txt')
  execFileSync('uv', ['run', join(HERE, 'grid_to_link.py'), PLATINUM, linkFile])
  const built = decodeLinkFile(linkFile)
  const zeros = join(tmp, 'blank.txt')
  execFileSync('uv', ['run', join(HERE, 'grid_to_link.py'), '.'.repeat(81), zeros])
  const template = decodeLinkFile(zeros)
  assert.deepStrictEqual(gridToDoc(template, PLATINUM), built)
  assert.deepStrictEqual(gridToDoc(template, PLATINUM.replace(/\./g, '0')), built)
  assert.throws(() => gridToDoc(template, PLATINUM.slice(1)), /81/)
}

// The harness accepts the document: exactly one solution, the known one.
{
  const zeros = join(tmp, 'blank.txt')
  const doc = gridToDoc(decodeLinkFile(zeros), PLATINUM)
  const { solutions } = await solveDocument(doc)
  assert.deepStrictEqual(solutions, [PLATINUM_SOLUTION])
}

// Shards partition the line numbers: each owned by exactly one of n.
assert.deepStrictEqual(parseShard('2/8'), { index: 2, count: 8 })
for (const bad of ['8/8', '0/0', 'x', '-1/4']) assert.throws(() => parseShard(bad), /shard/)
for (let line = 1; line <= 40; line++) {
  const owners = [0, 1, 2, 3, 4].filter(i => shardOwns({ index: i, count: 5 }, line))
  assert.strictEqual(owners.length, 1)
}

// A row is source, line, solutions, ms; it parses back, and a resumed shard
// skips exactly the keys already on disk.
{
  const row = formatRow({ source: 'royle17', line: 7, solutions: 1, ms: 12.3456 })
  assert.strictEqual(row, 'royle17\t7\t1\t12.35')
  assert.deepStrictEqual(parseRow(row), { source: 'royle17', line: 7, solutions: 1, ms: 12.35 })
  const file = join(tmp, 'shard.tsv')
  writeFileSync(file, row + '\n' + 'top95\t3\t1\t5\n' + 'half-written')
  assert.deepStrictEqual([...doneKeys(file)].sort(), ['royle17\t7', 'top95\t3'])
  assert.deepStrictEqual([...doneKeys(join(tmp, 'absent.tsv'))], [])
}

// The table is slowest first, ties broken by source then line; a grid with
// other than one solution is not dropped.
{
  const rows = [
    { source: 'b', line: 1, solutions: 1, ms: 5 },
    { source: 'a', line: 2, solutions: 1, ms: 9 },
    { source: 'a', line: 1, solutions: 1, ms: 5 },
    { source: 'a', line: 3, solutions: 0, ms: 1 }
  ]
  assert.deepStrictEqual(rankRows(rows).map(r => `${r.source}${r.line}`), ['a2', 'a1', 'b1', 'a3'])
}

// readGrids keeps the line number of the file, blank lines counted.
{
  const file = join(tmp, 'g.txt')
  writeFileSync(file, `${PLATINUM}\n\n${PLATINUM.replace(/\./g, '0')} trailing text\n`)
  assert.deepStrictEqual(readGrids(file).map(g => g.line), [1, 3])
}

console.log('ok')
