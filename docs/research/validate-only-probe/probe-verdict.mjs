import { chromium } from 'playwright'
import fs from 'fs'
import { clickIcon, makeDeterministic, useRecordedApp } from '../../../examples/_shared/app-dom.mjs'
const link = fs.readFileSync(process.argv[2], 'utf8').trim()
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
await useRecordedApp(context)
const page = await context.newPage()
page.on('console', m => console.log('[console:' + m.type() + '] ' + m.text().slice(0, 300)))
page.on('pageerror', e => console.log('[pageerror] ' + e.message))
await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(1200)
await makeDeterministic(page)
await clickIcon(page, 'ShowCandidates')
try {
  await page.waitForFunction(() => /unique solution|multiple solutions|not unique|no solution|found [\d,]+ solutions|stopped (solving|counting)|unable to satisfy|error/i.test(document.body.innerText), null, { timeout: 60000 })
} catch { console.log('[no verdict in 60s]') }
await page.waitForTimeout(500)
const text = await page.evaluate(() => document.body.innerText)
const lines = text.split('\n').filter(l => /solution|took|unable|error|candidate|probe/i.test(l))
console.log('[verdict lines]\n' + lines.join('\n'))
await context.close(); await browser.close()
