// A clue given as 0 on a board whose digits start at 0. No run is 0 cells
// long, so validate rejects the filled line; update must stand down rather than
// read the cell before the line: no throw, no removal.

import assert from 'assert'
import { installGlobals, makeIo, makePuzzle, total } from '../_shared/harness-lib.mjs'

const { load } = makeIo(import.meta.dirname)
const mod = load('RunningStartComponent.js', ['setParams', 'update'])

installGlobals(0, 3)
const CLUE = 100
const LINE = [0, 1, 2, 3]
const truth = { [CLUE]: 0, 0: 0, 1: 1, 2: 2, 3: 3 }
const p = makePuzzle(truth, (c, v) => (c === CLUE ? [v] : [0, 1, 2, 3]), { houses: [LINE] })
const inst = {}
mod.setParams(inst, CLUE, LINE)
const before = total(p)
assert.doesNotThrow(() => Array.from(mod.update(inst, p)))
assert.strictEqual(total(p), before, 'a 0 clue removed a candidate')
console.log('PASS')
