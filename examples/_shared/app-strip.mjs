// Greedy clue removal with the live SudokuMaker app as the uniqueness oracle,
// loading the puzzle link ONCE instead of once per trial.
//
// examples/isofill/proto_strip_app.py (throwaway) does the same greedy walk,
// but rebuilds a link and launches a fresh Chromium per trial -- about 5s of
// reload overhead every removal. This driver opens the link, then drives the
// app's own puzzle EDITOR by clicking cells and pressing keys: delete a
// given, click the solve button, read the app's own verdict, and either
// leave the cell empty (unique) or restore the given (anything else).
//
//   node examples/_shared/app-strip.mjs <link_file> <out.json> [seed] --grid <puzzle.json>
//
// `--grid` supplies the full grid (for the output JSON) and the starting
// clue set (the cells to try removing) in the same shape build_link.py reads
// -- the link itself only carries which cells are given, not a grid array.
//
// A 'unique' verdict keeps the removal. Anything else (not-unique, timeout,
// or a '?' that still has no verdict after one retry) restores the digit AS
// A GIVEN -- never as an entered (played) value, which is what plain
// keyboard digit entry would produce outside the app's "Given digits"
// editing mode. See "How this drives the app" below for why a given is
// restorable at all after a solve has run.
//
// A 'timeout' rung (the app's own solve limit, no verdict) keeps the given
// and is also written to <out>.timeout-<n>.json, same as proto_strip_app.py:
// that rung is a candidate hard grid, worth a CP-SAT uniqueness check later.
//
// ---- How this drives the app ----
//
// The puzzle link opens directly in SudokuMaker's puzzle EDITOR, not a
// player view: the "Given digits" element is already the selected editing
// target in the left Elements panel, so clicking a cell and pressing a digit
// key (or Delete) sets or clears a GIVEN outright -- no separate "givens
// mode" toggle exists to find or click.
//
// A cell is addressed by transforming its local SVG coordinate (the app lays
// out cell centers at (25 + 50*col, 25 + 50*row) inside a <g> whose CTM maps
// to screen space) through that <g>'s getScreenCTM(), so this survives the
// app's zoom/pan without hardcoded pixel math.
//
// The solve button (the ShowCandidates icon, same as app-solve.mjs) starts a
// background search that keeps running after the first verdict text appears
// -- clicking "Stop solving" cancels it. Left running, that search overwrites
// the grid with live per-cell candidate digits, and those change WHICH TOOL
// keyboard input is aimed at: after a solve, digit keys stop setting the
// given and start toggling those candidate marks instead. Restoring a given
// after a solve therefore takes an extra step: select the whole grid
// (Icon SelectAll) and clear it (Icon ClearAll). That clears entered values
// and candidate marks only -- givens are untouched (verified: a given cell
// elsewhere on the board survives it) -- and it also puts digit-key input
// back to setting givens, so the restore keystroke that follows works again.
// This step runs after every solve, not only before a restore, so the next
// trial never starts with stray marks left over from this one.

import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { readVerdict } from './app-solve-lib.mjs'
import { seededShuffle, decideRemoval, keptLine, keepLine, minimumLine, outputJson } from './app-strip-lib.mjs'

const args = process.argv.slice(2)
const gridFlagIdx = args.indexOf('--grid')
const gridFile = gridFlagIdx >= 0 ? args[gridFlagIdx + 1] : null
const positional = args.filter((a, i) => i !== gridFlagIdx && i !== gridFlagIdx + 1)
const [linkFile, outFile, seedArg] = positional
const seed = seedArg ? parseInt(seedArg, 10) : 1
if (!linkFile || !outFile || !gridFile) {
  throw new Error('usage: app-strip.mjs <link_file> <out.json> [seed] --grid <puzzle.json>')
}

const link = fs.readFileSync(linkFile, 'utf8').trim()
const spec = JSON.parse(fs.readFileSync(gridFile, 'utf8'))
const grid = spec.grid
const startClues = spec.clues.map(([r, c]) => [r, c])

const clickText = (page, t) => page.evaluate((t) => {
  const els = [...document.querySelectorAll('*')]
    .filter(e => e.textContent.replace(/\s+/g, ' ').trim() === t)
  const el = els[els.length - 1]
  if (el) { el.click(); return true }
  return false
}, t)

