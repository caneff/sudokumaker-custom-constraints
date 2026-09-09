// The offline fillomino board hunt (#317). Three commands over hunt-lib.mjs.
// The record the acceptance runs left is HUNT.md.
//
// `score` and `strip` also take --node-cap N, which raises the search budget
// for a board the default cannot finish. A spent budget scores `capped`,
// never a verdict.
//
//   node examples/fillomino/hunt.mjs score <link.txt|board.json>...
//       Hardness for each board: verdict, search nodes, propagation passes.
//       A link is read back through hunt_link.py; a JSON board is either
//       {"side","cap","givens"} or the {"grid","clues","cap"} shape
//       generate.py and app-strip.mjs pass around.
//
//   node examples/fillomino/hunt.mjs board <link.txt> <out.json>
//       Write the {"grid","clues","cap"} board a link describes -- the link
//       carries only its givens, so the grid is solved for. `strip` reads
//       this shape.
//
//   node examples/fillomino/hunt.mjs strip <board.json> <out.json> [seed]
//       Greedy given-removal against the offline scorer, app-strip.mjs's
//       order semantics with the app swapped out for the scorer.

import { execFileSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { outputJson } from '../_shared/app-strip-lib.mjs'
import { loadComponent, score, stripOffline, givensOf } from './hunt-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const mod = loadComponent(HERE)

const py = (script, args, input) =>
  JSON.parse(execFileSync('uv', ['run', '--with', 'lzstring', '--with', 'ortools', join(HERE, script), ...args],
    { input, encoding: 'utf8', maxBuffer: 1 << 26 }))

// `--node-cap N` raises the search budget for a board the default cannot
// finish. Reported, never silent: a spent budget scores 'capped'.
function takeNodeCap (args) {
  const i = args.indexOf('--node-cap')
  if (i < 0) return args
  nodeCap = Number(args[i + 1])
  return args.filter((_, k) => k !== i && k !== i + 1)
}

// A board file, as either shape, plus the grid when the file carries one.
function readBoard (path) {
  if (path.endsWith('.txt')) return py('hunt_link.py', [path])
  const doc = JSON.parse(readFileSync(path, 'utf8'))
  if (doc.givens) return doc
  const side = doc.grid.length
  return { side, cap: doc.cap ?? side, givens: givensOf(doc.grid, doc.clues), grid: doc.grid, clues: doc.clues }
}

let nodeCap = 200000
const scoreOf = b => score(mod, b, { nodeCap })

// The {"grid","clues"} shape app-strip.mjs writes, plus the digit cap when the
// board has one -- build_link.py reads `cap` to ship explicit min/maxDigit.
const boardJson = (grid, clues, cap) =>
  cap && cap !== grid.length
    ? JSON.stringify({ ...JSON.parse(outputJson(grid, clues)), cap }) + '\n'
    : outputJson(grid, clues)
const row = (name, s) => `${name}\t${s.verdict}\t${s.nodes}\t${s.passes}`

function cmdScore (argv) {
  const paths = takeNodeCap(argv)
  console.log('board\tverdict\tnodes\tpasses')
  for (const path of paths) console.log(row(path, scoreOf(readBoard(path))))
}

function cmdStrip (argv) {
  const [inPath, outPath, seed = '1'] = takeNodeCap(argv)
  const b = readBoard(inPath)
  if (!b.grid) {
    // A link records its givens, not its grid (the share checklist keeps the
    // solution out of the blob), so solve for the grid first.
    const s = scoreOf(b)
    if (s.verdict !== 'unique') throw new Error(`${inPath} scores ${s.verdict}; nothing to strip from`)
    b.grid = s.grid
  }
  const clues = stripOffline(mod, { side: b.side, cap: b.cap, grid: b.grid }, Number(seed),
    ({ cell, kept }) => process.stderr.write(`${kept ? 'cut ' : 'keep'} ${cell}\n`))
  writeFileSync(outPath, boardJson(b.grid, clues, b.cap))
  console.log(row(outPath, scoreOf({ side: b.side, cap: b.cap, givens: givensOf(b.grid, clues) })))
}

function cmdBoard ([inPath, outPath]) {
  const b = readBoard(inPath)
  const s = scoreOf(b)
  if (s.verdict !== 'unique') throw new Error(`${inPath} scores ${s.verdict}; it has no one grid`)
  const side = b.side
  const clues = Object.keys(b.givens).map(Number).map(i => [Math.floor(i / side), i % side])
  writeFileSync(outPath, boardJson(s.grid, clues, b.cap))
  console.log(row(outPath, s))
}

const [cmd, ...rest] = process.argv.slice(2)
const CMDS = { score: cmdScore, board: cmdBoard, strip: cmdStrip }
if (!CMDS[cmd]) {
  console.error('usage: hunt.mjs score|board|strip ...  (see the header)')
  process.exit(2)
}
CMDS[cmd](rest)
