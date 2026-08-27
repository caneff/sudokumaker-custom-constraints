// Browser-page helpers shared by the Playwright drivers that automate the
// live SudokuMaker app (app-solve.mjs, app-strip.mjs). Needs a live `page`,
// so it runs only under Playwright -- the pure, node:assert-testable logic
// lives in app-solve-lib.mjs and app-strip-lib.mjs instead.

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
