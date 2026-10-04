// The isofill and fillomino mains build their cell list by coordinates. A
// coordinate the board does not have must stay visible: `getIdFromCoordsSafe`
// returns undefined off the board and `undefined | 0` is 0, a real cell, so a
// miss coerced silently repeats cell 0 (#547).
//
// Run: node examples/_shared/whole-grid-mains.test.mjs

import { join } from 'path'
import assert from 'assert'
import { runBackend } from './backend-runner.mjs'
import { assembleSource } from './include.mjs'

const EXAMPLES = join(import.meta.dirname, '..')

function boardFor (W, H, registered = []) {
  return {
    puzzle: {
      spec: { size: { width: W, height: H } },
      addConstraintComponent: c => registered.push(c)
    },
    helpers: {
      cellIds: {
        getIdFromCoordsSafe: ({ x, y }) => (x < 0 || y < 0 || x >= W || y >= H ? undefined : x + y * W)
      }
    }
  }
}

for (const [name, ctor] of [['isofill', 'IsofillComponent'], ['fillomino', 'FillominoComponent']]) {
  const src = assembleSource(join(EXAMPLES, name, 'main.js'))

  // What the backend hands the app, read from the puzzle's side.
  const registered = []
  runBackend(src, boardFor(4, 4, registered))
  assert.deepStrictEqual(registered.map(c => c.ctor), [ctor], `${name}: a square board registers one ${ctor}`)

  assert.throws(() => runBackend(src, boardFor(4, 3)), /square/, `${name}: a board with height under width throws`)
  assert.throws(() => runBackend(src, boardFor(3, 4)), /square/, `${name}: a board with width under height throws`)

  // A miss on a square board (the helper failing) must not become cell 0.
  const missing = boardFor(4, 4)
  missing.helpers.cellIds.getIdFromCoordsSafe = ({ x, y }) => (x === 2 && y === 1 ? undefined : x + y * 4)
  assert.throws(() => runBackend(src, missing), /no cell at x=2, y=1/, `${name}: a coords miss throws`)
}
console.log('whole-grid-mains: ok')
