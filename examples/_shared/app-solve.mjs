// Time the REAL SudokuMaker solver on a puzzle link, in the recorded app (HAR replay; SM_LIVE=1 re-records it).
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

import fs from 'fs'
import { parseArgs, repLine, medianLine, solveSummary } from './app-solve-lib.mjs'
import { withApp, solveInApp } from './app-session.mjs'

const { linkFile, reps, iconName, ringClues, afterLogical } = parseArgs(process.argv.slice(2))
const link = fs.readFileSync(linkFile, 'utf8').trim()

const rows = await withApp({ live: false }, async app => {
  const results = []
  for (let k = 0; k < reps; k++) {
    // A fresh context per rep keeps the reps independent (see withApp).
    const page = await app.newPage()
    // A component under measurement may console.log('[probe] ...') counters
    // (calls, skips); relay only those lines, the site's own logging stays out.
    page.on('console', m => { if (m.text().startsWith('[probe]')) console.log(m.text()) })
    results.push(await solveInApp(page, link, { iconName, afterLogical, ringClues, name: linkFile }))
    await app.closePage(page) // flushes a HAR recording
  }
  return results
})

const mode = afterLogical ? 'after-logical' : 'cold'
console.log(`${linkFile}  (${iconName}, ${mode}, non-deterministic OFF, ${reps} reps)`)
for (const r of rows) console.log(repLine(r))
console.log(medianLine(rows))

// One machine-readable line for time_example.py: the median of `sum` (first
// solve + uniqueness search, the whole run that exercises `update`), the app
// version so every printed row names the build it measured, and the rep
// counts (solveSummary) so the driver can name a null median's timeout.
const version = rows.map(r => r.version).find(Boolean) ?? null
console.log('JSON: ' + JSON.stringify({ ...solveSummary(rows), version }))
