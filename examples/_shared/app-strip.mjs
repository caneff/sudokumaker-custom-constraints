// Greedy clue removal with the live SudokuMaker app as the uniqueness oracle,
// loading the puzzle link ONCE instead of once per trial.
//
// A throwaway prototype does the same greedy walk by rebuilding a link and
// launching a fresh Chromium per trial -- several seconds of reload overhead
// every removal. This driver opens the link, then drives the app's own
// puzzle EDITOR by clicking cells and pressing keys: delete a given, click
// the solve button, read the app's own verdict, and either leave the cell
// empty (unique) or restore the given (anything else).
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
// editing mode.
//
// A 'timeout' rung (the app's own solve limit, no verdict) keeps the given
// and is also written to <out>.timeout-<n>.json: that rung is a candidate
// hard grid, worth a CP-SAT uniqueness check later.
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
// This runs after every solve attempt, including a retry, so no trial ever
// reads a verdict off a board still carrying the previous attempt's marks.

import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { parseReadout } from './app-solve-lib.mjs'
import { clickText, clickIcon, makeDeterministic, useRecordedApp } from './app-dom.mjs'
import { parseArgs, seededShuffle, settleVerdict, outputJson } from './app-strip-lib.mjs'

const { linkFile, outFile, gridFile, seed } = parseArgs(process.argv.slice(2))

const link = fs.readFileSync(linkFile, 'utf8').trim()
const spec = JSON.parse(fs.readFileSync(gridFile, 'utf8'))
const grid = spec.grid
const startClues = spec.clues.map(([r, c]) => [r, c])

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

async function cellFill (page, row, col) {
  return page.evaluate(({ row, col }) => {
    const svg = [...document.querySelectorAll('svg')].find(s => s.getAttribute('class') === 'SudokuSvg')
    const outerG = svg.querySelector('g')
    const g = [...outerG.children].find(c => c.getAttribute('transform') === `translate(${25 + 50 * col} ${25 + 50 * row}) scale(25)`)
    const t = g ? g.querySelector('text') : null
    return t ? { content: t.textContent, fill: t.getAttribute('fill') } : null
  }, { row, col })
}

async function selectCell (page, row, col) {
  const p = await cellScreenPoint(page, row, col)
  await page.mouse.click(p.x, p.y)
  await page.waitForTimeout(150)
}

// Cancel any still-running background search, then clear stray candidate
// marks (SelectAll + ClearAll) -- both a no-op when there is nothing to
// clear. This also resets keyboard digit input back to setting givens (see
// the header comment). Both icon clicks are load-bearing -- a silent miss
// (icon renamed; the app is pre-release) leaves the next digit keystroke
// toggling a candidate mark instead of setting a given, corrupting every
// later trial -- so this fails loud rather than continuing on a board it
// cannot confirm is clean.
async function settleAfterSolve (page) {
  await clickText(page, 'Stop solving') // best-effort: absent once solving has finished
  await page.waitForTimeout(200)
  if (!await clickIcon(page, 'SelectAll')) throw new Error('SelectAll icon not found')
  await page.waitForTimeout(150)
  if (!await clickIcon(page, 'ClearAll')) throw new Error('ClearAll icon not found')
  await page.waitForTimeout(200)
}

// Delete cell (row, col)'s given, click the solve button, and read the
// verdict + timing off the app's own readout (parseReadout, the same
// convention app-solve.mjs uses) -- not a wall clock, which would fold in
// click/DOM overhead. Throws if the verdict is a "unique solution" that the
// app itself says is judged from leftover entered values or pencil marks:
// that is not a real uniqueness proof for the board as this driver intends
// it, and a silent pass here would drop clues the puzzle actually needs.
// Does not restore or settle -- callers decide that from the result.
async function trySolveWithout (page, row, col) {
  await selectCell(page, row, col)
  await page.keyboard.press('Delete')
  await page.waitForTimeout(200)

  if (!await clickIcon(page, 'ShowCandidates')) throw new Error('solve button not found: Icon ShowCandidates')
  try {
    await page.waitForFunction(
      () => /unique solution|multiple solutions|not unique|no solution|found [\d,]+ solutions|stopped (solving|counting)/i.test(document.body.innerText),
      null, { timeout: 30000 })
  } catch { /* no verdict within the cap -- readVerdict reports '?' below */ }
  await page.waitForTimeout(200)
  const text = await page.evaluate(() => document.body.innerText)
  if (/based on already entered values/i.test(text)) {
    throw new Error(`(${row},${col}): verdict was judged "based on already entered values and pencil marks" -- ` +
      'the board was not clean before this solve; settleAfterSolve should have caught this')
  }
  return parseReadout(text)
}

async function restoreGiven (page, row, col, digit) {
  await selectCell(page, row, col)
  await page.keyboard.press(String(digit))
  await page.waitForTimeout(150)
  const restored = await cellFill(page, row, col)
  if (!restored || restored.content !== String(digit) || restored.fill !== '#000') {
    throw new Error(`(${row},${col}): restore failed -- expected given "${digit}" (fill #000), ` +
      `got ${JSON.stringify(restored)}`)
  }
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } })
await useRecordedApp(page.context())
await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(1500)
await makeDeterministic(page)

const order = seededShuffle(startClues, seed)
const kept = order.slice()
const outPath = path.resolve(outFile)

for (let i = 0; i < kept.length;) {
  const [row, col] = kept[i]
  const digit = grid[row][col]

  let readout = await trySolveWithout(page, row, col)
  let verdict = readout.verdict
  if (verdict === '?') {
    await settleAfterSolve(page)
    readout = await trySolveWithout(page, row, col)
    verdict = settleVerdict('?', readout.verdict)
  }

  if (verdict === 'unique') {
    kept.splice(i, 1)
    console.log(`${kept.length} givens  ${verdict}  ${readout.sum} ms`)
    fs.writeFileSync(outPath, outputJson(grid, kept))
  } else {
    await settleAfterSolve(page)
    await restoreGiven(page, row, col, digit)
    console.log(`keep (${row},${col})  (${verdict})`)
    if (verdict === 'timeout') {
      const timeoutPath = outPath.replace(/\.json$/, `.timeout-${kept.length}.json`)
      fs.writeFileSync(timeoutPath, outputJson(grid, kept))
    }
    i++
    continue
  }

  await settleAfterSolve(page)
}

console.log(`minimum ${kept.length} givens`)
await page.context().close()
await browser.close()
