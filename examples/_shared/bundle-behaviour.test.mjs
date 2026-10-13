// Tests for three behaviours of the vendored solver bundle that
// docs/research/bundle-api-reference.md describes: the straight ray from each
// bottom outer corner, groupsArePolarityPair, and DifferentGroups.getIsDone.
// `verify.mjs` compares the renamed bundle with the minified chunk modulo
// identifier names, so a swapped property name or case label is visible only here.
// Run: node examples/_shared/bundle-behaviour.test.mjs

import assert from 'assert'
import { loadBundle } from './bundle-load.mjs'

const { exposed: B } = loadBundle({
  expose: ['createHelpers', 'groupsArePolarityPair', 'SudokuDigitSet', 'DifferentGroupsComponent']
})
const spec = { size: { width: 9, height: 9 }, minDigit: 1, maxDigit: 9, type: 'sudoku' }
const digits = (...ds) => +B.SudokuDigitSet.from(ds)

// getCoordsPointedAtByOuterClue: a straight ray starts at its own corner.
{
  const h = B.createHelpers(spec)
  const start = coords => {
    const id = h.outerCellIds.getIdFromCoords(coords)
    const [first] = h.geometry.getCoordsPointedAtByOuterClue(id, undefined)
    return `${first.x},${first.y}`
  }
  assert.strictEqual(start({ x: -1, y: -1 }), '0,0')
  assert.strictEqual(start({ x: 9, y: -1 }), '8,0')
  assert.strictEqual(start({ x: 9, y: 9 }), '8,8')
  assert.strictEqual(start({ x: -1, y: 9 }), '0,8')
}

// groupsArePolarityPair: only the low half with the high half is a pair.
{
  const low = digits(1, 2, 3, 4)
  const high = digits(6, 7, 8, 9)
  assert.strictEqual(B.groupsArePolarityPair([low, high], spec), true)
  assert.strictEqual(B.groupsArePolarityPair([low, low], spec), false)
  assert.strictEqual(B.groupsArePolarityPair([low, digits(5)], spec), false)
  assert.strictEqual(B.groupsArePolarityPair([high, digits(1)], spec), false)
}

// DifferentGroups.getIsDone: done when no two cells touch a common group.
{
  const comp = new B.DifferentGroupsComponent('dg', [digits(1, 2, 3), digits(4, 5, 6)], [0, 1])
  const state = (...candidates) => ({ cells: candidates.map(c => ({ candidates: c })) })
  assert.strictEqual(comp.getIsDone(state(digits(1, 2), digits(4, 5))), true)
  assert.strictEqual(comp.getIsDone(state(digits(1, 2), digits(3, 4))), false)
}

console.log('bundle-behaviour: corner rays, polarity pair, DifferentGroups getIsDone ok')
