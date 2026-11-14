// Open a puzzle in the real SudokuMaker app and read its verdict -- written
// once, for the timing driver (app-solve.mjs), the probes that open a fresh
// page per solve, and app-strip.mjs. app-strip.mjs solves many times on one
// page, which solveInApp, reloading the link each call, cannot do: it opens
// with openLink and reads each verdict with readVerdict, the read solveOpen
// makes too. What counts as a verdict is app-solve-lib.mjs's (ADR-0001: the
// app's readout is the only verdict).
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
import { VERDICT_PATTERN, countEnteredValues, marksRefusal, marksRejected, parseReadout, parseVersion } from './app-solve-lib.mjs'
import { clickIcon, makeDeterministic, readCells, solveLogically, useRecordedApp } from './app-dom.mjs'

const VIEWPORT = { width: 1400, height: 900 }

// Run `fn(app)` with a browser open, then close it. `app.newPage()` gives a
// page in a fresh context: the app's service worker (recorded in the HAR)
// takes over a reused context's second page and the Tools tab never renders,
// and fresh state keeps repeated solves independent. `app.closePage(page)`
// closes that page's context, which is what flushes a HAR recording;
// withApp closes any left open when `fn` returns, and leaves them when it
// throws, so a failed run never overwrites a good recording with a partial one.
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
    const result = await fn(app)
    for (const context of contexts.values()) await context.close()
    return result
  } finally {
    await browser.close()
  }
}

// The app draws givens black and entered values blue, at each cell's own
// <svg text>. A grid with entered values makes the solver verify instead of
// search, and the app says so in its verdict ("based on already entered
// values"). Refuse before solving. See countEnteredValues (app-solve-lib.mjs)
// for how a real cell digit is told apart from a constraint's own decoration
// text.
async function checkSearchable (page, name) {
  const cells = await readCells(page)
  const entered = countEnteredValues(cells)
  if (entered > 0) {
    throw new Error(`${name}: ${entered} entered values on the board; strip it first ` +
      '(searchable_link.py strip), or pass ringClues (--ring-clues) for an edge-clue puzzle')
  }
}

// Open `link` on `page`: the one open every browser script shares. Goes to
// the link on networkidle, settles 1500 ms, then turns off "Non-deterministic
// solve" (`deterministic: false` skips the clicks, for a probe that reads an
// answer, not a time). A caller that reads the opening board does so after
// this returns and before solveOpen.
export async function openLink (page, link, { deterministic = true } = {}) {
  await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
  await page.waitForTimeout(1500)
  if (deterministic) await makeDeterministic(page)
}

// On a page openLink opened, run the solve button, wait for the VERDICT and
// read the readout. Options:
//   iconName      the toolbar icon to click; the default is the full search
//                 that proves uniqueness (see app-solve.mjs's header).
//   afterLogical  run the app's logical solver to its fixpoint first.
//   ringClues     the board may carry entered values (edge-clue puzzles).
//   timeoutMs     how long to wait for a verdict; none read is verdict '?'
//                 with null times, as parseReadout reports it.
//   alsoWaitFor   a RegExp whose match also ends the wait, for a probe fed a
//                 link the app rejects outright (no verdict is ever printed);
//                 it does not change what counts as a verdict.
//   name          what to call the link in an error message.
// Returns parseReadout's { first, unique, sum, verdict } plus the app's
// `version` and the page `text` the readout came from.
export async function solveOpen (page, { iconName = 'ShowCandidates', afterLogical = false, ringClues = false, alsoWaitFor = null, timeoutMs = 300000, name = 'link' } = {}) {
  if (!ringClues) await checkSearchable(page, name)
  // The searchable-link check above already ran, so the only marks the search
  // can meet are the ones this pass makes.
  if (afterLogical) await solveLogically(page)
  if (!await clickIcon(page, iconName)) throw new Error('solve button not found: Icon ' + iconName)
  // Wait for the VERDICT, not the first "took": the solve phase prints its
  // "took" before the uniqueness search finishes, and reading then times only
  // the first phase.
  const { text, ...readout } = await readVerdict(page, { name, marksExpected: ringClues || afterLogical, alsoWaitFor, timeout: timeoutMs })
  return { ...readout, version: parseVersion(text), text }
}

// openLink then solveOpen, for a script that opens a fresh page per solve and
// reads nothing between the two. `deterministic` goes to openLink; the rest to
// solveOpen.
export async function solveInApp (page, link, { deterministic = true, ...options } = {}) {
  await openLink(page, link, { deterministic })
  return solveOpen(page, options)
}

// Wait for the app's VERDICT on `page`, then read the readout. The wait ends
// on the verdict pattern, or on `alsoWaitFor` (a RegExp) for a link the app
// rejects outright; a wait that times out falls through, and the readout then
// reports verdict '?' with null times. Throws marksRefusal(`name`), the one
// shared message, when the app judged the verdict "based on already entered values"
// and `marksExpected` is false: that verifies a part-filled board instead of
// searching. Returns parseReadout's record plus the page `text` it came from.
export async function readVerdict (page, { name = 'link', marksExpected = false, alsoWaitFor = null, timeout = 300000, settleMs = 300 } = {}) {
  try {
    await page.waitForFunction(
      ([source, flags]) => new RegExp(source, flags).test(document.body.innerText),
      [alsoWaitFor ? `${VERDICT_PATTERN.source}|${alsoWaitFor.source}` : VERDICT_PATTERN.source, VERDICT_PATTERN.flags],
      { timeout })
  } catch { /* fall through; a missing verdict shows as a null time */ }
  await page.waitForTimeout(settleMs)
  const text = await page.evaluate(() => document.body.innerText)
  if (marksRejected(text, marksExpected)) {
    throw new Error(marksRefusal(name))
  }
  return { ...parseReadout(text), text }
}
