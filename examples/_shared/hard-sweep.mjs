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
// error to <dir>/shard-i.err and stdout without stopping. A shard with no
// error writes <dir>/shard-i.done (`i/n`), removes its .cur and exits 0; one
// with an error exits 1. A rerun with the same arguments resumes, truncating
// a row a kill cut off. `merge` writes the ranked table only when every shard
// 0..n-1 is done and no .err file holds a line; otherwise it refuses, naming
// what is missing, and writes nothing. The template is the
// link of grid_to_link.py's board for 81 blanks:
//   uv run examples/_shared/grid_to_link.py ............ (81 dots) <file>

import { appendFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { decodeLinkFile, solveDocument } from './bundle-solve-lib.mjs'
import {
  doneKeys, formatRow, gridToDoc, parseShard, rankRows, readGrids, readRows, shardOwns
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
  const marker = join(opts.out, `shard-${shard.index}.done`)
  rmSync(marker, { force: true })
  rmSync(err, { force: true })
  const done = doneKeys(tsv)
  let scored = 0
  let skipped = 0
  let errors = 0
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
        errors++
      }
    }
  }
  rmSync(cur, { force: true })
  if (errors) {
    console.log(`shard ${shard.index}: FAILED, ${errors} solver error(s) in ${err}; ${scored} scored`)
    process.exitCode = 1
    return
  }
  writeFileSync(marker, `${shard.index}/${shard.count}\n`)
  console.log(`shard ${shard.index}: done, ${scored} scored, ${skipped} skipped as known misses`)
}

// Why `merge` must not write a table from `out`, or null: a shard not done,
// shards that disagree on n, or an .err file with a line.
function incomplete (out) {
  const names = readdirSync(out)
  const errs = names.filter(n => /^shard-\d+\.err$/.test(n) && readFileSync(join(out, n), 'utf8').trim())
  if (errs.length) return `solver errors in ${errs.join(', ')}`
  const marks = names.filter(n => /^shard-\d+\.done$/.test(n))
    .map(n => readFileSync(join(out, n), 'utf8').trim())
  const counts = new Set(marks.map(m => parseShard(m).count))
  if (!marks.length) return 'no shard is done'
  if (counts.size !== 1) return `shards done: ${JSON.stringify(marks.sort())}, want one n`
  const [count] = counts
  const missing = [...Array(count).keys()].filter(i => !marks.includes(`${i}/${count}`))
  if (missing.length) return `shard(s) ${missing.join(', ')} of ${count} not done`
  const stray = names.filter(n => /^shard-(\d+)\.tsv$/.test(n) && Number(n.match(/\d+/)[0]) >= count)
  if (stray.length) return `${stray.join(', ')} outside ${count} shards`
  return null
}

function merge (opts) {
  for (const k of ['out', 'table']) if (!opts[k]) throw new Error(`merge needs --${k}`)
  const why = incomplete(opts.out)
  if (why) throw new Error(`merge refused, no table written: ${why}`)
  const rows = readdirSync(opts.out).filter(n => /^shard-\d+\.tsv$/.test(n))
    .flatMap(name => readRows(join(opts.out, name)))
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
