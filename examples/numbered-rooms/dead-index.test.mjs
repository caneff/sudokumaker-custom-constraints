// The dead-index rule (update's step 3) on its own. On a house with the clue
// solved to c, c sits at the target, so every cell at a dead index loses c --
// in one plural change, not one per cell. The never-weaker floors do not
// witness this rule: at a fixpoint the other steps reach the same cells.
//
//   node examples/numbered-rooms/dead-index.test.mjs

import assert from 'assert'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo, makePuzzle } from '../_shared/harness-lib.mjs'

const { load } = makeIo(dirname(fileURLToPath(import.meta.url)))
const mod = load('NumberedRoomsComponent.js', ['setParams', 'update'])

installGlobals(1, 4)
const CLUE = 100
const LINE = [0, 1, 2, 3]
// Clue 3; the index line[0] is 2, so line[1] is the target and indices 3 and 4
// are dead. line[2] and line[3] still allow 3.
const start = { [CLUE]: [3], 0: [2], 1: [1, 3, 4], 2: [1, 3, 4], 3: [1, 3, 4] }
const p = makePuzzle(start, c => start[c], { houses: [LINE] })
const inst = {}
mod.setParams(inst, CLUE, LINE)
const changes = Array.from(mod.update(inst, p))
assert.deepStrictEqual([...p._cand.get(2)], [1, 4], 'dead index 3 kept the clue digit')
assert.deepStrictEqual([...p._cand.get(3)], [1, 4], 'dead index 4 kept the clue digit')
assert.deepStrictEqual([...p._cand.get(1)], [3], 'the target is not the clue')
// Step 3's one plural removal, then step 4 pinning the target.
assert.strictEqual(changes.length, 2, `expected 2 changes, got ${changes.length}`)
console.log('PASS')
