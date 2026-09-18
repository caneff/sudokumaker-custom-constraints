// The whole-grid mains (isofill, fillomino) hand their component a plain
// integer for every cell id (#450).
//
//   node examples/_shared/whole-grid-backends.test.mjs
//
// `getIdFromCoordsSafe` yields ids that are not plain integers, and the app's
// solver reads them 1.2-1.3x slower until each is coerced with `| 0`
// (docs/gotchas.md #10). Node cannot show that cost, so the mock hands back a
// boxed `new Number(id)` and this checks the coercion itself. The timing rows
// in each example's README are the evidence for the cost.

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import assert from 'assert'
import { runBackend } from './backend-runner.mjs'
import { assembleSource } from './include.mjs'

const EXAMPLES = join(dirname(fileURLToPath(import.meta.url)), '..')

for (const [name, ctor] of [['isofill', 'IsofillComponent'], ['fillomino', 'FillominoComponent']]) {
  for (const side of [4, 9]) {
    const registered = []
    runBackend(assembleSource(join(EXAMPLES, name, 'main.js')), {
      puzzle: {
        spec: { size: { width: side, height: side } },
        addConstraintComponent: c => registered.push(c)
      },
      helpers: {
        cellIds: {
          getIdFromCoordsSafe: ({ x, y }) => new Number(x + y * side) // eslint-disable-line no-new-wrappers -- the point of the test
        }
      }
    })
    const where = `${name} ${side}x${side}`
    assert.strictEqual(registered.length, 1, `${where}: expected one component`)
    assert.strictEqual(registered[0].ctor, ctor, `${where}: wrong component`)
    const cells = registered[0].args.find(a => Array.isArray(a))
    const boxed = cells.filter(c => typeof c !== 'number')
    assert.deepStrictEqual(boxed, [],
      `${where}: ${boxed.length} uncoerced ids; \`| 0\` is load-bearing (docs/gotchas.md #10, #450)`)
    assert.deepStrictEqual(cells, Array.from({ length: side * side }, (_, i) => i),
      `${where}: cells are not the row-major ids`)
  }
}
console.log('whole-grid backends: ok')
