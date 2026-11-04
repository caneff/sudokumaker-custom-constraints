// The fixtures the gate fuzzes are pinned: changing the shipped board
// (`gen.json`) must not change the gate's time. `pinned` is the committed
// 9x9 grid with digits 1-29 (`fixture-9x9.json`); only `shipped` follows
// `gen.json`, and only the harness's small fuzz reads it. Of fillomino's
// scripts, only the files listed here may name `gen.json`: the rest would put
// the shipped board's size into the gate.

import assert from 'assert'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { pinned, shipped, FIXTURES } from './fixture.mjs'

const HERE = import.meta.dirname

assert.deepStrictEqual([pinned.width, pinned.height, pinned.cap], [9, 9, 29], 'the pinned fixture is a 9x9 grid with digits 1-29')
const rowOf = r => Array.from({ length: 9 }, (_, c) => pinned.truth[r * 9 + c]).join('')
assert.deepStrictEqual([rowOf(0), rowOf(8)], ['224122333', '888866244'], 'the pinned fixture is not the committed grid')
assert.ok(FIXTURES.some(([, f]) => f === pinned), 'the gate fixtures include the pinned grid')
assert.ok(!FIXTURES.some(([, f]) => f === shipped), 'the shipped board is outside the gate fixtures')

// Each reads the shipped board on purpose and cheaply: the fixture module, the
// proof and the generator, and the link, generator and offline-solve tests,
// none of which solves the shipped board.
const ALLOWED = ['build_link.test.py', 'fixture.mjs', 'fixture.test.mjs', 'generate.py', 'generate.test.py', 'hunt_offline.test.py', 'verify.py']
const readers = readdirSync(HERE).filter(f => /\.(mjs|py)$/.test(f))
  .filter(f => /gen\.json/.test(readFileSync(join(HERE, f), 'utf8').replace(/^\s*\/\/.*$/gm, '')))
assert.deepStrictEqual(readers, ALLOWED, 'the files naming gen.json changed: a gate suite that reads it makes the gate follow the shipped board')

console.log('PASS')
