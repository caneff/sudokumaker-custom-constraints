// The grid-neighbour helper takes the board's width and height, so a board that
// is not a square gets its own rows and columns (#866).
//
//   node examples/_shared/dominator.test.mjs

import { join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'

const SRC = readFileSync(join(import.meta.dirname, 'dominator.js'), 'utf8')
// The app runs the file as a bare script spliced into a component, so load it
// the same way: a function body that hands back what it declares.
const { neighbours } = new Function(`${SRC}\n;return { neighbours }`)() // eslint-disable-line no-new-func

const sorted = (i, w, h) => neighbours(i, w, h).sort((a, b) => a - b)

// 3 wide, 2 tall, row-major: 0 1 2 / 3 4 5.
assert.deepStrictEqual(sorted(0, 3, 2), [1, 3])
assert.deepStrictEqual(sorted(1, 3, 2), [0, 2, 4])
assert.deepStrictEqual(sorted(2, 3, 2), [1, 5])
assert.deepStrictEqual(sorted(4, 3, 2), [1, 3, 5])
assert.deepStrictEqual(sorted(5, 3, 2), [2, 4])

// 2 wide, 3 tall: 0 1 / 2 3 / 4 5. The last row is the height's, not the width's.
assert.deepStrictEqual(sorted(3, 2, 3), [1, 2, 5])
assert.deepStrictEqual(sorted(4, 2, 3), [2, 5])

// A square gives the same answer as before the change.
assert.deepStrictEqual(sorted(4, 3, 3), [1, 3, 5, 7])
console.log('dominator.test.mjs: ok')
