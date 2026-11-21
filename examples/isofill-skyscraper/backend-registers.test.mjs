// What main-global.js registers: one IsofillComponent over the 9x9 interior
// and one one-sided skyscraper component per ring clue (4 sides x 9 lines),
// and nothing else. A clue line left unregistered or a second kind of
// component would pass the fixpoint harnesses quietly on some boards, so the
// count is held here.
//
// The skyscraper component must hide a tie (ALLOW_TIES = false): an ISOFILL
// line repeats digits, and a clue that counted a tie would be another rule.

import assert from 'assert'
import { readFileSync } from 'fs'
import { join } from 'path'
import { makeIo } from '../_shared/harness-lib.mjs'
import { mockBoard, runBackend } from '../_shared/backend-runner.mjs'

const HERE = import.meta.dirname
const { read } = makeIo(HERE)

const puzzle = mockBoard({ width: 11, height: 11 })
runBackend(read('main-global.js'), { puzzle, helpers: { naming: { getCellName: c => `c${c}` } } })
const by = ctor => puzzle.registered.filter(c => c.ctor === ctor)

// args: name, cells, width, height
assert.deepStrictEqual(by('IsofillComponent').map(c => [c.args[2], c.args[3], c.args[1].length]), [[9, 9, 81]])
assert.strictEqual(by('SkyscraperOneSidedComponent').length, 36)
assert.strictEqual(puzzle.registered.length, 37, 'only those two kinds are registered')

// A rectangular interior: the component is handed the interior's own width and
// height, not the board's or the longer side.
const rect = mockBoard({ width: 6, height: 5 })
runBackend(read('main-global.js'), { puzzle: rect, helpers: { naming: { getCellName: c => `c${c}` } } })
const isofill = rect.registered.filter(c => c.ctor === 'IsofillComponent')
assert.deepStrictEqual(isofill.map(c => [c.args[2], c.args[3], c.args[1].length]), [[4, 3, 12]])
assert.strictEqual(rect.registered.length, 1 + 2 * (4 + 3))

const sky = readFileSync(join(HERE, 'SkyscraperOneSidedComponent.js'), 'utf8')
assert.ok(sky.includes('const ALLOW_TIES = false'), 'a tie is hidden')
console.log('PASS')
