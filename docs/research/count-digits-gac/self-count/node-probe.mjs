// Search-node count for a puzzle link, run in the app's own solver bundle in
// Node (#581): the difficulty signal a self-counting draw is ranked on, since
// givens and even-counter counts do not predict it.
//
//   node docs/research/count-digits-gac/self-count/node-probe.mjs <link> [<link>...]
//
// Prints solutions, nodes (SolverState.clone calls, the way
// required-digits-gac/bundle-probe/hall-in-bundle-probe.mjs counts them) and
// ms per link. The bundle is read verbatim and hash-guarded; the only
// in-memory edit is the export line the other probes use. Node ms is a
// ranking, not the number on record (docs/research/429-headless-solver-
// calibration.md); nodes are the steadier signal.
import fs from 'fs'
import crypto from 'crypto'
import { decodeLinkFile, buildStartMessage } from '../../../../examples/_shared/bundle-solve-lib.mjs'

const REFERENCE = 'docs/research/humanify-pedagogy/bundle.claude.js'
const REFERENCE_SHA = '312461e131246b041caf73b9c53258b940ecc002a85bef3bcf7b0d50bb437066'
const raw = fs.readFileSync(REFERENCE, 'utf8')
if (crypto.createHash('sha256').update(raw).digest('hex') !== REFERENCE_SHA) {
  throw new Error('reference bundle changed; re-read it before trusting this probe')
}
const TAIL = '})();'
const src = raw.trimEnd().slice(0, -TAIL.length) +
  '\n  __expose.handleStartMessage = handleStartMessage\n' +
  '  __expose.LogicStepType = LogicStepType\n' +
  '  __expose.SolverState = SolverState\n' + TAIL

function load () {
  const posted = []
  const expose = {}
  const fn = new Function('self', 'onmessage', 'postMessage', 'addEventListener', '__expose', // eslint-disable-line no-new-func
    src + '\nreturn onmessage')
  const onmessage = fn({}, null, (msg) => posted.push(msg), () => {}, expose)
  return { onmessage, drain: () => posted.splice(0), ...expose }
}

async function probe (linkFile) {
  const doc = decodeLinkFile(linkFile)
  const w = load()
  const start = buildStartMessage(doc, { stepTypes: Object.values(w.LogicStepType) })
  let nodes = 0
  const clone = w.SolverState.prototype.clone
  w.SolverState.prototype.clone = function (...args) { nodes++; return clone.apply(this, args) }
  const realError = console.error
  console.error = (e) => { throw e instanceof Error ? e : new Error(String(e)) }
  try {
    await w.handleStartMessage(start)
    if (!('sudoku' in (w.drain().find(m => m.type === 'init') ?? {}))) throw new Error('init rejected')
    const t0 = process.hrtime.bigint()
    w.onmessage({ data: { type: 'findAll' } })
    const solutions = w.drain().filter(m => m.type === 'update' && m.sudokuData).length
    return { solutions, nodes, ms: Number(process.hrtime.bigint() - t0) / 1e6 }
  } finally {
    console.error = realError
    w.SolverState.prototype.clone = clone
  }
}

for (const link of process.argv.slice(2)) {
  const r = await probe(link)
  console.log(`${link}  solutions ${r.solutions}  nodes ${r.nodes}  ${r.ms.toFixed(0)}ms`)
}
