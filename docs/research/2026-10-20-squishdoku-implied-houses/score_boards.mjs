// Per board: app logic steps to fixpoint, cells solved, and Node findAll ms
// (median of 3), for the bare/old/new copies make_boards.py wrote.
//
//   node score_boards.mjs <dir>/p*.link.txt
import { loadBundle } from '../../../examples/_shared/bundle-load.mjs'
import { decodeLinkFile, buildStartMessage, solveDocument } from '../../../examples/_shared/bundle-solve-lib.mjs'
import { median } from '../../../examples/_shared/app-solve-lib.mjs'
const rows = {}
for (const file of process.argv.slice(2)) {
  const [, k, tag] = file.match(/p(\d+)_(\w+)\.link/)
  const doc = decodeLinkFile(file)
  const { onmessage, drain, exposed } = loadBundle({ expose: ['handleStartMessage', 'LogicStepType'] })
  await exposed.handleStartMessage(buildStartMessage(doc, { stepTypes: Object.values(exposed.LogicStepType) }))
  drain()
  let steps = 0; let last
  for (;;) { onmessage({ data: { type: 'step' } }); last = drain().find(m => m.type === 'update'); if (!last?.changed) break; steps++ }
  let solved = 0
  for (let i = 0; i < 49; i++) if (last.sudokuData[i * 2] >= 1 && last.sudokuData[i * 2] <= 9) solved++
  const ms = []; let sols
  for (let r = 0; r < 3; r++) { const o = await solveDocument(doc); ms.push(o.ms); sols = o.solutions.length }
  ;(rows[k] ??= {})[tag] = { steps, solved, ms: median(ms), sols }
}
const tags = ['bare', 'old', 'new']
console.log('k  ' + tags.map(t => t.padEnd(22)).join(''))
const tot = Object.fromEntries(tags.map(t => [t, { steps: 0, ms: [], full: 0, bad: 0 }]))
for (const [k, r] of Object.entries(rows)) {
  console.log(k + ' ' + tags.map(t => `${r[t].steps}st ${r[t].solved}c ${r[t].ms.toFixed(1)}ms s${r[t].sols}`.padEnd(22)).join(''))
  for (const t of tags) { tot[t].steps += r[t].steps; tot[t].ms.push(r[t].ms); tot[t].full += r[t].solved === 49; tot[t].bad += r[t].sols !== 1 }
}
for (const t of tags) console.log(t, 'total steps', tot[t].steps, '| median findAll ms', median(tot[t].ms).toFixed(1), '| sum ms', tot[t].ms.reduce((a, b) => a + b).toFixed(0), '| fully logical', tot[t].full, '/' + Object.keys(rows).length, '| non-unique', tot[t].bad)
