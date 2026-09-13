// Live probe for docs/research/ui-conflict-highlight.md: does the editor paint
// r1c2 red when a custom validate rejects the entered digit? Run per link:
//   node docs/research/validate-only-probe/probe-highlight.mjs <link.txt>
// Prints one line per trial: digit entered, the cell's text fill (#f00 = the
// app's invalid colour), and whether the cell went red.
import { chromium } from 'playwright'
import fs from 'fs'
import { useRecordedApp } from '../../../examples/_shared/app-dom.mjs'
const link = fs.readFileSync(process.argv[2], 'utf8').trim()
const ROW = 0; const COL = 1 // r1c2, cell id 1, the probe component's cell
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
await useRecordedApp(context)
const page = await context.newPage()
page.on('console', m => { if (m.type() === 'error') console.log('[console:error] ' + m.text().slice(0, 300)) })
page.on('pageerror', e => console.log('[pageerror] ' + e.message))
await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(1500)
const svgInfo = ({ row, col }) => {
  const svg = [...document.querySelectorAll('svg')].find(s => s.getAttribute('class') === 'SudokuSvg')
  const outerG = svg.querySelector('g')
  const pt = svg.createSVGPoint(); pt.x = 25 + 50 * col; pt.y = 25 + 50 * row
  const sp = pt.matrixTransform(outerG.getScreenCTM())
  const g = [...outerG.children].find(c => c.getAttribute('transform') === `translate(${25 + 50 * col} ${25 + 50 * row}) scale(25)`)
  const t = g ? g.querySelector('text') : null
  return { x: sp.x, y: sp.y, content: t ? t.textContent : null, fill: t ? t.getAttribute('fill') : null }
}
async function trial (digit) {
  // Clicking an already-selected cell deselects it, so park the selection on
  // r1c1 first, then select the target.
  const park = await page.evaluate(svgInfo, { row: 0, col: 0 })
  await page.mouse.click(park.x, park.y); await page.waitForTimeout(100)
  const p = await page.evaluate(svgInfo, { row: ROW, col: COL })
  await page.mouse.click(p.x, p.y); await page.waitForTimeout(150)
  await page.keyboard.press('Backspace'); await page.waitForTimeout(150)
  await page.keyboard.press(String(digit)); await page.waitForTimeout(1200)
  const after = await page.evaluate(svgInfo, { row: ROW, col: COL })
  console.log(`[trial] digit ${digit}: content=${after.content} fill=${after.fill} red=${after.fill === '#f00'}`)
}
console.log('[probe] ' + process.argv[2])
await trial(5) // legal for the houses, rejected by the custom validate
await trial(4) // the digit the custom validate wants
await trial(2) // duplicates r1c1: the peer loop must paint it, detector check
await context.close(); await browser.close()
