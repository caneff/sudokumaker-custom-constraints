// The readable `supportedRows` keeps exactly the rows the frozen triple loop
// keeps, for every 1/5/9 column state. The reference is the floor's own
// function, `.golden/DutchFlatmatesComponent.floor.js` (the 9^3 loop over
// (5, 1, 9) row triples); this test is the proof that the rewrite is the same
// deduction, not an argument for it.
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
const cur = load('DutchFlatmatesComponent.js', ['supportedRows'])
const ref = load('.golden/DutchFlatmatesComponent.floor.js', ['supportedRows'])

let checked = 0
function same (ones, fives, nines, side) {
  const got = cur.supportedRows(ones, fives, nines, side)
  const want = ref.supportedRows(ones, fives, nines, side)
  assert.deepStrictEqual(got, want, `side ${side}: ones ${ones.toString(2)} fives ${fives.toString(2)} nines ${nines.toString(2)}`)
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
