// Score every grid of a corpus cold through the headless solver and rank them.
// Each grid gets a fresh bundle load (solveDocument loads one per call), so a
// number is a first solve, not a warmed repeat. The Node number is a ranking
// tool, not the number on record -- docs/research/429-headless-solver-calibration.md.
//
//   node hard-sweep.mjs run --template <blank_link_file> --out <dir> --shard i/n
//       [--skip <grid_file>] <source>=<corpus_file> ...
//   node hard-sweep.mjs merge --out <dir> --table <file>
//
// `run` is one shard: it appends a row per grid to <dir>/shard-i.tsv (flushed
// per row), writes the grid it is on to <dir>/shard-i.cur, and logs a solver
// error to <dir>/shard-i.err and stdout without stopping. A rerun with the
// same arguments resumes. `merge` writes the ranked table. The template is the
// link of grid_to_link.py's board for 81 blanks:
//   uv run examples/_shared/grid_to_link.py ............ (81 dots) <file>

import { appendFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { decodeLinkFile, solveDocument } from './bundle-solve-lib.mjs'
import {
  doneKeys, formatRow, gridToDoc, parseRow, parseShard, rankRows, readGrids, shardOwns
} from './hard-sweep-lib.mjs'

const REPORT_EVERY = 500
const normal = grid => grid.replace(/0/g, '.')

function parseArgs (argv) {
  const opts = { sources: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (['--template', '--out', '--shard', '--skip', '--table'].includes(a)) opts[a.slice(2)] = argv[++i]
    else if (a.includes('=') && !a.startsWith('--')) {
      const at = a.indexOf('=')
      opts.sources.push({ source: a.slice(0, at), file: a.slice(at + 1) })
    } else throw new Error(`unknown argument ${JSON.stringify(a)}`)
  }
  return opts
}

async function run (opts) {
  for (const k of ['template', 'out', 'shard']) if (!opts[k]) throw new Error(`run needs --${k}`)
  const shard = parseShard(opts.shard)
  mkdirSync(opts.out, { recursive: true })
  const template = decodeLinkFile(opts.template)
  const skip = new Set(opts.skip ? readGrids(opts.skip).map(g => normal(g.grid)) : [])
  const tsv = join(opts.out, `shard-${shard.index}.tsv`)
  const cur = join(opts.out, `shard-${shard.index}.cur`)
  const err = join(opts.out, `shard-${shard.index}.err`)
  const done = doneKeys(tsv)
  let scored = 0
  let skipped = 0
  for (const { source, file } of opts.sources) {
    for (const { line, grid } of readGrids(file)) {
      if (!shardOwns(shard, line) || done.has(`${source}\t${line}`)) continue
      if (skip.has(normal(grid))) { skipped++; continue }
      writeFileSync(cur, `${source}\t${line}\t${new Date().toISOString()}\n`)
      try {
        const { solutions, ms } = await solveDocument(gridToDoc(template, grid))
        appendFileSync(tsv, formatRow({ source, line, solutions: solutions.length, ms }) + '\n')
        if (++scored % REPORT_EVERY === 0) console.log(`shard ${shard.index}: ${scored} scored (at ${source} ${line})`)
      } catch (e) {
        const msg = `${source}\t${line}\tERROR\t${String(e.message).split('\n')[0]}`
        appendFileSync(err, msg + '\n')
        console.log(`shard ${shard.index}: ${msg}`)
      }
    }
  }
  console.log(`shard ${shard.index}: done, ${scored} scored, ${skipped} skipped as known misses`)
}

function merge (opts) {
  for (const k of ['out', 'table']) if (!opts[k]) throw new Error(`merge needs --${k}`)
  const rows = []
  for (const name of readdirSync(opts.out).filter(n => /^shard-\d+\.tsv$/.test(n))) {
    for (const text of readFileSync(join(opts.out, name), 'utf8').split('\n')) {
      if (text.split('\t').length === 4) rows.push(parseRow(text))
    }
  }
  const ranked = rankRows(rows)
  writeFileSync(opts.table, 'source\tline\tsolutions\tms\n' + ranked.map(formatRow).join('\n') + '\n')
  const bySolutions = {}
  for (const r of rows) bySolutions[r.solutions] = (bySolutions[r.solutions] ?? 0) + 1
  console.log(`${rows.length} rows; solution counts ${JSON.stringify(bySolutions)}`)
  for (const r of ranked.slice(0, 10)) console.log(formatRow(r))
}

const [command, ...rest] = process.argv.slice(2)
const opts = parseArgs(rest)
if (command === 'run') await run(opts)
else if (command === 'merge') merge(opts)
else throw new Error('usage: hard-sweep.mjs run|merge ...')
