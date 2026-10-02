// The plain-language `rowsToKeep` (row lists in, row sets out) keeps exactly the
// rows the frozen bit-set functions keep, for every 1/5/9 column state. Two
// references: `.golden/DutchFlatmatesComponent.bitmask.js`, the
// `supportedRows` and `flatmatedRows` functions #690 shipped, and
// `.golden/DutchFlatmatesComponent.floor.js`, the 9^3 loop over (5, 1, 9) row
// triples. This test is the proof that the rewrite is the same deduction, not
// an argument for it.
//
//   node examples/dutch-flatmates/support-equivalence.test.mjs
//
// Exhaustive over every (ones, fives, nines) row-set triple on a column of 3 to
// 7 rows, and on the real 9-row column over a fixed-seed fuzz of sparse, dense
// and half-full sets plus every set with at most two rows per digit.

import { fileURLToPath } from 'url'
import { dirname } from 'path'
import assert from 'assert'
import { installGlobals, makeIo, makeRng } from '../_shared/harness-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const { load } = makeIo(HERE)
installGlobals(1, 9)
const cur = load('DutchFlatmatesComponent.js', ['rowsToKeep', 'rowsToKeepIfRepeatsAllowed'])
const floor = load('.golden/DutchFlatmatesComponent.floor.js', ['supportedRows'])
const frozen = load('.golden/DutchFlatmatesComponent.bitmask.js', ['supportedRows', 'flatmatedRows'])

// The frozen functions speak in bit sets (bit `row` = row), the rewrite in
// ascending row lists and sets of rows; these two translate at the boundary.
const toRows = (mask, side) => Array.from({ length: side }, (_, row) => row).filter(row => mask >> row & 1)
const toMask = rows => [...rows].reduce((mask, row) => mask | 1 << row, 0)
const asMasks = keep => [toMask(keep.ones), toMask(keep.fives), toMask(keep.nines)]

let checked = 0
function same (ones, fives, nines, side) {
  const lists = [ones, fives, nines].map(mask => toRows(mask, side))
  const label = `side ${side}: ones ${ones.toString(2)} fives ${fives.toString(2)} nines ${nines.toString(2)}`
  const house = asMasks(cur.rowsToKeep(...lists))
  assert.deepStrictEqual(house, frozen.supportedRows(ones, fives, nines, side), `${label}: normal column vs frozen`)
  assert.deepStrictEqual(house, floor.supportedRows(ones, fives, nines, side), `${label}: normal column vs floor`)
  assert.deepStrictEqual(asMasks(cur.rowsToKeepIfRepeatsAllowed(...lists)), frozen.flatmatedRows(ones, fives, nines), `${label}: repeating column vs frozen`)
  checked++
}

for (let side = 3; side <= 7; side++) {
  const all = 1 << side
  for (let ones = 0; ones < all; ones++) {
    for (let fives = 0; fives < all; fives++) {
      for (let nines = 0; nines < all; nines++) same(ones, fives, nines, side)
    }
  }
}
console.log(`exhaustive, sides 3-7: ${checked} states equal`)

const SIDE = 9
const { rnd } = makeRng(690)
// a row set at a given density: each row in with probability `p`
const draw = p => { let s = 0; for (let r = 0; r < SIDE; r++) if (rnd() < p) s |= 1 << r; return s }
const before = checked
for (let i = 0; i < 400000; i++) {
  const p = [0.1, 0.2, 0.35, 0.5, 0.8, 1][i % 6]
  same(draw(p), draw(p), draw(p), SIDE)
}
// every state with at most two rows per digit: the sparse corner, where which
// row a partner sits in is what decides
const few = []
for (let a = 0; a < SIDE; a++) for (let b = a; b < SIDE; b++) few.push((1 << a) | (1 << b))
few.push(0)
for (const ones of few) for (const fives of few) for (const nines of few) same(ones, fives, nines, SIDE)
console.log(`side 9, fuzz plus every at-most-two-rows state: ${checked - before} states equal`)
console.log('PASS')
