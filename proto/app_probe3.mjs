import { chromium } from 'playwright'
import fs from 'fs'
const link = fs.readFileSync(process.argv[2], 'utf8').trim()
const browser = await chromium.launch()
const page = await browser.newPage()
const logs = []
page.on('console', m => { if (m.text().startsWith('QRPROBE')) logs.push(m.text()) })
await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(3000)
console.log('=== what the backend received (full) ===')
for (const l of logs) console.log(l.replace('QRPROBE ', ''))

// Open the constraint in the Elements panel and look for editable value fields.
console.log('\n=== UI: does the author get a value field? ===')
const el = page.getByText('Quad Rank Probe', { exact: true }).first()
if (await el.count()) {
  await el.click()
  await page.waitForTimeout(1500)
  const inputs = await page.evaluate(() =>
    [...document.querySelectorAll('input, textarea')].map(i => ({
      type: i.type,
      value: (i.value || '').slice(0, 30),
      label: (i.getAttribute('placeholder') || i.getAttribute('aria-label') || '').slice(0, 40)
    })).filter(i => i.value || i.label))
  console.log(JSON.stringify(inputs, null, 1).slice(0, 1500))
} else {
  console.log('constraint row not found in panel')
}
await browser.close()
