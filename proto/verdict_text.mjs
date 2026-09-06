// Print the app's raw solve readout for a link (debugging #335).
import { chromium } from 'playwright'
import fs from 'fs'
const link = fs.readFileSync(process.argv[2], 'utf8').trim()
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(3000)
await page.evaluate(() => {
  const svg = [...document.querySelectorAll('svg.Icon')].find(s => (s.getAttribute('class') || '').includes('ShowCandidates'))
  svg.closest('button').click()
})
await page.waitForTimeout(parseInt(process.env.QR_WAIT || '30000', 10))
const text = await page.evaluate(() => document.body.innerText)
console.log(text.split('\n').filter(l => /took|Found|Solved|solution|broken|Stopped/i.test(l)).join('\n'))
await browser.close()
