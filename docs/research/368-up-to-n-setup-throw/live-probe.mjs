// Open a no-ring link in the live app (the recorded HAR), click "Find all
// solutions", and print the app's readout and every console error. Writes a
// screenshot beside the link it was given, under .scratch/.
//
//   node docs/research/368-up-to-n-setup-throw/live-probe.mjs <link_file>
import { readFileSync, mkdirSync } from 'fs'
import { chromium } from 'playwright'
import { useRecordedApp, clickIcon, makeDeterministic } from '../../../examples/_shared/app-dom.mjs'

const link = readFileSync(process.argv[2], 'utf8').trim()
const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
await useRecordedApp(context)
const page = await context.newPage()
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[console.${m.type()}]`, m.text().slice(0, 300)) })
await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(1500)
mkdirSync('.scratch', { recursive: true })
await page.screenshot({ path: '.scratch/368-live-open-' + (process.argv[3] || 'a') + '.png' })
await makeDeterministic(page)
console.log('clicked:', await clickIcon(page, 'ShowCandidates'))
await page.waitForTimeout(4000)
const text = await page.evaluate(() => document.body.innerText)
console.log(text.split('\n').filter(l => /solution|took|unique|constraint|error/i.test(l)).slice(0, 20).join('\n'))
await page.screenshot({ path: '.scratch/368-live-solved.png' })
await browser.close()
