import { chromium } from 'playwright'
import fs from 'fs'
const link = fs.readFileSync(process.argv[2], 'utf8').trim()
const browser = await chromium.launch()
const page = await browser.newPage()
const logs = []
page.on('console', m => logs.push(m.type() + ': ' + m.text().slice(0, 300)))
page.on('pageerror', e => logs.push('PAGEERROR ' + e.message.slice(0, 300)))
await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(4000)
console.log('--- all console (' + logs.length + ') ---')
for (const l of logs.slice(0, 40)) console.log(l)
const body = await page.evaluate(() => document.body.innerText.slice(0, 1500))
console.log('--- body ---')
console.log(body)
await browser.close()
