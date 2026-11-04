// The fixtures the gate fuzzes are pinned: changing the shipped board
// (`gen.json`) must not change the gate's time. `pinned` is the committed
// 9x9 grid (`fixture-9x9.json`); only `shipped` follows `gen.json`, and only
// the harness's small fuzz reads it. No other .mjs suite may read `gen.json`.

import assert from 'assert'
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { pinned, shipped, FIXTURES } from './fixture.mjs'

const HERE = import.meta.dirname

assert.deepStrictEqual([pinned.width, pinned.height, pinned.cap], [9, 9, 29], 'the pinned fixture is the old 9x9 grid, digits 1-29')
assert.ok(FIXTURES.some(([, f]) => f === pinned), 'the gate fixtures include the pinned grid')
assert.ok(!FIXTURES.some(([, f]) => f === shipped), 'the shipped board is outside the gate fixtures')

const readers = readdirSync(HERE).filter(f => f.endsWith('.mjs') && !f.endsWith('.test.mjs') && f !== 'fixture.mjs')
  .concat(readdirSync(HERE).filter(f => f.endsWith('.test.mjs') && f !== 'fixture.test.mjs'))
  .filter(f => /gen\.json/.test(readFileSync(join(HERE, f), 'utf8').replace(/\/\/.*$/gm, '')))
assert.deepStrictEqual(readers, [], 'only fixture.mjs reads gen.json')

console.log('PASS')
