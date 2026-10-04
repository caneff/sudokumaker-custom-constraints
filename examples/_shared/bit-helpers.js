/* eslint-disable no-unused-vars -- read by the components that include this file, not from here */
// The single-bit helpers the subset-walking GAC components share: HOUSE GAC
// and REQUIRED DIGITS GAC both count through a bitmask of cells, taking the
// lowest set bit off each time. One copy, spliced into each component by
// `// #include ../_shared/bit-helpers.js` (examples/_shared/minify.py). Not a
// module: the app runs the assembled component as a bare script.

function lowestBit (bits) {
  return bits & -bits
}

function withoutLowestBit (bits) {
  return bits & (bits - 1)
}

//! The index of a single set bit: 1 -> 0, 2 -> 1, 4 -> 2, ...
function positionOf (singleBit) {
  return 31 - Math.clz32(singleBit)
}
