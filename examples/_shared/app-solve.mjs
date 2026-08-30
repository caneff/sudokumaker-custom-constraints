// Time the REAL SudokuMaker solver on a puzzle link, in the live app.
//
// The recovery probes in this repo time our own GAC + DFS mock. That measures
// deduction strength, not what the app does: SudokuMaker has its own solver,
// and a custom component's `update` is called inside it. This driver runs that
// solver and times it, so "a deduction must pay for itself in solve time"
// (CODING_STANDARDS.md) is judged on the engine that ships, not on a stand-in.
//
// It clicks the app's "Find all solutions and valid candidates" button and
// reads the time the app prints ("took 3.7s"). That button runs the solver
// across the whole search to prove uniqueness, so it exercises the custom
// component's `update` on every node -- the work we want to time. Reading the
// app's own readout, not a self-computed clock, keeps this honest: it is the
// same number you see when you click the button by hand.
//
//   npm i            # once: installs playwright (a devDependency)
//   npx playwright install chromium
//   node examples/_shared/app-solve.mjs <link_file> [reps] [icon_name]
//
// --after-logical first clicks the app's own logical solver (Icon AutoStep)
// and waits for it to settle, then times the search from there. That is the
// state a player reaches before any search, and a deduction can pay off there
// and not from an empty board, or the other way round. Every fixture gets
// both rows -- see the two-row ship rule in docs/real-app-timing.md.
//
// Before each solve it turns OFF "Non-deterministic solve" (Solver settings ->
// Solutions finder -> Advanced settings), so the solver walks a fixed order and
// the timing is repeatable. With that toggle on, the same board swings 10x-20x
// run to run and the numbers mean nothing. The step throws if the toggle is
// missing, so a run never silently times a non-deterministic solve.
//
// The link must make the solver SEARCH. A finished link stores the full
// solution, so the solver only verifies it and every code variant looks equally
// fast. Empty the interior (probe_link.py) or ship a puzzle with few givens.
//
// The solve time is strongly nondeterministic -- the same board can swing more
// than 10x run to run -- so read the MEDIAN over many reps, not any one number.
//
// ponytail: the solver controls are icon buttons with no text. Address them by
// their `<svg class="Icon NAME">`: "ShowCandidates" is "Find all solutions and
// valid candidates" (the default, the full search that proves uniqueness);
// "CheckSolution" checks a filled grid. SudokuMaker is pre-release; if an icon
// name changes, re-probe (dump each button's `<svg class="Icon ...">`).

import { chromium } from 'playwright'
import fs from 'fs'
import { parseReadout, parseVersion, median, repLine, medianLine, marksRejected, countEnteredValues } from './app-solve-lib.mjs'
import { clickIcon, makeDeterministic, solveLogically, useRecordedApp } from './app-dom.mjs'

// --ring-clues: allow entered values, for edge-clue puzzles whose clues are
// stored as non-given values in the outer ring. Everything else must be
// stripped to its givens or the run is refused (see checkStripped).
const ringClues = process.argv.includes('--ring-clues')
// --after-logical: run the app's logical solver to its fixpoint before the
// timed search, so the row measures the search a player still faces.
const afterLogical = process.argv.includes('--after-logical')
const args = process.argv.slice(2).filter(a => a !== '--ring-clues' && a !== '--after-logical')
const linkFile = args[0]
const reps = parseInt(args[1] || '7', 10)
const iconName = args[2] || 'ShowCandidates'
if (!linkFile) throw new Error('usage: app-solve.mjs <link_file> [reps] [icon_name] [--ring-clues] [--after-logical]')
const link = fs.readFileSync(linkFile, 'utf8').trim()

// The app draws givens black and entered values blue, at each cell's own
// <svg text>. A grid with entered values makes the solver verify instead of
// search, and the app says so in its verdict ("based on already entered
// values"). Refuse before solving. See countEnteredValues (app-solve-lib.mjs)
// for how a real cell digit is told apart from a constraint's own decoration
// text.
async function checkStripped (page) {
  const cells = await page.evaluate(() =>
    [...document.querySelectorAll('svg text')].map(t => {
      const fill = t.getAttribute('fill') || window.getComputedStyle(t).fill
      const cellGroup = t.closest('g[transform]')
      const transform = cellGroup ? cellGroup.getAttribute('transform') : null
      return { fill, transform }
    }))
  const entered = countEnteredValues(cells)
  if (entered > 0 && !ringClues) {
    throw new Error(`${linkFile}: ${entered} entered values on the board; strip it first ` +
      '(probe_link.py strip), or pass --ring-clues for an edge-clue puzzle')
  }
}

async function runOnce (page) {
  await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(1200)
  await checkStripped(page)
  await makeDeterministic(page)
  // The stripped-board check above already ran, so the only marks the search
  // can meet are the ones this pass makes.
  if (afterLogical) await solveLogically(page)
  const clicked = await clickIcon(page, iconName)
  if (!clicked) throw new Error('solve button not found: Icon ' + iconName)
  // Wait for the VERDICT, not the first "took": the solve phase prints its
  // "took" before the uniqueness search finishes, and reading then times only
  // the first phase.
  try {
    await page.waitForFunction(
      () => /unique solution|multiple solutions|not unique|no solution|found [\d,]+ solutions|stopped (solving|counting)/i.test(document.body.innerText),
      null, { timeout: 300000 })
  } catch { /* fall through; a missing verdict shows as a null time */ }
  await page.waitForTimeout(300)
  const text = await page.evaluate(() => document.body.innerText)
  if (marksRejected(text, ringClues || afterLogical)) {
    throw new Error(`${linkFile}: the app judged "based on already entered values" -- not a timing; strip the link first`)
  }
  return { ...parseReadout(text), version: parseVersion(text) }
}

const browser = await chromium.launch()

// A fresh context per rep: the app's service worker (recorded in the HAR)
// takes over a reused context's second page and the Tools tab never renders.
// Fresh state per rep also keeps the reps independent.
const rows = []
for (let k = 0; k < reps; k++) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
  await useRecordedApp(context)
  const page = await context.newPage()
  // A component under measurement may console.log('[probe] ...') counters
  // (calls, skips); relay only those lines, the site's own logging stays out.
  page.on('console', m => { if (m.text().startsWith('[probe]')) console.log(m.text()) })
  rows.push(await runOnce(page))
  await context.close() // flushes a HAR recording
}
await browser.close()

const mode = afterLogical ? 'after-logical' : 'cold'
console.log(`${linkFile}  (${iconName}, ${mode}, non-deterministic OFF, ${reps} reps)`)
for (const r of rows) console.log(repLine(r))
console.log(medianLine(rows))

// One machine-readable line for time_example.py: the median of `sum` (first
// solve + uniqueness search, the whole run that exercises `update`), plus the
// app version so every printed row names the build it measured.
const version = rows.map(r => r.version).find(Boolean) ?? null
console.log('JSON: ' + JSON.stringify({ median: median(rows.map(r => r.sum)), version }))
