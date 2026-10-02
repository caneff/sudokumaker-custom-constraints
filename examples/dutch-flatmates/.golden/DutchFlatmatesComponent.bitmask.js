// Frozen copy of `supportedRows` and `flatmatedRows` as #690 shipped them
// (bit-set row sets), kept so `support-equivalence.test.mjs` can prove the
// plain-language rewrite (#693) keeps exactly the same rows. Never edited.
// Row sets are bit sets: bit `row` is row `row`, 0 = top.

// House column: the rows a 1, a 5 and a 9 can take in some arrangement of one
// of each that the rule allows. A 5 at `row` is supported two ways:
//   1 above: a 1 at row - 1, and a 9 at any other row it can go;
//   9 below: a 9 at row + 1, and a 1 at any other row it can go.
// A row is kept for a digit when some supported 5 uses it, as its partner or as
// the column's other digit. Sound: the true column is such an arrangement, so
// none of its positions is dropped.
function supportedRows (ones, fives, nines, side) {
  let keepOnes = 0
  let keepFives = 0
  let keepNines = 0
  for (let row = 0; row < side; row++) {
    if (!(fives >> row & 1)) continue // no 5 can go here, nothing to support
    const five = 1 << row
    // 1 above. The other 9 cannot sit in the 5's row or the 1's row.
    if (row > 0 && ones >> (row - 1) & 1) {
      const one = 1 << (row - 1)
      const otherNines = nines & ~five & ~one
      if (otherNines !== 0) {
        keepFives |= five
        keepOnes |= one
        keepNines |= otherNines
      }
    }
    // 9 below. The other 1 cannot sit in the 5's row or the 9's row.
    if (row < side - 1 && nines >> (row + 1) & 1) {
      const nine = 1 << (row + 1)
      const otherOnes = ones & ~five & ~nine
      if (otherOnes !== 0) {
        keepFives |= five
        keepNines |= nine
        keepOnes |= otherOnes
      }
    }
  }
  return [keepOnes, keepFives, keepNines]
}

// A column that can repeat: only the 5s that have a 1 above or a 9 below can
// stay, and nothing is known about the 1s and 9s. `ones << 1` moves each 1's row
// down onto the row of the 5 it would sit above, and `nines >> 1` moves each
// 9's row up onto the 5 it would sit below, so the AND keeps the 5s with either.
function flatmatedRows (ones, fives, nines) {
  return [ones, fives & ((ones << 1) | (nines >> 1)), nines]
}