const clickIcon = (page, iconName) => page.evaluate((icon) => {
  const s = [...document.querySelectorAll('svg')].find(e => e.getAttribute('class') === 'Icon ' + icon)
  if (s) { s.closest('button').click(); return true }
  return false
}, iconName)

// Screen point for cell (row, col), via the grid <g>'s own CTM -- see the
// header comment on why this beats hardcoded pixel offsets.
async function cellScreenPoint (page, row, col) {
  return page.evaluate(({ row, col }) => {
    const svg = [...document.querySelectorAll('svg')].find(s => s.getAttribute('class') === 'SudokuSvg')
    const outerG = svg.querySelector('g')
    const pt = svg.createSVGPoint()
    pt.x = 25 + 50 * col
    pt.y = 25 + 50 * row
    const screenPt = pt.matrixTransform(outerG.getScreenCTM())
    return { x: screenPt.x, y: screenPt.y }
  }, { row, col })
}

async function selectCell (page, row, col) {
  const p = await cellScreenPoint(page, row, col)
  await page.mouse.click(p.x, p.y)
  await page.waitForTimeout(150)
}

// Turn OFF "Non-deterministic solve" once at startup -- see app-solve.mjs for
// why: with it on, verdict timing (and occasionally the search itself) is
// noisy run to run.
async function makeDeterministic (page) {
  await clickText(page, 'Tools')
  await page.waitForTimeout(300)
  const cog = await clickIcon(page, 'CogWheel')
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
    if (input.checked) label.click()
    return document.getElementById(label.getAttribute('for')).checked ? 'still-on' : 'off'
  })
  if (state !== 'off') throw new Error('non-deterministic toggle: ' + state)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

// Delete cell (row, col)'s given, click the solve button, and read the
// verdict. Does not restore or clear -- callers decide that from the verdict.
async function trySolveWithout (page, row, col) {
  await selectCell(page, row, col)
  await page.keyboard.press('Delete')
  await page.waitForTimeout(200)

  const clicked = await clickIcon(page, 'ShowCandidates')
  if (!clicked) throw new Error('solve button not found: Icon ShowCandidates')
  try {
    await page.waitForFunction(
      () => /unique solution|multiple solutions|not unique|no solution|found [\d,]+ solutions|stopped (solving|counting)/i.test(document.body.innerText),
      null, { timeout: 30000 })
  } catch { /* no verdict within the cap -- readVerdict reports '?' below */ }
  await page.waitForTimeout(200)
  const text = await page.evaluate(() => document.body.innerText)
  return readVerdict(text)
}

// Cancel any still-running background search, then clear stray candidate
// marks (SelectAll + ClearAll) -- both a no-op when there is nothing to
// clear. This also resets keyboard digit input back to setting givens (see
// the header comment), so it runs after every solve, not only before a
// restore.
async function settleAfterSolve (page) {
  await clickText(page, 'Stop solving') // best-effort: absent once solving has finished
  await page.waitForTimeout(200)
  await clickIcon(page, 'SelectAll')
  await page.waitForTimeout(150)
  await clickIcon(page, 'ClearAll')
  await page.waitForTimeout(200)
}

async function restoreGiven (page, row, col, digit) {
  await selectCell(page, row, col)
  await page.keyboard.press(String(digit))
  await page.waitForTimeout(150)
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(1500)
await makeDeterministic(page)

const order = seededShuffle(startClues, seed)
const kept = order.slice()
const outPath = path.resolve(outFile)

for (let i = 0; i < kept.length;) {
  const [row, col] = kept[i]
  const digit = grid[row][col]
  const t0 = Date.now()

  let verdict = await trySolveWithout(page, row, col)
  let decision = decideRemoval(verdict)
  if (decision.needsRetry) {
    verdict = await trySolveWithout(page, row, col)
    decision = decideRemoval('?', verdict)
  }
  const ms = Date.now() - t0

  if (decision.remove) {
    kept.splice(i, 1)
    console.log(keptLine(kept.length, decision.finalVerdict, ms))
    fs.writeFileSync(outPath, outputJson(grid, kept))
  } else {
    await restoreGiven(page, row, col, digit)
    console.log(keepLine([row, col], decision.finalVerdict))
    if (decision.finalVerdict === 'timeout') {
      const timeoutPath = outPath.replace(/\.json$/, `.timeout-${kept.length}.json`)
      fs.writeFileSync(timeoutPath, outputJson(grid, kept))
    }
    i++
  }

  await settleAfterSolve(page)
}

console.log(minimumLine(kept.length))
await browser.close()
