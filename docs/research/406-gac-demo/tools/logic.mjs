// Run the app's OWN logical solver (AutoStep) on a link and report how many of
// the inner 9x9 cells it filled.
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
    out.push({ x: +m[1], y: +m[2], v: t.textContent.trim(),
               fill: t.getAttribute('fill') || getComputedStyle(t).fill })
  }
  return out
})

const before = await read()
await solveLogically(page)
const after = await read()

const step = 50
const cellOf = c => ({ col: Math.round((c.x - 25) / step), row: Math.round((c.y - 25) / step) })
const interior = list => list.filter(c => {
  const { col, row } = cellOf(c)
  return col >= 1 && col <= 9 && row >= 1 && row <= 9 && /^[0-9]$/.test(c.v)
})
const frame = list => list.filter(c => {
  const { col, row } = cellOf(c)
  const onFrame = (col === 0 || col === 10 || row === 0 || row === 10)
  const corner = (col === 0 || col === 10) && (row === 0 || row === 10)
  return onFrame && !corner && /^[0-9]$/.test(c.v)
})
console.log(JSON.stringify({
  file: linkFile.split('/').pop(),
  interiorBefore: interior(before).length,
  interiorAfter: interior(after).length,
  frameBefore: frame(before).length,
  frameAfter: frame(after).length,
  rawTexts: after.length,
  unsolvedInterior: (() => { const got = new Set(interior(after).map(c => { const p = cellOf(c); return p.row + "," + p.col })); const miss = []; for (let r = 1; r <= 9; r++) for (let col = 1; col <= 9; col++) if (!got.has(r + "," + col)) miss.push("R" + (r + 1) + "C" + (col + 1)); return miss })()
}))
await context.close()
await browser.close()
