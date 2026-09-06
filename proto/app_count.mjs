// How many solutions does the app COUNT for a link, with non-deterministic
// solve off? app-solve.mjs reports only the verdict; #335 needs the count, so
// that two component versions on one board can be compared for enforcement.
//
//   node proto/app_count.mjs <link_file>

import { chromium } from 'playwright'
import fs from 'fs'
import { clickIcon, makeDeterministic, useRecordedApp } from '../examples/_shared/app-dom.mjs'

const linkFile = process.argv[2]
const link = fs.readFileSync(linkFile, 'utf8').trim()
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
await useRecordedApp(context)
const page = await context.newPage()
page.on('console', m => { if (m.text().startsWith('[probe]')) console.log(m.text()) })
await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(1200)
await makeDeterministic(page)
await clickIcon(page, 'ShowCandidates')
try {
  await page.waitForFunction(
    () => /unique solution|multiple solutions|not unique|no solution|found [\d,]+ solutions|stopped (solving|counting)|broken/i.test(document.body.innerText),
    null, { timeout: 300000 })
} catch { /* no verdict inside the cap */ }
await page.waitForTimeout(500)
const text = await page.evaluate(() => document.body.innerText)
console.log(linkFile)
console.log(text.split('\n').filter(l => /took|found|solution|broken|stopped/i.test(l)).join('\n') || '(no verdict inside 300s)')
await browser.close()
