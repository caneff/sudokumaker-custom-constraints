import { chromium } from '/home/caneff/src/sudokumaker-custom-constraints/node_modules/playwright/index.mjs'
import fs from 'fs'
import { useRecordedApp, solveLogically } from '/home/caneff/src/sudokumaker-custom-constraints/examples/_shared/app-dom.mjs'
const link = fs.readFileSync(process.argv[2], 'utf8').trim()
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
await useRecordedApp(context)
const page = await context.newPage()
const lines = []
page.on('console', m => { if (m.text().startsWith('[probe]')) lines.push(m.text()) })
await page.goto(link, { waitUntil: 'load' })
await page.waitForTimeout(4000)
const nBefore = lines.length
await solveLogically(page)
const dump = await page.evaluate(() => [...document.querySelectorAll('svg text')].map(t => ({
  tr: t.closest('g[transform]')?.getAttribute('transform'), v: t.textContent.trim(),
  fs: t.getAttribute('font-size') || getComputedStyle(t).fontSize })))
fs.writeFileSync(process.argv[3], JSON.stringify(dump, null, 1))
const interior = dump.filter(t => { const m = /translate\((\d+) (\d+)\) scale\(25\)$/.exec(t.tr || ''); if (!m) return false
  const c = (+m[1] - 25) / 50; const r = (+m[2] - 25) / 50
  return c >= 1 && c <= 9 && r >= 1 && r <= 9 && parseFloat(t.fs) > 1 })
console.log('interiorAfter', interior.length, '/81  probeYields total', lines.length, '(before AutoStep', nBefore, ')')
fs.writeFileSync(process.argv[4] || '/dev/null', lines.join('\n'))
await context.close(); await browser.close()
