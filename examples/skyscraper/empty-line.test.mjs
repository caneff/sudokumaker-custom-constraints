// A two-wide frame leaves the two-clue skyscraper an empty line. The
// component must stand down: no throw, no removal, no stop, and validate holds on filled clues.
//
//   node examples/skyscraper/empty-line.test.mjs

import assert from 'assert'
import { fileURLToPath } from 'url'
import { dirname } from 'path'
import { installGlobals, makeIo, makePuzzle, total } from '../_shared/harness-lib.mjs'

const { load } = makeIo(dirname(fileURLToPath(import.meta.url)))
const mod = load('SkyscraperLineComponent.js', ['setParams', 'update', 'validate'])

installGlobals(1, 4)
const CA = 100
const CB = 101
const p = makePuzzle({ [CA]: 1, [CB]: 1 }, (c, v) => (c === CA || c === CB ? [v] : [1, 2, 3, 4]), { houses: [[]] })
const inst = {}
mod.setParams(inst, CA, CB, [])
const before = total(p)
assert.doesNotThrow(() => Array.from(mod.update(inst, p)))
assert.strictEqual(total(p), before, 'an empty line removed a candidate')
assert.strictEqual(p._stopped, null, 'an empty line stopped the branch')
assert.strictEqual(mod.validate(inst, p), true)
console.log('PASS')
