// The offline fillomino board hunt (#317). Five commands over hunt-lib.mjs.
// The record the acceptance runs left is HUNT.md.
//
// `score` and `strip` also take --node-cap N, which raises the search budget
// for a board the default cannot finish. A spent budget scores `capped`,
// never a verdict.
//
//   node examples/fillomino/hunt.mjs score [--times <tsv>] <link.txt|board.json>...
//       Hardness for each board: verdict, search nodes, propagation passes.
//       A link is read back through hunt_link.py; a JSON board is either
//       {"side","cap","givens"} or the {"grid","clues","cap"} shape
//       generate.py and app-strip.mjs pass around.
//
//   node examples/fillomino/hunt.mjs board <link.txt> <out.json>
//       Write the {"grid","clues","cap"} board a link describes -- the link
//       carries only its givens, so the grid is solved for. `strip` and
//       `climb` read this shape.
//
//   node examples/fillomino/hunt.mjs strip <board.json> <out.json> [seed]
//       Greedy given-removal against the offline scorer, app-strip.mjs's
//       order semantics with the app swapped out for the scorer.
//
//   node examples/fillomino/hunt.mjs climb <board.json> <out.jsonl> [opts]
//       Adversarial hill-climb: free a few cells, CP-SAT-resample them
//       (hunt_resample.py), keep the mutant when it scores harder and still
//       has one solution. Every mutant judged is logged, kept or not, with
//       the seed and the freed cells that reproduce it.
//       Options: --free K --iters M --restarts R --seed S
//
//   node examples/fillomino/hunt.mjs finalists <n> <board.json>...
//       Rank the boards by offline score and write hunt-finalist-<i>.txt
//       link files for the top n, so the app tools (app-solve.mjs,
//       just time) have the last word on them. An offline score ranks; it
//       never ships as a claim.

import { execFileSync } from 'child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import { fileURLToPath } from 'url'
import { outputJson } from '../_shared/app-strip-lib.mjs'
import { loadComponent, score, stripOffline, givensOf, judgeMutant, harder, spearman } from './hunt-lib.mjs'

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
  const args = takeNodeCap(argv)
  const i = args.indexOf('--times')
  const paths = i < 0 ? args : args.filter((_, k) => k !== i && k !== i + 1)
  console.log('board\tverdict\tnodes\tpasses')
  const scored = paths.map(p => ({ path: p, s: scoreOf(readBoard(p)) }))
  for (const { path, s } of scored) console.log(row(path, s))
  if (i < 0) return
  const times = new Map(readFileSync(args[i + 1], 'utf8').split('\n')
    .filter(l => l.trim() && !l.startsWith('#'))
    .map(l => l.split('\t')).map(([n, ms]) => [n, Number(ms)]))
  const pairs = scored.filter(({ path }) => times.has(basename(path)))
  const rho = spearman(pairs.map(p => p.s.nodes), pairs.map(p => times.get(basename(p.path))))
  console.log(`\nSpearman rho (offline nodes vs recorded cold ms), n=${pairs.length}: ${rho === null ? 'undefined' : rho.toFixed(3)}`)
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

// A deterministic connected patch of `k` cells, so a logged rngSeed replays.
// Connected, not scattered: freeing six cells spread over a 9x9 leaves the
// pinned rest so tight that CP-SAT's only completion is the grid we started
// from, and the mutation does nothing. A patch gives a region room to move.
function freeCells (side, k, rngSeed) {
  const rng = (a => () => { a = (a * 1103515245 + 12345) & 0x7fffffff; return a / 0x7fffffff })(rngSeed)
  const start = Math.floor(rng() * side * side)
  const taken = new Set([start])
  const frontier = [start]
  while (taken.size < k && frontier.length) {
    const i = frontier[Math.floor(rng() * frontier.length)]
    const nbrs = [i - 1, i + 1, i - side, i + side].filter(n =>
      n >= 0 && n < side * side && !taken.has(n) &&
      (n === i - side || n === i + side || Math.floor(n / side) === Math.floor(i / side)))
    if (!nbrs.length) { frontier.splice(frontier.indexOf(i), 1); continue }
    const pick = nbrs[Math.floor(rng() * nbrs.length)]
    taken.add(pick)
    frontier.push(pick)
  }
  return [...taken].sort((a, b) => a - b).map(i => [Math.floor(i / side), i % side])
}

