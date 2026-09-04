// Prototype for #322: load the probe link in the real app and read back what
// the custom component was handed for each group's `value`.
//
//   node proto/app_probe.mjs proto/probe_link.txt

import { chromium } from 'playwright'
import fs from 'fs'

const linkFile = process.argv[2] || 'proto/probe_link.txt'
const link = fs.readFileSync(linkFile, 'utf8').trim()

const browser = await chromium.launch()
const page = await browser.newPage()
const logs = []
page.on('console', m => { if (m.text().startsWith('QRPROBE')) logs.push(m.text()) })
page.on('pageerror', e => logs.push('PAGEERROR ' + e.message))

await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(3000)

// What the app kept in its own document, after parsing the link.
const stored = await page.evaluate(() => {
  const link = window.location.href
  return { href: link.length }
})

console.log('console lines:', logs.length)
for (const l of logs) console.log(l)
console.log('page url length:', stored.href)
await browser.close()
