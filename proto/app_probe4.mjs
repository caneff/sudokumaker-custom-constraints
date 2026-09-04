// Can an author type a multi-digit value into the group field, and does the
// backend see the new value?
import { chromium } from 'playwright'
import fs from 'fs'
const link = fs.readFileSync(process.argv[2], 'utf8').trim()
const browser = await chromium.launch()
const page = await browser.newPage()
const logs = []
page.on('console', m => { if (m.text().startsWith('QRPROBE')) logs.push(m.text()) })
await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(3000)
await page.getByText('Quad Rank Probe', { exact: true }).first().click()
await page.waitForTimeout(1200)
const field = page.locator('input[type=text]').first()
console.log('before:', await field.inputValue())
await field.fill('')
await field.type('123456', { delay: 40 })
await page.waitForTimeout(1500)
console.log('after typing "123456":', await field.inputValue())
await page.keyboard.press('Enter')
await page.locator('body').click({ position: { x: 5, y: 5 } })
await page.waitForTimeout(2500)
console.log('backend log count:', logs.length)
const last = logs[logs.length - 1] || '(no new backend log)'
console.log('backend last saw:', last.replace('QRPROBE ', '').slice(0, 200))
await browser.close()
