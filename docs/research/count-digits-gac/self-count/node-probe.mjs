// Search-node count for a puzzle link, run in the app's own solver bundle in
// Node (#581): the difficulty signal a self-counting draw is ranked on, since
// givens and even-counter counts do not predict it.
//
//   node docs/research/count-digits-gac/self-count/node-probe.mjs <link> [<link>...]
//
// Prints solutions, nodes (SolverState.clone calls, counted by loadBundle's
// `countNodes`) and ms per link. The bundle is loaded through
// examples/_shared/bundle-load.mjs, which hash-guards it. Node ms is a
// ranking, not the number on record (docs/research/429-headless-solver-
// calibration.md); nodes are the steadier signal.
import { decodeLinkFile, buildStartMessage } from '../../../../examples/_shared/bundle-solve-lib.mjs'
import { loadBundle } from '../../../../examples/_shared/bundle-load.mjs'

async function probe (linkFile) {
  const doc = decodeLinkFile(linkFile)
  const b = loadBundle({ expose: ['handleStartMessage', 'LogicStepType'], countNodes: true })
  const w = { ...b.exposed, onmessage: b.onmessage, drain: b.drain }
  const start = buildStartMessage(doc, { stepTypes: Object.values(w.LogicStepType) })
  const realError = console.error
  console.error = (e) => { throw e instanceof Error ? e : new Error(String(e)) }
  try {
    await w.handleStartMessage(start)
    if (!('sudoku' in (w.drain().find(m => m.type === 'init') ?? {}))) throw new Error('init rejected')
    const t0 = process.hrtime.bigint()
    w.onmessage({ data: { type: 'findAll' } })
    const solutions = w.drain().filter(m => m.type === 'update' && m.sudokuData).length
    return { solutions, nodes: b.nodes(), ms: Number(process.hrtime.bigint() - t0) / 1e6 }
  } finally {
    console.error = realError
  }
}

for (const link of process.argv.slice(2)) {
  const r = await probe(link)
  console.log(`${link}  solutions ${r.solutions}  nodes ${r.nodes}  ${r.ms.toFixed(0)}ms`)
}
