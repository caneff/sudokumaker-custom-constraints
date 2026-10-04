// The dead-index rule on its own. The never-weaker floors do not witness it:
// at a fixpoint the other rules reach the same cells.

import assert from 'assert'
import { installGlobals, makeIo, makePuzzle } from '../_shared/harness-lib.mjs'

const { load } = makeIo(import.meta.dirname)
const mod = load('NumberedRoomsComponent.js', ['setParams', 'update'])

installGlobals(1, 4)
const CLUE = 100
const LINE = [0, 1, 2, 3]
const start = { [CLUE]: [3], 0: [2], 1: [1, 3, 4], 2: [1, 3, 4], 3: [1, 3, 4] }
const p = makePuzzle(start, c => start[c], { houses: [LINE] })
const inst = {}
mod.setParams(inst, CLUE, LINE)
const changes = Array.from(mod.update(inst, p))
assert.deepStrictEqual([...p._cand.get(2)], [1, 4], 'dead index 3 kept the clue digit')
assert.deepStrictEqual([...p._cand.get(3)], [1, 4], 'dead index 4 kept the clue digit')
assert.deepStrictEqual([...p._cand.get(1)], [3], 'the target is not the clue')
// One plural removal for the dead indices, then one pinning the target.
assert.strictEqual(changes.length, 2, `expected 2 changes, got ${changes.length}`)
console.log('PASS')
