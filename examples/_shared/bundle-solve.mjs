// Run SudokuMaker's real solver on a puzzle link, in Node -- no browser (#429).
//
// app-solve.mjs drives the live app in a browser and reads its own printed
// time; that is the number on record for a shipped board, but a browser tab
// per puzzle does not scale past a handful of boards. This loads the same
// renamed solver bundle app-solve.mjs's app runs
// (docs/research/humanify-pedagogy/bundle.claude.js) directly in Node, the
// way docs/research/humanify-pedagogy/tools/bugcheck.mjs loads it for a
// probe, and drives its worker protocol (bundle-solve-lib.mjs) to score
// thousands of puzzles in the time a browser scores a few dozen. The Node
// number is a ranking tool, not the number on record -- see
// docs/research/429-headless-solver-calibration.md.
//
//   node examples/_shared/bundle-solve.mjs <link_file> [reps]
//
// Prints the solution count and the median solve time in ms over `reps`
// (default 3) reps. Decoding shells out to the existing Python link codec
// (examples/_shared/link_codec.py via link_codec_cli.py) -- there is no JS
// LZString decompressor in this repo, and this avoids adding one.

import { decodeLinkFile, solveDocument } from './bundle-solve-lib.mjs'
import { median } from './app-solve-lib.mjs'

function parseArgs (argv) {
  const linkFile = argv[0]
  if (!linkFile) throw new Error('usage: bundle-solve.mjs <link_file> [reps]')
  return { linkFile, reps: parseInt(argv[1] || '3', 10) }
}

const { linkFile, reps } = parseArgs(process.argv.slice(2))
const doc = decodeLinkFile(linkFile)

const times = []
let solutionCount = null
for (let i = 0; i < reps; i++) {
  const { solutions, ms } = await solveDocument(doc)
  if (solutionCount === null) solutionCount = solutions.length
  else if (solutionCount !== solutions.length) {
    throw new Error(`rep ${i}: ${solutions.length} solutions, rep 0 found ${solutionCount}`)
  }
  times.push(ms)
}

console.log(`${linkFile}  (${reps} reps)`)
console.log(`  solutions: ${solutionCount}`)
console.log(`  MEDIAN ${median(times)}ms`)
