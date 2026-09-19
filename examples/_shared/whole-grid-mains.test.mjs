// The isofill and fillomino mains build their cell list by coordinates. A
// coordinate the board does not have must stay visible: `getIdFromCoordsSafe`
// returns undefined off the board and `undefined | 0` is 0, a real cell, so a
// miss coerced silently repeats cell 0 (#547).
//
// Run: node examples/_shared/whole-grid-mains.test.mjs

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { readFileSync } from 'fs'
import assert from 'assert'
import { runBackend } from './backend-runner.mjs'

const EXAMPLES = join(dirname(fileURLToPath(import.meta.url)), '..')

function boardFor (W, H) {
  return {
    puzzle: {
      spec: { size: { width: W, height: H } },
      addConstraintComponent: () => {}
    },
    helpers: {
      cellIds: {
        getIdFromCoordsSafe: ({ x, y }) => (x < 0 || y < 0 || x >= W || y >= H ? undefined : x + y * W)
      }
    }
  }
}

for (const [name, ctor] of [['isofill', 'IsofillComponent'], ['fillomino', 'FillominoComponent']]) {
  const src = readFileSync(join(EXAMPLES, name, 'main.js'), 'utf8')

  const square = runBackend(src, boardFor(4, 4))
  assert.ok(square.ctorNames.includes(ctor), `${name}: a square board registers ${ctor}`)

  assert.throws(() => runBackend(src, boardFor(4, 3)), /square/, `${name}: a board with height under width throws`)
  assert.throws(() => runBackend(src, boardFor(3, 4)), /square/, `${name}: a board with width under height throws`)

  // A miss on a square board (the helper failing) must not become cell 0.
  const missing = boardFor(4, 4)
  missing.helpers.cellIds.getIdFromCoordsSafe = ({ x, y }) => (x === 2 && y === 1 ? undefined : x + y * 4)
  assert.throws(() => runBackend(src, missing), /coordinate|cell/i, `${name}: a coords miss throws`)
}
console.log('whole-grid-mains: ok')