function cmdClimb ([inPath, outPath, ...flags]) {
  const opt = (name, dflt) => { const i = flags.indexOf(`--${name}`); return i < 0 ? dflt : Number(flags[i + 1]) }
  const free = opt('free', 6)
  const iters = opt('iters', 40)
  const restarts = opt('restarts', 3)
  const seed0 = opt('seed', 1)

  const start = readBoard(inPath)
  if (!start.grid || !start.clues) throw new Error(`${inPath} needs both a grid and a clue set`)
  // Both sides go through the same strip, so a comparison reads the board and
  // not the clue count: the mutant's grid is new, so its own clue set has to
  // be cut fresh, and the seed's is cut the same way to match.
  const stripOf = grid => stripOffline(mod, { side: start.side, cap: start.cap, grid }, seed0)
  start.clues = stripOf(start.grid)
  const startScore = scoreOf({ side: start.side, cap: start.cap, givens: givensOf(start.grid, start.clues) })
  // Appended after every draw, not at the end: a climb runs for minutes and a
  // run that dies half way should still leave the draws it made.
  writeFileSync(outPath, '')
  const append = e => appendFileSync(outPath, JSON.stringify(e) + '\n')
  let best = { label: inPath, grid: start.grid, clues: start.clues, score: startScore }
  const overall = best

  for (let r = 0; r < restarts; r++) {
    // Each restart climbs again from the board we came in with, so one bad
    // ridge does not eat the whole budget.
    let cur = { label: `${inPath}#r${r}`, grid: start.grid, clues: start.clues, score: startScore }
    for (let i = 0; i < iters; i++) {
      const rngSeed = seed0 * 1000003 + r * 1009 + i
      const freed = freeCells(start.side, free, rngSeed)
      const res = py('hunt_resample.py', [], JSON.stringify({ grid: cur.grid, cap: start.cap, freed, seed: rngSeed }))
      if (!res.grid) {
        // The pinned rest admits no other filling: a mutation that could not
        // mutate. Logged all the same, so the log accounts for every draw.
        append({ seed: cur.label, rngSeed, freed, resample: 'none', kept: false })
        continue
      }
      const clues = stripOf(res.grid)
      const s = score(mod, { side: start.side, cap: start.cap, givens: givensOf(res.grid, clues) })
      const { kept, record } = judgeMutant(cur, { rngSeed, freed, score: s })
      append(record)
      process.stderr.write(`r${r} i${i} ${kept ? 'KEEP' : 'drop'} ${s.verdict} nodes=${s.nodes}\n`)
      if (kept) cur = { label: `${inPath}#r${r}i${i}`, grid: res.grid, clues, score: s }
    }
    if (harder(cur.score, best.score) > 0) best = cur
  }

  const bestPath = outPath.replace(/\.jsonl$/, '') + '-best.json'
  writeFileSync(bestPath, boardJson(best.grid, best.clues, start.cap))
  console.log(row(`seed ${inPath}`, overall.score))
  console.log(row(`best ${bestPath}`, best.score))
}

// Rank boards by offline score and hand the top n to the app tools. The link
// is built by build_link.py, the same builder PUZZLE_LINK.txt goes through, so
// a finalist board is opened by exactly the shipped component.
function cmdFinalists ([n, ...paths]) {
  const ranked = paths.map(p => { const b = readBoard(p); return { path: p, b, s: scoreOf(b) } })
  ranked.sort((x, y) => harder(y.s, x.s))
  for (const [i, { path, b, s }] of ranked.slice(0, Number(n)).entries()) {
    if (!b.grid || !b.clues) throw new Error(`${path} needs both a grid and a clue set`)
    const stem = join(HERE, `hunt-finalist-${i + 1}`)
    writeFileSync(`${stem}.json`, boardJson(b.grid, b.clues, b.cap))
    execFileSync('uv', ['run', '--with', 'lzstring', join(HERE, 'build_link.py'),
      '--puzzle', `${stem}.json`, '--out', `${stem}.txt`], { stdio: 'inherit' })
    console.log(row(`#${i + 1} ${path} -> ${stem}.txt`, s))
  }
}

const [cmd, ...rest] = process.argv.slice(2)
const CMDS = { score: cmdScore, board: cmdBoard, strip: cmdStrip, climb: cmdClimb, finalists: cmdFinalists }
if (!CMDS[cmd]) {
  console.error('usage: hunt.mjs score|strip|climb|finalists ...  (see the header)')
  process.exit(2)
}
CMDS[cmd](rest)
