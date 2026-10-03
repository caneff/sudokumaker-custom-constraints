/* eslint-disable no-unused-vars -- read by the components that include this file, not from here */
// The visit-stamp wrap guard ISOFILL and FILLOMINO share. A walk marks a cell
// visited by writing the walk's stamp into a typed array, so a counter that
// outgrew the array's element would store something else and every cell would
// read as unvisited. One copy, spliced into each component by
// `// #include ../_shared/stamp.js` (examples/_shared/minify.py). Not a
// module: the app runs the assembled component as a bare script.

// The stamp after `stamp`, for the array `marks` it is written into: clear the
// array and restart at 1 when the next one would not fit the element type
// (2^31 - 1 for Int32Array, 2^32 - 1 for Uint32Array), one step early.
function bumpStamp (marks, stamp) {
  const cap = marks instanceof Int32Array ? 0x7FFFFFFF : 0xFFFFFFFF
  if (stamp >= cap) { marks.fill(0); return 1 }
  return stamp + 1
}
