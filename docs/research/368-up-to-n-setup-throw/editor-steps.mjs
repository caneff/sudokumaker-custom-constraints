// Drive the live editor step by step: open a link, run JSON steps (text to
// click, a mouse click at x,y, typing, a key, an eval), screenshot after each
// into .scratch/370/, and save the final page URL to .scratch/370/editor-url.txt.
//
//   node docs/research/368-up-to-n-setup-throw/editor-steps.mjs <link_file> '<steps json>'
import { readFileSync } from 'fs'
import { chromium } from 'playwright'
import { useRecordedApp, clickText } from '../../../examples/_shared/app-dom.mjs'
const link = readFileSync(process.argv[2], 'utf8').trim()
const steps = JSON.parse(process.argv[3] || '[]')
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
await useRecordedApp(context)
const page = await context.newPage()
await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(1500)
let i = 0
for (const s of steps) {
  if (s.text) console.log('clickText', s.text, await clickText(page, s.text))
  if (s.click) await page.mouse.click(s.click[0], s.click[1])
  if (s.type) await page.keyboard.type(s.type)
  if (s.key) await page.keyboard.press(s.key)
  if (s.eval) console.log('eval', JSON.stringify(await page.evaluate(s.eval)).slice(0, 3000))
  await page.waitForTimeout(s.wait || 800)
  await page.screenshot({ path: `.scratch/370/editor-${i++}.png` })
}
console.log('URL', page.url().slice(0, 80), page.url().length); (await import('fs')).writeFileSync('.scratch/370/editor-url.txt', page.url() + '\n')
await browser.close()
