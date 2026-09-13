// Run the app's OWN logical solver (AutoStep) on a plain 9x9 link and report
// how many cells it filled, plus the grid it reached ('.' for unfilled) so the
// digits can be checked against the CP-SAT solution build9.py prints.
//
//   node docs/research/406-gac-demo/tools/logic9.mjs <link_file>
import { chromium } from '/home/caneff/src/sudokumaker-custom-constraints/node_modules/playwright/index.mjs'
import fs from 'fs'
import { useRecordedApp, solveLogically } from '/home/caneff/src/sudokumaker-custom-constraints/examples/_shared/app-dom.mjs'

const linkFile = process.argv[2]
const link = fs.readFileSync(linkFile, 'utf8').trim()
const browser = await chromium.launch()
const context = await browser.newContext()
await useRecordedApp(context)
const page = await context.newPage()
page.on('pageerror', e => console.error('PAGEERROR', e.message))
await page.goto(link, { waitUntil: 'load' })
await page.waitForTimeout(4000)

const read = () => page.evaluate(() => {
  const re = /^translate\((\d+) (\d+)\) scale\(25\)$/
  const out = []
  for (const t of document.querySelectorAll('svg text')) {
    const g = t.closest('g[transform]')
    const m = g && re.exec(g.getAttribute('transform'))
    if (!m) continue
    out.push({ x: +m[1], y: +m[2], v: t.textContent.trim() })
  }
  return out
})

const step = 50
const grid = list => {
  const rows = Array.from({ length: 9 }, () => Array(9).fill('.'))
  for (const c of list) {
    const col = Math.round((c.x - 25) / step)
    const row = Math.round((c.y - 25) / step)
    if (col >= 0 && col < 9 && row >= 0 && row < 9 && /^[1-9]$/.test(c.v)) rows[row][col] = c.v
  }
  return rows.map(r => r.join(''))
}

const before = grid(await read())
await solveLogically(page)
const after = grid(await read())
const count = g => g.join('').replace(/\./g, '').length
console.log(JSON.stringify({ file: linkFile.split('/').pop(), before: count(before), after: count(after), grid: after }))
await context.close()
await browser.close()
