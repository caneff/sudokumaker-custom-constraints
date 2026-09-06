// Capture the actual grids the app counts as solutions (#335).
//
// The solver runs in a worker and posts one message per solution
// (`{type:'update', sudokuData}`). This wraps `window.Worker` before the app
// boots and records every payload, so the count in the readout can be checked
// against the grids behind it: duplicates, or grids that break the rule.
//
//   node proto/app_solutions.mjs <link_file> <out.json>

import { chromium } from 'playwright'
import fs from 'fs'
import { clickIcon, makeDeterministic, useRecordedApp } from '../examples/_shared/app-dom.mjs'

const linkFile = process.argv[2]
const outFile = process.argv[3] || 'proto/app_solutions.json'
const link = fs.readFileSync(linkFile, 'utf8').trim()

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
await useRecordedApp(context)
const page = await context.newPage()
await page.addInitScript(() => {
  window.__payloads = []
  const Orig = window.Worker
  window.Worker = class extends Orig {
    constructor (...args) {
      super(...args)
      this.addEventListener('message', e => {
        const d = e.data
        if (!d) return
        const buf = d.sudokuData || d.sudoku
        if (buf) window.__payloads.push({ type: d.type, valid: d.valid, changed: d.changed, data: Array.from(buf) })
      })
    }
  }
})
await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(1200)
await makeDeterministic(page)
await clickIcon(page, 'ShowCandidates')
try {
  await page.waitForFunction(
    () => /unique solution|multiple solutions|not unique|no solution|found [\d,]+ solutions|stopped (solving|counting)|broken/i.test(document.body.innerText),
    null, { timeout: 300000 })
} catch { /* no verdict inside the cap */ }
await page.waitForTimeout(1000)
const text = await page.evaluate(() => document.body.innerText)
const payloads = await page.evaluate(() => window.__payloads)
fs.writeFileSync(outFile, JSON.stringify(payloads))
console.log(linkFile)
console.log(text.split('\n').filter(l => /took|found|solution|broken|stopped/i.test(l)).join('\n'))
console.log(`captured ${payloads.length} payloads -> ${outFile}`)
await browser.close()
