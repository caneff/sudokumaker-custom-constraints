// Does `validate` alone bind, with no candidate removals in `update`?
//
// The baseline board timed out where the deduction board finished. That reads
// as a huge speedup only if the baseline is solving the SAME puzzle. If a
// removal-free component is inert (gotcha 2), the baseline is searching an
// unconstrained board instead and the comparison is meaningless.
//
// Test: hand the app a fully-given grid that satisfies sudoku but breaks a
// clued rank. If the constraint binds, the app rejects it.
import { chromium } from 'playwright'
import fs from 'fs'

const link = fs.readFileSync(process.argv[2], 'utf8').trim()
const browser = await chromium.launch()
const page = await browser.newPage()
await page.goto(link, { waitUntil: 'networkidle', timeout: 90000 })
await page.waitForTimeout(2500)
const btns = await page.evaluate(() =>
  [...document.querySelectorAll('svg.Icon')].map(s => s.getAttribute('class')))
const target = btns.find(c => c.includes('CheckSolution')) ? 'CheckSolution' : 'ShowCandidates'
await page.evaluate((name) => {
  const svg = [...document.querySelectorAll('svg.Icon')].find(s => (s.getAttribute('class') || '').includes(name))
  svg.closest('button').click()
}, target)
await page.waitForTimeout(6000)
const text = await page.evaluate(() => document.body.innerText)
const verdict = text.split('\n').filter(l => /solution|valid|invalid|conflict|wrong|correct|error/i.test(l)).slice(0, 6)
console.log('clicked:', target)
console.log('verdict lines:', JSON.stringify(verdict, null, 1))
await browser.close()
