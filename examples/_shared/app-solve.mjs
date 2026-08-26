// Time the REAL SudokuMaker solver on a puzzle link, in the live app.
//
// The recovery probes in this repo time our own GAC + DFS mock. That measures
// deduction strength, not what the app does: SudokuMaker has its own solver,
// and a custom component's `update` is called inside it. This driver runs that
// solver and times it, so "a deduction must pay for itself in solve time"
// (CODING_STANDARDS.md) is judged on the engine that ships, not on a stand-in.
//
// How it works: the app's solver runs in a Web Worker and speaks a small
// message protocol -- `start` -> `init` (compile + set up the constraint),
// then `findNext` -> `update` (search to the next solution). "Check unique"
// finds the first solution, then searches again to prove no second exists.
// This driver wraps `window.Worker` to timestamp those messages, clicks the
// "check unique" button, and waits for the verdict text.
//
//   npm i            # once: installs playwright (a devDependency)
//   npx playwright install chromium
//   node examples/_shared/app-solve.mjs <link_file> [reps] [button_index]
//
// The link must be a PROBE link (interior emptied -- see probe_link.py). A
// finished link stores the full solution, so the solver only verifies it and
// every code variant looks equally fast.
//
// ponytail: the solver controls are icon buttons with no labels, so the "check
// unique" one is addressed by its position among `.LargeIconButton` (default
// index 4). SudokuMaker is pre-release; if the toolbar order changes, re-probe
// the indices (click each, see which prints "unique!") and pass the new one.

import { chromium } from 'playwright'
import fs from 'fs'

const linkFile = process.argv[2]
const reps = parseInt(process.argv[3] || '7', 10)
const button = parseInt(process.argv[4] || '4', 10)
if (!linkFile) throw new Error('usage: app-solve.mjs <link_file> [reps] [button_index]')
const link = fs.readFileSync(linkFile, 'utf8').trim()

const VERDICT = /(unique!|not unique|no solutions?|solution amount limit|reached the)/i

// Installed in the page before any app code, so it wraps the Worker the app
// creates. Records {dir, label, t} for every message in/out, on a clock that
// starts at page load.
function instrumentWorker () {
  window.__solverLog = []
  const t0 = performance.now()
  const label = m => {
    try { return (m && (m.type || m.method)) || '' } catch { return '' }
  }
  const Native = window.Worker
  window.Worker = class extends Native {
    constructor (...args) {
      super(...args)
      this.addEventListener('message', e =>
        window.__solverLog.push({ dir: 'in', label: label(e.data), t: performance.now() - t0 }))
      const post = this.postMessage.bind(this)
      this.postMessage = (m, ...rest) => {
        window.__solverLog.push({ dir: 'out', label: label(m), t: performance.now() - t0 })
        return post(m, ...rest)
      }
    }
  }
}

async function runOnce (page) {
  await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(1500)
  await page.evaluate(() => { window.__solverLog.length = 0 }) // drop load traffic
  await page.$$eval('button.LargeIconButton', (els, i) => els[i] && els[i].click(), button)
  try {
    await page.waitForFunction(re => new RegExp(re, 'i').test(document.body.innerText),
      VERDICT.source, { timeout: 120000 })
  } catch { /* fall through; a missing verdict shows as null timings */ }
  await page.waitForTimeout(300)

  const log = await page.evaluate(() => window.__solverLog)
  const verdict = await page.evaluate(() =>
    document.body.innerText.match(/(unique!|not unique|no solutions?|has a solution)[^\n]{0,20}/gi)?.slice(0, 3) || [])
  const find = l => log.find(m => m.label === l)
  const start = find('start')
  const init = find('init')
  const firstUpdate = log.find(m => m.dir === 'in' && m.label === 'update')
  const lastIn = [...log].reverse().find(m => m.dir === 'in')
  const ms = (a, b) => (a && b) ? Math.round(b.t - a.t) : null
  return {
    total: ms(start, lastIn), // start -> last worker reply (both solutions)
    setup: ms(start, init), // start -> init (compile + set up constraint)
    firstSolution: ms(init, firstUpdate), // init -> first solution found
    verdict
  }
}

const median = xs => {
  const s = xs.filter(x => x != null).sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : null
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
await context.addInitScript(instrumentWorker)

const rows = []
for (let k = 0; k < reps; k++) {
  const page = await context.newPage()
  rows.push(await runOnce(page))
  await page.close()
}
await browser.close()

console.log(`${linkFile}  (button ${button}, ${reps} reps)`)
for (const r of rows) {
  console.log(`  total ${r.total}ms  setup ${r.setup}  first-solution ${r.firstSolution}  ${JSON.stringify(r.verdict)}`)
}
console.log(`  MEDIAN total ${median(rows.map(r => r.total))}ms  setup ${median(rows.map(r => r.setup))}  first-solution ${median(rows.map(r => r.firstSolution))}`)
