// Open a puzzle in the real SudokuMaker app and read its verdict -- written
// once, for the timing driver (app-solve.mjs) and every probe that needs the
// app's own answer. What counts as a verdict is app-solve-lib.mjs's
// (ADR-0001: the app's readout is the only verdict).
//
//   await withApp({ live: false }, async app => {
//     const page = await app.newPage()
//     const { verdict, unique, sum, version, text } = await solveInApp(page, link)
//   })
//
// Two adapters serve the page: `live: false` replays the recorded app from
// sudokumaker.har (repeatable, off the network; SM_LIVE=1 re-records it, see
// useRecordedApp), `live: true` loads sudokumaker.app itself and records
// nothing.

import { chromium } from 'playwright'
import { ALREADY_ENTERED, VERDICT_PATTERN, countEnteredValues, marksRejected, parseReadout, parseVersion } from './app-solve-lib.mjs'
import { clickIcon, makeDeterministic, solveLogically, useRecordedApp } from './app-dom.mjs'

const VIEWPORT = { width: 1400, height: 900 }

// Run `fn(app)` with a browser open, then close it. `app.newPage()` gives a
// page in a fresh context: the app's service worker (recorded in the HAR)
// takes over a reused context's second page and the Tools tab never renders,
// and fresh state keeps repeated solves independent. `app.closePage(page)`
// closes that page's context, which is what flushes a HAR recording;
// withApp closes any left open.
export async function withApp ({ live = false } = {}, fn) {
  const browser = await chromium.launch()
  const contexts = new Map()
  const app = {
    async newPage () {
      const context = await browser.newContext({ viewport: VIEWPORT })
      if (!live) await useRecordedApp(context)
      const page = await context.newPage()
      contexts.set(page, context)
      return page
    },
    async closePage (page) {
      await contexts.get(page).close()
      contexts.delete(page)
    }
  }
  try {
    return await fn(app)
  } finally {
    for (const context of contexts.values()) await context.close()
    await browser.close()
  }
}

// The app draws givens black and entered values blue, at each cell's own
// <svg text>. A grid with entered values makes the solver verify instead of
// search, and the app says so in its verdict ("based on already entered
// values"). Refuse before solving. See countEnteredValues (app-solve-lib.mjs)
// for how a real cell digit is told apart from a constraint's own decoration
// text.
async function checkStripped (page, name) {
  const cells = await page.evaluate(() =>
    [...document.querySelectorAll('svg text')].map(t => {
      const fill = t.getAttribute('fill') || window.getComputedStyle(t).fill
      const cellGroup = t.closest('g[transform]')
      const transform = cellGroup ? cellGroup.getAttribute('transform') : null
      return { fill, transform }
    }))
  const entered = countEnteredValues(cells)
  if (entered > 0) {
    throw new Error(`${name}: ${entered} entered values on the board; strip it first ` +
      '(probe_link.py strip), or pass --ring-clues for an edge-clue puzzle')
  }
}

// Open `link` on `page`, run the solve button, wait for the VERDICT and read
// the readout. Options:
//   iconName      the toolbar icon to click; the default is the full search
//                 that proves uniqueness (see app-solve.mjs's header).
//   afterLogical  run the app's logical solver to its fixpoint first.
//   ringClues     the board may carry entered values (edge-clue puzzles).
//   timeoutMs     how long to wait for a verdict; none read is verdict '?'
//                 with null times, as parseReadout reports it.
//   name          what to call the link in an error message.
//   afterOpen     `async page => {}`, run once the link has loaded and before
//                 anything is clicked: for a probe that reads the opening board.
// Returns parseReadout's { first, unique, sum, verdict } plus the app's
// `version` and the page `text` the readout came from.
export async function solveInApp (page, link, { iconName = 'ShowCandidates', afterLogical = false, ringClues = false, timeoutMs = 300000, name = 'link', afterOpen } = {}) {
  await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(1200)
  if (afterOpen) await afterOpen(page)
  if (!ringClues) await checkStripped(page, name)
  await makeDeterministic(page)
  // The stripped-board check above already ran, so the only marks the search
  // can meet are the ones this pass makes.
  if (afterLogical) await solveLogically(page)
  if (!await clickIcon(page, iconName)) throw new Error('solve button not found: Icon ' + iconName)
  // Wait for the VERDICT, not the first "took": the solve phase prints its
  // "took" before the uniqueness search finishes, and reading then times only
  // the first phase.
  try {
    await page.waitForFunction(
      ([source, flags]) => new RegExp(source, flags).test(document.body.innerText),
      [VERDICT_PATTERN.source, VERDICT_PATTERN.flags], { timeout: timeoutMs })
  } catch { /* fall through; a missing verdict shows as a null time */ }
  await page.waitForTimeout(300)
  const text = await page.evaluate(() => document.body.innerText)
  if (marksRejected(text, ringClues || afterLogical)) {
    throw new Error(`${name}: the app judged "${ALREADY_ENTERED}" -- not a timing; strip the link first`)
  }
  return { ...parseReadout(text), version: parseVersion(text), text }
}
