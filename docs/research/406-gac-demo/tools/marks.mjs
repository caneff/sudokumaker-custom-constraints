// After AutoStep on a link, dump every cell's value and pencil marks, then
// test the fixpoint for naked singles and unpropagated placed digits.
import { chromium } from '/home/caneff/src/sudokumaker-custom-constraints/node_modules/playwright/index.mjs'
import fs from 'fs'
import { useRecordedApp, solveLogically } from '/home/caneff/src/sudokumaker-custom-constraints/examples/_shared/app-dom.mjs'

const linkFile = process.argv[2]
const link = fs.readFileSync(linkFile, 'utf8').trim()
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
await useRecordedApp(context)
const page = await context.newPage()
await page.goto(link, { waitUntil: 'load' })
await page.waitForTimeout(4000)
await solveLogically(page)

const dump = await page.evaluate(() => {
  const out = []
  for (const t of document.querySelectorAll('svg text')) {
    const g = t.closest('g[transform]')
    out.push({
      tr: g ? g.getAttribute('transform') : null,
      v: t.textContent.trim(),
      fs: t.getAttribute('font-size') || getComputedStyle(t).fontSize,
      x: t.getAttribute('x'), y: t.getAttribute('y'),
      fill: t.getAttribute('fill') || getComputedStyle(t).fill
    })
  }
  return out
})
fs.writeFileSync(process.argv[3], JSON.stringify(dump, null, 1))
console.log('texts:', dump.length)
await context.close(); await browser.close()
