// backend-runner.mjs: the one Node board mock and the one backend evaluator.
//   node examples/_shared/backend-runner.test.mjs

import assert from 'assert'
import { mockBoard, runBackend } from './backend-runner.mjs'

// mockBoard's getCellAt takes the column first, as the app's does
// (`getIdFromCoords(e){return e.x+e.y*this.width}` in the shipped bundle). On a
// 5-wide, 3-tall board, column 4 of row 2 is cell 14, written out by hand.
{
  const board = mockBoard({ width: 5, height: 3 })
  assert.deepStrictEqual(board.spec.size, { width: 5, height: 3 })
  assert.strictEqual(board.getCellAt(4, 2), 14, 'getCellAt(col, row): column first')
  assert.strictEqual(board.getCellAt(1, 0), 1)
  assert.strictEqual(board.getCellAt(0, 1), 5)
  assert.strictEqual(board.getRow(14), 2)
  assert.strictEqual(board.getColumn(14), 4)
  assert.strictEqual(board.getRegions, undefined, 'no regions named, no getRegions')
}

// the height defaults to the width; regions come back from getRegions
{
  const board = mockBoard({ width: 4, regions: [[0, 1, 4, 5]] })
  assert.deepStrictEqual(board.spec.size, { width: 4, height: 4 })
  assert.deepStrictEqual(board.getRegions(), [[0, 1, 4, 5]])
}

// a backend's registrations land on `registered`, recorded
{
  const board = mockBoard({ width: 3, height: 2 })
  runBackend('puzzle.addConstraintComponent(new FooComponent("foo", puzzle.getCellAt(2, 1)))', { puzzle: board })
  assert.strictEqual(board.registered.length, 1)
  assert.strictEqual(board.registered[0].ctor, 'FooComponent')
  assert.deepStrictEqual(board.registered[0].args, ['foo', 5])
}

// `ctors` hands in real constructors by name, run instead of recorded; a name
// the source calls that `ctors` lacks is still recorded
{
  const board = mockBoard({ width: 3 })
  const src = 'puzzle.addConstraintComponent(new RealComponent("r", 7)); puzzle.addConstraintComponent(new OtherComponent("o"))'
  const { ctorNames } = runBackend(src, {
    puzzle: board,
    ctors: { RealComponent: function (name, n) { return { built: name, twice: n * 2 } } }
  })
  assert.deepStrictEqual(ctorNames, ['RealComponent', 'OtherComponent'])
  assert.deepStrictEqual(board.registered[0], { built: 'r', twice: 14 })
  assert.strictEqual(board.registered[1].ctor, 'OtherComponent')
}

console.log('backend-runner: column-first board mock, recorded and real constructors')
