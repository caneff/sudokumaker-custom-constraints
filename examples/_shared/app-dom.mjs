// Browser-page helpers shared by the Playwright drivers that automate the
// live SudokuMaker app (app-solve.mjs, app-strip.mjs). Needs a live `page`,
// so it runs only under Playwright -- the pure, node:assert-testable logic
// lives in app-solve-lib.mjs and app-strip-lib.mjs instead.

import fs from 'fs'

// Serve the app from a recorded HAR so repeated runs stay off the network.
// No HAR yet, or SM_LIVE=1: load live and record it (written when the
// CONTEXT closes -- browser.close() alone drops it, so the drivers close
// their context first). Otherwise replay from disk. The puzzle rides in the
// `?puzzle=` query, so on replay the document request is rewritten to `/`
// (the same SPA index the HAR holds); the page's own location keeps the
// query, so the app still reads the puzzle. Replay pins the app version --
// re-record with SM_LIVE=1 after a SudokuMaker release.
export async function useRecordedApp (context) {
  const har = new URL('./sudokumaker.har', import.meta.url).pathname
  const update = process.env.SM_LIVE === '1' || !fs.existsSync(har)
  // embed: one file, no sidecar assets beside it.
  await context.routeFromHAR(har, { update, updateContent: 'embed', notFound: 'abort' })
  if (!update) {
    // SM_OFFLINE=1 cuts the browser's network: proof the replay is complete.
    if (process.env.SM_OFFLINE === '1') await context.setOffline(true)
    await context.route(/^https:\/\/sudokumaker\.app\/\?puzzle=/,
      route => route.fallback({ url: 'https://sudokumaker.app/' }))
  }
  console.error(update ? `app: live, recording ${har}` : `app: replay from ${har}`)
}

// Click the innermost element whose exact trimmed text equals `t`.
export const clickText = (page, t) => page.evaluate((t) => {
  const els = [...document.querySelectorAll('*')]
    .filter(e => e.textContent.replace(/\s+/g, ' ').trim() === t)
  const el = els[els.length - 1]
  if (el) { el.click(); return true }
  return false
}, t)

// Click a toolbar icon button by its `<svg class="Icon NAME">`. See
// app-solve.mjs's header comment for why the icons are addressed this way.
export const clickIcon = (page, iconName) => page.evaluate((icon) => {
  const s = [...document.querySelectorAll('svg')].find(e => e.getAttribute('class') === 'Icon ' + icon)
  if (s) { s.closest('button').click(); return true }
  return false
}, iconName)

// Turn OFF "Non-deterministic solve" so the solver walks a fixed order and
// timing/results are repeatable. Path: Tools tab -> cog icon -> Solver
// settings modal -> Solutions finder tab -> Advanced settings -> the toggle.
// Throws if any step is missing: a silently-skipped toggle would run a
// non-deterministic solve, and callers rely on this having actually landed.
export async function makeDeterministic (page) {
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
    if (input.checked) label.click() // was on -> turn off
    return document.getElementById(label.getAttribute('for')).checked ? 'still-on' : 'off'
  })
  if (state !== 'off') throw new Error('non-deterministic toggle: ' + state)
  await page.keyboard.press('Escape') // close the modal
  await page.waitForTimeout(300)
}

// Open the on-screen digit pad and reselect "Given digits" as the active
// editing element. Needed once, before the first digit above 9 is entered
// (#307, the 9x9-digits-1-12 fixtures -- SudokuMaker has no keyboard hotkey
// past 9, #293): opening the pad (Icon DigitBox) drops "Given digits" as the
// selected element, so a pad click would otherwise land as an entered
// (played) value instead of a given -- verified empirically by comparing the
// clicked cell's fill (#000 for a given, the entered-value blue otherwise).
export async function openWidePad (page) {
  if (!await clickIcon(page, 'DigitBox')) throw new Error('DigitBox icon not found')
  await page.waitForTimeout(300)
  if (!await clickText(page, 'Given digits')) throw new Error('"Given digits" element not found')
  await page.waitForTimeout(300)
}

// Enter `digit` into the already-selected cell as a GIVEN. 1-9 uses the
// keyboard hotkey; above 9 there is none, so this clicks the on-screen pad
// instead. Once the pad is open (openWidePad has run), the keyboard hotkeys
// address whichever of the pad's two screens is currently showing -- 1-9 on
// its first screen, 10-12 on its second, and pressing "2" while the second
// screen shows does nothing at all (verified empirically, #307) -- so this
// pages to the right screen (the "..." button, Icon VerticalDots) before
// either a click or a keypress, whenever the pad is open. With no pad open
// (a cap <= 9 run, openWidePad never called) 1-9 just presses the key.
export async function enterDigit (page, digit) {
  const padOpen = await page.evaluate(() => !!document.querySelector('div.grid'))
  if (digit <= 9 && !padOpen) {
    await page.keyboard.press(String(digit))
    return
  }
  const shown = await page.evaluate(() =>
    [...document.querySelectorAll('div.grid button span')].map(s => s.textContent))
  if (!shown.includes(String(digit))) {
    const paged = await page.evaluate(() => {
      const btn = [...document.querySelectorAll('div.grid button')].find(b => b.querySelector('svg.Icon.VerticalDots'))
      if (!btn) return false
      btn.click()
      return true
    })
    if (!paged) throw new Error('digit pad pager (Icon VerticalDots) not found')
    await page.waitForTimeout(150)
  }
  if (digit <= 9) {
    await page.keyboard.press(String(digit))
    return
  }
  const clicked = await page.evaluate((d) => {
    const btn = [...document.querySelectorAll('div.grid button')].find(b => b.querySelector('span')?.textContent === d)
    if (!btn) return false
    btn.click()
    return true
  }, String(digit))
  if (!clicked) throw new Error(`digit pad button "${digit}" not found`)
}

// How long solveLogically waits for the app's logic pass to stop changing the
// board. The app's own solve limit is 300 s, so a pass that outlives this has
// stalled, not merely taken a while.
const LOGIC_SETTLE_TIMEOUT_MS = 300000

// Run the app's own logical solver to its fixpoint: the state a player reaches
// before any search. `AutoStep` is the run-to-fixpoint button, not `SingleStep`
// (one step) beside it. Settled means the BOARD -- every digit and pencil mark
// the grid draws -- stops changing across three consecutive samples; sampling
// the whole page instead would never settle beside any ticking readout.
// Throws when the pass has not settled in time, so a run never times a
// half-finished logic pass.
export async function solveLogically (page) {
  if (!await clickIcon(page, 'AutoStep')) throw new Error('logical solver not found: Icon AutoStep')
  const deadline = Date.now() + LOGIC_SETTLE_TIMEOUT_MS
  const readBoard = () => page.evaluate(() =>
    [...document.querySelectorAll('svg text')].map(t => t.textContent).join('|'))
  let prev = null
  let stable = 0
  while (stable < 3) {
    if (Date.now() > deadline) {
      throw new Error(`logical solver did not settle within ${LOGIC_SETTLE_TIMEOUT_MS}ms`)
    }
    await page.waitForTimeout(500)
    const board = await readBoard()
    stable = board === prev ? stable + 1 : 0
    prev = board
  }
}
