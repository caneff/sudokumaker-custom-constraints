// Counts every solution of each document build_docs.py wrote, through the
// real solver bundle (docs/research/367-no-ring-board-type.md).
import { readFileSync } from 'fs'
import { solveDocument } from '../../../examples/_shared/bundle-solve-lib.mjs'
const docs = JSON.parse(readFileSync(process.argv[2], 'utf8'))
for (const [k, d] of Object.entries(docs)) {
  const { solutions } = await solveDocument(d)
  console.log(k, solutions.length)
}
