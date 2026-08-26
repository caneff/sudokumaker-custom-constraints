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

const linkFile = process.argv[2]
const reps = parseInt(process.argv[3] || '7', 10)
const iconName = process.argv[4] || 'ShowCandidates'
if (!linkFile) throw new Error('usage: app-solve.mjs <link_file> [reps] [icon_name]')
const link = fs.readFileSync(linkFile, 'utf8').trim()

// The app prints one "took" per phase ("✨ Solved took 3.7s", then "This is a
// unique solution. took 0.0s"). Return their sum in ms, or null if none.
function parseTook (text) {
  const ms = [...text.matchAll(/took\s+([\d.]+)\s*(ms|s)\b/gi)]
    .map(m => (m[2].toLowerCase() === 's' ? parseFloat(m[1]) * 1000 : parseFloat(m[1])))
  return ms.length ? Math.round(ms.reduce((a, b) => a + b, 0)) : null
}

function readVerdict (text) {
  if (/unique solution/i.test(text)) return 'unique'
  if (/multiple solutions|not unique|no solution/i.test(text)) return 'not-unique'
  return '?'
}

// Click the innermost element whose exact trimmed text equals `t`.
const clickText = (page, t) => page.evaluate((t) => {
  const els = [...document.querySelectorAll('*')]
    .filter(e => e.textContent.replace(/\s+/g, ' ').trim() === t)
  const el = els[els.length - 1]
  if (el) { el.click(); return true }
  return false
}, t)

// Turn OFF "Non-deterministic solve" so the solver walks a fixed order and the
// timing is repeatable. Path: Tools tab -> cog icon -> Solver settings modal ->
// Solutions finder tab -> Advanced settings -> the toggle. Throw if any step is
// missing: a silently-skipped toggle would time a non-deterministic solve and
// the numbers would be noise.
async function makeDeterministic (page) {
  await clickText(page, 'Tools')
  await page.waitForTimeout(300)
  const cog = await page.evaluate(() => {
    const s = [...document.querySelectorAll('svg')].find(e => e.getAttribute('class') === 'Icon CogWheel')
    if (s) { s.closest('button').click(); return true }
    return false
  })
  if (!cog) throw new Error('cog icon not found')
  await page.waitForTimeout(500)
  if (!await clickText(page, 'Solver settings')) throw new Error('Solver settings button not found')
  await page.waitForTimeout(600)
  if (!await clickText(page, 'Solutions finder')) throw new Error('Solutions finder tab not found')
  await page.waitForTimeout(400)
  if (!await clickText(page, 'Advanced settings')) throw new Error('Advanced settings section not found')
  await page.waitForTimeout(500)
  const state = await page.evaluate(() => {
    const label = [...document.querySelectorAll('label.clickable')]
      .find(e => /Non-deterministic solve/i.test(e.textContent))
    if (!label) return 'no-label'
    const input = document.getElementById(label.getAttribute('for'))
    if (!input) return 'no-input'
    if (input.checked) label.click() // was on -> turn off
    return document.getElementById(label.getAttribute('for')).checked ? 'still-on' : 'off'
  })
  if (state !== 'off') throw new Error('non-deterministic toggle: ' + state)
  await page.keyboard.press('Escape') // close the modal
  await page.waitForTimeout(300)
}

async function runOnce (page) {
  await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(1200)
  await makeDeterministic(page)
  const clicked = await page.evaluate((icon) => {
    const s = [...document.querySelectorAll('svg')].find(e => e.getAttribute('class') === 'Icon ' + icon)
    if (s) { s.closest('button').click(); return true }
    return false
  }, iconName)
  if (!clicked) throw new Error('solve button not found: Icon ' + iconName)
  // Wait for the VERDICT, not the first "took": the solve phase prints its
  // "took" before the uniqueness search finishes, and reading then times only
  // the first phase.
  try {
    await page.waitForFunction(
      () => /unique solution|multiple solutions|not unique|no solution/i.test(document.body.innerText),
      null, { timeout: 300000 })
  } catch { /* fall through; a missing verdict shows as a null time */ }
  await page.waitForTimeout(300)
  const text = await page.evaluate(() => document.body.innerText)
  const verdict = readVerdict(text)
  // No verdict = the search did not finish; a partial "took" is not a time.
  return { ms: verdict === '?' ? null : parseTook(text), verdict }
}

const median = xs => {
  const s = xs.filter(x => x != null).sort((a, b) => a - b)
  return s.length ? s[Math.floor(s.length / 2)] : null
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })

const rows = []
for (let k = 0; k < reps; k++) {
  const page = await context.newPage()
  rows.push(await runOnce(page))
  await page.close()
}
await browser.close()

console.log(`${linkFile}  (${iconName}, non-deterministic OFF, ${reps} reps)`)
for (const r of rows) console.log(`  took ${r.ms}ms  [${r.verdict}]`)
const ok = rows.map(r => r.ms)
console.log(`  MEDIAN ${median(ok)}ms  (min ${Math.min(...ok.filter(x => x != null))}, max ${Math.max(...ok.filter(x => x != null))})  over ${ok.filter(x => x != null).length}/${reps} reps`)
