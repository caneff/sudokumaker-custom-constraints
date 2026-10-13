// Count the app solver's solutions for an outside-sudoku link and split them
// into distinct inner grids and distinct rings (#398). Lists every solution,
// so it is for boards of a few thousand solutions (the 4x4 and 6x6).
//
//   node docs/research/398-outside-sudoku-not-unique/count.mjs <link_file>

import { decodeLinkFile, solveDocument } from '../../../examples/_shared/bundle-solve-lib.mjs'

const doc = decodeLinkFile(process.argv[2])
const W = doc.puzzle.width
const { solutions } = await solveDocument(doc)
const inner = new Set()
const ring = new Set()
for (const s of solutions) {
  const a = String(s)
  let i = ''
  let r = ''
  for (let k = 0; k < a.length; k++) {
    const row = Math.floor(k / W)
    const c = k % W
    if (row > 0 && row < W - 1 && c > 0 && c < W - 1) i += a[k]
    else r += a[k]
  }
  inner.add(i)
  ring.add(r)
}
console.log(`solutions ${solutions.length}  distinct inner grids ${inner.size}  distinct rings ${ring.size}`)
