// Open a Dutch Flatmates link in the app once, and print what it shows: the
// rules text, the verdict of "Find all solutions and valid candidates", and the
// grid the solver reached ('.' for a cell it did not fill). Compare the grid
// with gen.json's solution.
//
//   node examples/dutch-flatmates/app-open.mjs [link_file] [--live]
//
// Default: the recorded app (examples/_shared/sudokumaker.har, replay), which
// holds no play page, so the rules text is not read. --live loads
// sudokumaker.app itself, reads the rules text too, and records nothing, so the
// HAR stays as it is.
// The link is read from disk and sent as the page's own URL; it is never printed.

import { chromium } from 'playwright'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { useRecordedApp, clickIcon, readGrid } from '../_shared/app-dom.mjs'
import { VERDICT_PATTERN, parseReadout, parseVersion } from '../_shared/app-solve-lib.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const live = process.argv.includes('--live')
const linkFile = process.argv.slice(2).find(a => !a.startsWith('--')) ?? join(HERE, 'PUZZLE_LINK.txt')
const link = fs.readFileSync(linkFile, 'utf8').trim()
const gen = JSON.parse(fs.readFileSync(join(HERE, 'gen.json'), 'utf8'))

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
if (!live) await useRecordedApp(context)
const page = await context.newPage()
page.on('pageerror', e => console.error('PAGEERROR', e.message))
await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(1500)

const opening = await readGrid(page)
const title = await page.title()

// The rules text shows on the play page, which "Playtest" opens in a new tab.
// The recorded app holds no play page (replay aborts it), so only --live reads it.
let rules = null
if (live) {
  const [play] = await Promise.all([context.waitForEvent('page'), page.getByText('Playtest', { exact: true }).click()])
  await play.waitForLoadState('networkidle')
  await play.waitForTimeout(1500)
  rules = (await play.evaluate(() => document.body.innerText)).match(/Normal sudoku rules apply\.[^\n]*/)?.[0] ?? null
  await play.close()
}

if (!await clickIcon(page, 'ShowCandidates')) throw new Error('solve button not found: Icon ShowCandidates')
await page.waitForFunction(
  ([source, flags]) => new RegExp(source, flags).test(document.body.innerText),
  [VERDICT_PATTERN.source, VERDICT_PATTERN.flags], { timeout: 300000 })
await page.waitForTimeout(500)
const text = await page.evaluate(() => document.body.innerText)
const solved = await readGrid(page)

console.log(JSON.stringify({
  source: live ? 'live sudokumaker.app' : 'recorded app',
  version: parseVersion(text),
  title,
  rules,
  givensShown: opening.join('').replace(/\./g, '').length,
  readout: parseReadout(text),
  grid: solved,
  matchesGenSolution: solved.join() === gen.grid.join()
}, null, 1))
await context.close()
await browser.close()
